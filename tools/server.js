// 카드뉴스 로컬 AI 브리지: 브라우저 에디터 ↔ claude -p (당신 구독)
const http = require('http');
const https = require('https');
const os = require('os');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
function lanIPs(){ const r=[]; const ni=os.networkInterfaces(); for(const k in ni){ for(const a of ni[k]){ if(a.family==='IPv4' && !a.internal) r.push(a.address); } } return r; }
let PEXELS_KEY = '';
try { PEXELS_KEY = fs.readFileSync(path.join(__dirname, 'pexels-key.txt'), 'utf8').trim(); } catch (e) {}
if (PEXELS_KEY && PEXELS_KEY.startsWith('여기에')) PEXELS_KEY = '';
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
    if (!('accent' in o)) o.accent = null;
    return o;
  } catch (e) { return null; }
}

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET' && req.url === '/ping') { res.writeHead(200); res.end('ok'); return; }
  // Pexels 무료 이미지 검색
  if (req.method === 'GET' && req.url.startsWith('/img-search')) {
    if (!PEXELS_KEY) { res.writeHead(400, {'Content-Type':'application/json'}); res.end(JSON.stringify({ error: 'Pexels 키 없음 — tools/pexels-key.txt 에 키를 넣고 서버 재시작' })); return; }
    const u = new URL(req.url, 'http://x'); const q = (u.searchParams.get('q') || '').trim();
    if (!q) { res.writeHead(400); res.end('{"error":"검색어 없음"}'); return; }
    const pr = https.request({ hostname: 'api.pexels.com', path: '/v1/search?orientation=portrait&per_page=30&query=' + encodeURIComponent(q), headers: { Authorization: PEXELS_KEY } }, pres => {
      let d = ''; pres.on('data', c => d += c); pres.on('end', () => {
        try { const j = JSON.parse(d); const photos = (j.photos || []).map(p => ({ id: p.id, thumb: p.src.medium, full: p.src.large2x || p.src.large || p.src.original, by: p.photographer }));
          res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({ photos }));
        } catch (e) { res.writeHead(502); res.end(JSON.stringify({ error: 'Pexels 응답 파싱 실패' })); }
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
  console.log(' Pexels 이미지 검색: ' + (PEXELS_KEY ? '활성 ✅' : '비활성 (tools/pexels-key.txt 에 키 넣기)'));
  console.log(' (팀원은 에디터의 "AI 서버 주소" 칸에 위 주소를 넣으면 됩니다)');
  console.log(' 이 창은 켜두세요.  중지: Ctrl + C');
  console.log('==================================================');
  if (!process.env.NO_OPEN) { try { exec('cmd /c start "" "http://127.0.0.1:' + PORT + '/"'); } catch (e) {} }
});
server.on('error', err => {
  if (err.code === 'EADDRINUSE') console.error('\n[오류] 포트 ' + PORT + ' 이미 사용 중 — 서버가 이미 켜져 있을 수 있어요. 브라우저에서 http://127.0.0.1:' + PORT + '/ 를 열어보세요.');
  else console.error('\n[오류] 서버 시작 실패:', err.message);
});
