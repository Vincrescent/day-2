// diag-result.mjs — kenapa resultLayer display=none setelah skip?
const PORT=9334,BASE='http://localhost:4100';
const uname='diagr'+Date.now().toString(36);
const reg=await (await fetch(BASE+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,password:'pass1234'})})).json();
if(!reg.token){console.log('register gagal');process.exit(1)}
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
await waitLoad();await new Promise(r=>setTimeout(r,1500));
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
await ev(`localStorage.setItem('lumenvail-auth','${reg.token}');location.reload();1`);
await waitLoad();await new Promise(r=>setTimeout(r,2500));

// cek CSS yang ter-load: apakah .result-layer masih punya display:none?
const cssSrc=await ev(`(()=>{const l=document.getElementById('resultLayer');const cs=getComputedStyle(l);return{display:cs.display,hidden:l.hasAttribute('hidden')}})()`);
console.log('SEBELUM: resultLayer',JSON.stringify(cssSrc));

// PULL 1x (cepat)
await ev("document.getElementById('btnPull1').click();1");
await new Promise(r=>setTimeout(r,1200));
console.log('SAAT ANIMASI: stage=',await ev("getComputedStyle(document.getElementById('stage')).display"));
// wait animasi selesai (4.4s) TAU tanpa skip → hasil tampil normal
await new Promise(r=>setTimeout(r,4200));
const after=await ev(`(()=>{const l=document.getElementById('resultLayer');const s=document.getElementById('stage');const sh=document.getElementById('showcase');return{rlHidden:l.hasAttribute('hidden'),rlDisplay:getComputedStyle(l).display,stageHidden:s.hasAttribute('hidden'),showHidden:sh.hasAttribute('hidden'),cards:document.querySelectorAll('.result-card').length}})()`);
console.log('SETELAH ANIMASI (tanpa skip):',JSON.stringify(after));
console.log('ERRORS:',errs.length?errs.join(' | ').slice(0,300):'(none)');
ws.close();process.exit(0);
