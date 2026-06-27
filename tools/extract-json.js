// stdin(모델 출력)에서 JSON 객체만 추출·검증해 stdout으로
let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{
  const a=s.indexOf('{'), b=s.lastIndexOf('}');
  if(a<0||b<=a){ console.error('JSON 객체를 찾지 못함'); process.exit(1); }
  let o; try{ o=JSON.parse(s.slice(a,b+1)); }catch(e){ console.error('JSON 파싱 실패: '+e.message); process.exit(1); }
  if(!o || !Array.isArray(o.slides) || !o.slides.length){ console.error('slides 배열 없음'); process.exit(1); }
  o.handle = o.handle || '@aimax';
  o.preset = o.preset || 'cine';
  if(!('accent' in o)) o.accent = null;
  process.stdout.write(JSON.stringify(o, null, 2));
});
