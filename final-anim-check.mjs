// final-anim-check.mjs — 10x pull, screenshot saat animasi, skip, close, screenshot hasil.
const PORT=9334,BASE='http://localhost:4100';
const fs=await import('node:fs');
const uname='fanim'+Date.now().toString(36);
const reg=await (await fetch(BASE+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,password:'pass1234'})})).json();
if(!reg.token){console.log('register gagal:',reg.error);process.exit(1)}
const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE+'/')}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
let id=0;const pending=new Map();const errs=[];
const send=(m,p={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.onmessage=ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id);return}
  if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errs.push((m.params.args||[]).map(a=>a.value||a.description||'').join(' '));
};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');await send('Runtime.enable');
const waitLoad=async()=>{const t0=Date.now();while(Date.now()-t0<20000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}};
await waitLoad();await new Promise(r=>setTimeout(r,1800));
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
await ev(`localStorage.setItem('lumenvail-auth','${reg.token}');location.reload();1`);
await waitLoad();await new Promise(r=>setTimeout(r,2500));
console.log('stage sebelum:',await ev("getComputedStyle(document.getElementById('stage')).display"));
// PULL 10x
await ev("document.getElementById('btnPull10').click();1");
await new Promise(r=>setTimeout(r,1500));
const mid=await ev(`(()=>{const st=document.getElementById('stage');return{display:getComputedStyle(st).display,tally:document.getElementById('batchTally').textContent,caption:document.getElementById('stageCaption').textContent}})()`);
console.log('SAAT ANIMASI (1.5s):',JSON.stringify(mid));
// screenshot saat animasi berjalan
const s1=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:1456,height:782,scale:1}});
fs.writeFileSync('C:/Users/M S I/AppData/Local/Temp/lv-anim-mid.png',Buffer.from(s1.data,'base64'));
console.log('SHOT: temp/lv-anim-mid.png');
// klik skip → langsung ke hasil
await ev("document.getElementById('btnSkip').click();1");
await new Promise(r=>setTimeout(r,1200));
const res=await ev(`(()=>{const rl=document.getElementById('resultLayer');return{display:getComputedStyle(rl).display,cards:document.querySelectorAll('.result-card').length}})()`);
console.log('SETelah SKIP:',JSON.stringify(res));
const s2=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:1456,height:782,scale:1}});
fs.writeFileSync('C:/Users/M S I/AppData/Local/Temp/lv-result-grid.png',Buffer.from(s2.data,'base64'));
console.log('SHOT: temp/lv-result-grid.png');
// close
await ev("document.getElementById('btnCloseResults').click();1");
await new Promise(r=>setTimeout(r,800));
console.log('setelah CLOSE — stage:',await ev("getComputedStyle(document.getElementById('stage')).display"));
console.log('ERRORS:',errs.length?errs.join(' | ').slice(0,400):'(none)');
ws.close();process.exit(0);
