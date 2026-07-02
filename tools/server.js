// 카드뉴스 로컬 AI 브리지: 브라우저 에디터 ↔ claude -p (당신 구독)
const http = require('http');
const https = require('https');
const os = require('os');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
function lanIPs(){ const r=[]; const ni=os.networkInterfaces(); for(const k in ni){ for(const a of ni[k]){ if(a.family==='IPv4' && !a.internal) r.push(a.address); } } return r; }
// 키 파일 읽기 (1줄: 키, 2줄(선택): 모델명). 매 요청마다 다시 읽으므로 서버 재시작 불필요.
function readKey(name){
  try {
    const lines = fs.readFileSync(path.join(__dirname, name), 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!lines.length || lines[0].startsWith('여기에')) return { key: '', model: '' };
    return { key: lines[0], model: lines[1] || '' };
  } catch (e) { return { key: '', model: '' }; }
}
const pexelsKey = () => readKey('pexels-key.txt').key;
const geminiCfg = () => { const k = readKey('gemini-key.txt'); return { key: k.key, model: k.model || 'gemini-3.1-flash-image-preview' }; };
const openaiCfg = () => { const k = readKey('openai-key.txt'); return { key: k.key, model: k.model || 'gpt-image-2' }; };
// Codex CLI (ChatGPT 구독 OAuth 로그인) — 있으면 gpt-image-2 를 구독으로 사용
const hasCodex = () => { try { return fs.existsSync(path.join(os.homedir(), '.codex', 'auth.json')); } catch (e) { return false; } };
const ROOT = path.resolve(__dirname, '..');
const PROMPT = fs.readFileSync(path.join(__dirname, 'deck-prompt.md'), 'utf8');
const PORT = 8787;

function cors(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function extractJson(s){
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    const o = JSON.parse(s.slice(a, b + 1));
    if (!o || !Array.isArray(o.slides) || !o.slides.length) return null;
    o.handle = o.handle || '@aimax';
    o.preset = o.preset || 'cine';
    o.bg = o.bg || '';
    if (!('accent' in o)) o.accent = null;
    return o;
  } catch (e) { return null; }
}

