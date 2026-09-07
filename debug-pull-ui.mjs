// debug-pull-ui.mjs — klik pull di UI, pantau net + state + stage.
const PORT=9334,BASE='http://localhost:4100';
const j=async(p,o)=>{const r=await fetch(BASE+p,o);return{status:r.status,d:await r.json().catch(()=>({}))};};
const uname='pull'+Date.now().toString(36);
const reg=await j('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,password:'pass1234'})});
const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE+'/')}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
let id=0;const pending=new Map();const logs=[];
const send=(m,p={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.onmessage=ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id)}
  else if(m.method==='Runtime.consoleAPICalled'){logs.push('console: '+m.params.args.map(a=>a.value||a.description||'').join(' '))}
  else if(m.method==='Runtime.exceptionThrown'){logs.push('EXC: '+(m.params.exceptionDetails.exception?.description||'').slice(0,500))}
  else if(m.method==='Runtime.executionContextDestroyed'){logs.push('EXEC CTX DESTROYED (reload?)')}};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');await send('Runtime.enable');
const t0=Date.now();
while(Date.now()-t0<20000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
await new Promise(r=>setTimeout(r,800));
const ev=async(e,awaitP)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:!!awaitP})).result?.value;

await ev(`(function(){window.__net=[];const of=window.fetch;window.fetch=function(u,o){const t0=Date.now(),m=(o&&o.method)||'GET';return of.apply(this,arguments).then(r=>{window.__net.push({u:u.url||u,m,ok:r.ok,st:r.status,ms:Date.now()-t0});return r},e=>{window.__net.push({u:u.url||u,m,err:String(e)});throw e})};return 1})()`);
// login
await ev(`document.getElementById('authUsername').value='${uname}';document.getElementById('authPassword').value='pass1234';document.getElementById('authForm').dispatchEvent(new Event('submit',{cancelable:true}));1`);
await new Promise(r=>setTimeout(r,2500));
console.log('setelah login: overlay hidden =',await ev("document.getElementById('authOverlay').hidden"),
  '| gems =',await ev("document.getElementById('gemCount').textContent"));

// klik pull
await ev("document.getElementById('btnPull10').click();1");
for(const wait of[1500,1500,2000]){
  await new Promise(r=>setTimeout(r,wait));
  console.log('t+'+(wait)+': stage hidden =',await ev("document.getElementById('stage').hidden"),
    '| resultLayer hidden =',await ev("document.getElementById('resultLayer').hidden"),
    '| gems =',await ev("document.getElementById('gemCount').textContent"),
    '| cards =',await ev("document.querySelectorAll('.result-card').length"));
}
console.log('NET:',JSON.stringify(await ev('window.__net'),null,1));
console.log('LOGS:');logs.forEach(l=>console.log(' ',l.slice(0,400)));
ws.close();process.exit(0);
