// debug-auth.mjs — telusuri jalur login: baca authError + mode + localStorage.
import fs from'node:fs';
const PORT=9334,BASE='http://localhost:4100';
const j=async(p,o)=>{const r=await fetch(BASE+p,o);return{status:r.status,d:await r.json().catch(()=>({}))};};
const uname='dbg'+Date.now().toString(36);
const reg=await j('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,password:'pass1234'})});
console.log('register:',reg.status);
const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE+'/')}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
let id=0;const pending=new Map();const logs=[];
const send=(m,p={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.onmessage=ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id)}
  else if(m.method==='Runtime.consoleAPICalled'){logs.push('console['+m.params.type+']: '+m.params.args.map(a=>a.value||a.description||'').join(' '))}
  else if(m.method==='Runtime.exceptionThrown'){logs.push('EXC: '+(m.params.exceptionDetails.exception?.description||'').slice(0,300))}};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');await send('Runtime.enable');
const t0=Date.now();
while(Date.now()-t0<20000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
await new Promise(r=>setTimeout(r,1200));
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;

console.log('booted:',await ev('!!window.__lumenveilBooted'));
console.log('modeBadge:',await ev("(document.getElementById('modeBadge')||{}).textContent"));
console.log('overlay hidden:',await ev("document.getElementById('authOverlay').hidden"));
console.log('authForm ada:',await ev("!!document.getElementById('authForm')"));

// isi + submit, lalu observasi
await ev(`document.getElementById('authUsername').value='${uname}';
document.getElementById('authPassword').value='pass1234';
document.getElementById('authForm').dispatchEvent(new Event('submit',{cancelable:true}));'sent'`);
await new Promise(r=>setTimeout(r,3000));
console.log('--- setelah submit (3s) ---');
console.log('authError:',JSON.stringify(await ev("document.getElementById('authError').textContent")));
console.log('overlay hidden:',await ev("document.getElementById('authOverlay').hidden"));
console.log('localStorage token:',JSON.stringify(await ev("localStorage.getItem('lumenvail-auth')||'(kosong)'")));
console.log('gemCount:',await ev("document.getElementById('gemCount').textContent"));
console.log('history rows:',await ev("document.querySelectorAll('.history-row').length"));
// panggil fetch /api/me manual dari konteks halaman (same-origin) untuk isolasi
const manual=await ev(`(async()=>{try{const r=await fetch('http://localhost:4100/api/me');return 'status='+r.status+' body='+String(await r.text()).slice(0,120)}catch(e){return 'ERR '+e.message}})()`);
console.log('manual fetch /api/me (tanpa token):',manual);
console.log('console logs:',logs.length?logs.join('\n'):'(none)');
ws.close();process.exit(0);