// AI 생성 이미지를 editor/assets/gen/ 에 저장하고 에디터가 쓸 상대경로를 돌려준다
function saveGenImage(b64){
  const dir = path.join(ROOT, 'editor', 'assets', 'gen');
  fs.mkdirSync(dir, { recursive: true });
  const name = 'gen-' + Date.now() + '-' + Math.floor(Math.random() * 10000) + '.png';
  fs.writeFileSync(path.join(dir, name), Buffer.from(b64, 'base64'));
  return 'assets/gen/' + name;
}
function jsonPost(opts, bodyObj, cb){
  const body = JSON.stringify(bodyObj);
  const rq = https.request({ ...opts, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...(opts.headers || {}) } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => { try { cb(null, JSON.parse(d)); } catch (e) { cb(new Error('응답 파싱 실패')); } });
  });
  rq.setTimeout(120000, () => rq.destroy(new Error('시간 초과')));
  rq.on('error', e => cb(e));
  rq.write(body); rq.end();
}
// 나노바나나 (Gemini 이미지 생성) — 최신 모델이 계정에서 안 되면 구모델로 자동 폴백
function genGemini(prompt, cb, modelOverride){
  const { key, model } = geminiCfg();
  const useModel = modelOverride || model;
  jsonPost({ hostname: 'generativelanguage.googleapis.com', path: '/v1beta/models/' + useModel + ':generateContent', headers: { 'x-goog-api-key': key } },
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '4:5' } } },
    (err, j) => {
      if (err) return cb(err);
      if (j.error) {
        const notFound = j.error.code === 404 || /not found|not supported/i.test(j.error.message || '');
        if (notFound && !modelOverride && useModel !== 'gemini-2.5-flash-image') {
          console.log('[gemini] ' + useModel + ' 사용 불가 → gemini-2.5-flash-image 로 폴백');
          return genGemini(prompt, cb, 'gemini-2.5-flash-image');
        }
        return cb(new Error('Gemini: ' + (j.error.message || '오류')));
      }
      const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
      const img = parts.find(p => p.inlineData && p.inlineData.data);
      if (!img) return cb(new Error('Gemini: 이미지가 안 왔어요 (프롬프트가 차단됐을 수 있음)'));
      cb(null, saveGenImage(img.inlineData.data));
    });
}
// Codex CLI: ChatGPT 구독(OAuth)으로 gpt-image-2 이미지 생성 — API 키 불필요
function genCodex(prompt, cb){
  const dir = path.join(ROOT, 'editor', 'assets', 'gen');
  fs.mkdirSync(dir, { recursive: true });
  const name = 'gen-' + Date.now() + '-' + Math.floor(Math.random() * 10000) + '.png';
  const task = 'Use $imagegen to generate exactly one image. Image description: ' + prompt +
    ' Portrait orientation, 1024x1536. Save the image file as exactly "' + name + '" in the current working directory. Do not create or modify any other files. Do not ask questions.';
  const started = Date.now();
  const cp = spawn('codex', ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-'], { cwd: dir, shell: true });
  let err = '';
  cp.stdout.on('data', () => {});
  cp.stderr.on('data', d => err += d);
  const timer = setTimeout(() => { try { cp.kill(); } catch (e) {} }, 300000);
  cp.on('error', e => { clearTimeout(timer); cb(new Error('codex 실행 실패: ' + e.message)); });
  cp.stdin.write(task);
  cp.stdin.end();
  cp.on('close', () => {
    clearTimeout(timer);
    if (fs.existsSync(path.join(dir, name))) return cb(null, 'assets/gen/' + name);
    // 파일명이 어긋났으면 이번 실행 이후에 생긴 이미지 파일을 찾아본다
    try {
      const cand = fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0];
      if (cand && cand.t >= started) return cb(null, 'assets/gen/' + cand.f);
    } catch (e) {}
    cb(new Error('Codex: 이미지가 생성되지 않았어요' + (err ? ' — ' + err.slice(0, 200) : ' (codex 로그인 상태 확인: codex login status)')));
  });
}
// OpenAI GPT Image
function genOpenAI(prompt, cb){
  const { key, model } = openaiCfg();
  jsonPost({ hostname: 'api.openai.com', path: '/v1/images/generations', headers: { Authorization: 'Bearer ' + key } },
    { model, prompt, size: '1024x1536', quality: 'medium', n: 1 },
    (err, j) => {
      if (err) return cb(err);
      if (j.error) return cb(new Error('OpenAI: ' + (j.error.message || '오류')));
      const b64 = j.data && j.data[0] && j.data[0].b64_json;
      if (!b64) return cb(new Error('OpenAI: 이미지가 안 왔어요'));
      cb(null, saveGenImage(b64));
    });
}

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ ok: true, pexels: !!pexelsKey(), codex: hasCodex(), gemini: !!geminiCfg().key, openai: !!openaiCfg().key }));
    return;
  }
  // AI 배경 생성: POST /img-gen {prompt, provider?}
  if (req.method === 'POST' && req.url === '/img-gen') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      let prompt = '', provider = '';
      try { const j = JSON.parse(body); prompt = (j.prompt || '').toString().trim(); provider = (j.provider || '').toString(); } catch (e) {}
      if (!prompt) { res.writeHead(400, {'Content-Type':'application/json'}); res.end('{"error":"프롬프트 없음"}'); return; }
      const hasC = hasCodex(), hasG = !!geminiCfg().key, hasO = !!openaiCfg().key;
      if (!hasC && !hasG && !hasO) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'AI 이미지 수단 없음 — ChatGPT 구독이 있으면 `npm i -g @openai/codex` 후 `codex login` (API 키 불필요), 또는 tools/gemini-key.txt 에 무료 키(aistudio.google.com)' })); return; }
      // 우선순위: ChatGPT 구독(Codex, gpt-image-2) → Gemini 키(나노바나나 2) → OpenAI 키
      let pname = hasC ? 'codex' : hasG ? 'gemini' : 'openai';
      if (provider === 'codex' && hasC) pname = 'codex';
      else if (provider === 'gemini' && hasG) pname = 'gemini';
      else if (provider === 'openai' && hasO) pname = 'openai';
      const fn = pname === 'codex' ? genCodex : pname === 'gemini' ? genGemini : genOpenAI;
      console.log('[img-gen:' + pname + '] ' + prompt.slice(0, 80));
      fn(prompt, (err, url) => {
        if (err) { console.log('[img-gen fail] ' + err.message); res.writeHead(502, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: err.message })); return; }
        console.log('[img-gen ok] ' + url);
        res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({ url, provider: pname }));
      });
    });
    return;
  }
  // 무료 이미지 검색: Pexels 키가 있으면 Pexels, 없으면 Openverse(키 불필요)
  if (req.method === 'GET' && req.url.startsWith('/img-search')) {
    const u = new URL(req.url, 'http://x'); const q = (u.searchParams.get('q') || '').trim();
    if (!q) { res.writeHead(400); res.end('{"error":"검색어 없음"}'); return; }
    const PEXELS_KEY = pexelsKey();
    const opts = PEXELS_KEY
      ? { hostname: 'api.pexels.com', path: '/v1/search?orientation=portrait&per_page=30&query=' + encodeURIComponent(q), headers: { Authorization: PEXELS_KEY } }
      : { hostname: 'api.openverse.org', path: '/v1/images/?page_size=20&aspect_ratio=tall&q=' + encodeURIComponent(q), headers: { 'User-Agent': 'cardnews-editor/1.0' } };
    const pr = https.request(opts, pres => {
      let d = ''; pres.on('data', c => d += c); pres.on('end', () => {
        try {
          const j = JSON.parse(d);
          const photos = PEXELS_KEY
            ? (j.photos || []).map(p => ({ id: p.id, thumb: p.src.medium, full: p.src.large2x || p.src.large || p.src.original, by: p.photographer }))
            : (j.results || []).map(p => ({ id: p.id, thumb: p.thumbnail || p.url, full: p.url, by: p.creator || 'Openverse' }));
          res.writeHead(200, {'Content-Type':'application/json'});
          res.end(JSON.stringify({ photos, source: PEXELS_KEY ? 'Pexels' : 'Openverse' }));
        } catch (e) { res.writeHead(502); res.end(JSON.stringify({ error: '이미지 검색 응답 파싱 실패' })); }
      });
    });
    pr.on('error', e => { res.writeHead(502); res.end(JSON.stringify({ error: e.message })); });
    pr.end(); return;
  }
  // 이미지 프록시 (export CORS 해결)
  if (req.method === 'GET' && req.url.startsWith('/img?')) {
    const u = new URL(req.url, 'http://x'); const target = u.searchParams.get('url');
    if (!target || !/^https:\/\//.test(target)) { res.writeHead(400); res.end(); return; }
    https.get(target, ir => { res.writeHead(200, { 'Content-Type': ir.headers['content-type'] || 'image/jpeg', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public,max-age=86400' }); ir.pipe(res); })
      .on('error', () => { res.writeHead(502); res.end(); });
    return;
  }
  if (req.method === 'POST' && req.url === '/convert') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      let text = '';
      try { text = (JSON.parse(body).text || '').toString(); } catch (e) {}
      if (!text.trim()) { res.writeHead(400); res.end('{"error":"빈 글"}'); return; }
      console.log('[convert] ' + text.length + '자 변환 중…');
      const full = PROMPT + '\n\n==== 변환할 글 ====\n' + text;
      const cp = spawn('claude', ['-p', '--output-format', 'text'], { cwd: ROOT, shell: true });
      let out = '', err = '';
      cp.stdout.on('data', d => out += d);
      cp.stderr.on('data', d => err += d);
      cp.on('error', e => { res.writeHead(500); res.end(JSON.stringify({ error: 'claude 실행 실패: ' + e.message })); });
      cp.on('close', () => {
        const deck = extractJson(out);
        if (deck) { console.log('[ok] ' + deck.slides.length + '장'); res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify(deck)); }
        else { console.log('[fail] JSON 추출 실패'); res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: '변환 실패 (다시 시도)', raw: out.slice(0, 400) })); }
      });
      cp.stdin.write(full);
      cp.stdin.end();
    });
    return;
  }
  // 정적 파일 서빙 (에디터를 http로 제공 → export taint 해결)
  if (req.method === 'GET') {
    let p = decodeURIComponent((req.url.split('?')[0]) || '/');
    if (p === '/' || p === '') p = '/index.html';
    const safe = path.normalize(p).replace(/^([\/\\]|\.\.[\/\\])+/, '');
    const file = path.join(ROOT, 'editor', safe);
    if (file.startsWith(path.join(ROOT, 'editor')) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      const ext = path.extname(file).toLowerCase();
      const T = { '.html':'text/html;charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.json':'application/json', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
      res.writeHead(200, { 'Content-Type': T[ext] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res); return;
    }
  }
  res.writeHead(404); res.end();
});
server.listen(PORT, '0.0.0.0', () => {
  console.log('==================================================');
  console.log(' 🤖 카드뉴스 AI 변환 서버 실행 중  (포트 ' + PORT + ')');
  console.log(' 에디터 열기 (이 PC):  http://127.0.0.1:' + PORT + '/');
  lanIPs().forEach(ip => console.log(' 팀원이 열 주소:       http://' + ip + ':' + PORT + '/'));
  console.log(' 이미지 검색: ' + (pexelsKey() ? 'Pexels ✅' : 'Openverse (키 없이 동작 — Pexels 키를 넣으면 품질↑)'));
  console.log(' AI 배경 생성: ' + (hasCodex() ? 'gpt-image-2 (ChatGPT 구독/Codex) ✅' : geminiCfg().key ? '나노바나나 2 (Gemini) ✅' : openaiCfg().key ? 'OpenAI GPT Image ✅' : '비활성 — codex login 또는 tools/gemini-key.txt'));
  console.log(' (팀원은 에디터의 "AI 서버 주소" 칸에 위 주소를 넣으면 됩니다)');
  console.log(' 이 창은 켜두세요.  중지: Ctrl + C');
  console.log('==================================================');
  if (!process.env.NO_OPEN) { try { exec('cmd /c start "" "http://127.0.0.1:' + PORT + '/"'); } catch (e) {} }
});
server.on('error', err => {
  if (err.code === 'EADDRINUSE') console.error('\n[오류] 포트 ' + PORT + ' 이미 사용 중 — 서버가 이미 켜져 있을 수 있어요. 브라우저에서 http://127.0.0.1:' + PORT + '/ 를 열어보세요.');
  else console.error('\n[오류] 서버 시작 실패:', err.message);
});
