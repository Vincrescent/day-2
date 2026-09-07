// debug-net.mjs — patch fetch di halaman, submit login, lihat error asli.
const PORT=9334,BASE='http://localhost:4100';
const j=async(p,o)=>{const r=await fetch(BASE+p,o);return{status:r.status,d:await r.json().catch(()=>({}))};};
const uname='net'+Date.now().toString(36);
const reg=await j('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,password:'pass1234'})});
console.log('register node:',reg.status);
const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE+'/')}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
let id=0;const pending=new Map();const logs=[];
const send=(m,p={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.onmessage=ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id)}
  else if(m.method==='Runtime.consoleAPICalled'){logs.push(m.params.args.map(a=>a.value||a.description||'').join(' '))}
  else if(m.method==='Runtime.exceptionThrown'){logs.push('EXC: '+(m.params.exceptionDetails.exception?.description||'').slice(0,400))}};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');await send('Runtime.enable');
const t0=Date.now();
while(Date.now()-t0<20000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
await new Promise(r=>setTimeout(r,1000));
const ev=async(e,awaitP)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:!!awaitP})).result?.value;

// patch fetch global
await ev(`(function(){
  window.__net=[];
  const of=window.fetch;
  window.fetch=function(u,o){
    const t0=Date.now();const m=(o&&o.method)||'GET';
    return of.apply(this,arguments).then(
      r=>{window.__net.push({u:typeof u==='string'?u:u.url,m,ok:r.ok,status:r.status,ms:Date.now()-t0});return r},
      e=>{window.__net.push({u:typeof u==='string'?u:u.url,m,err:String(e),stack:(e&&e.stack||'').split('\\n').slice(0,3).join(' | '),ms:Date.now()-t0});throw e}
    );
  };
  return 'patched';})()`);
console.log('fetch patched:',await ev("!!window.__net"));

await ev(`document.getElementById('authUsername').value='${uname}';
document.getElementById('authPassword').value='pass1234';
document.getElementById('authForm').dispatchEvent(new Event('submit',{cancelable:true}));'sent'`);
await new Promise(r=>setTimeout(r,4000));
console.log('NET LOG:');
(JSON.stringify(await ev('JSON.stringify(window.__net)'),true)).split('\n').forEach(l=>console.log(' ',l));
console.log('authError:',JSON.stringify(await ev("document.getElementById('authError').textContent")));
console.log('overlay hidden:',await ev("document.getElementById('authOverlay').hidden"));
console.log('console/EXC logs:');logs.forEach(l=>console.log(' ',l.slice(0,400)));

// panggil handler login MANUAL dengan error asli
const manual=await ev(`(async()=>{
  try{
    const r=await fetch('http://localhost:4100/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'${uname}',password:'pass1234'})});
    const d=await r.json();
    return 'OK status='+r.status+' body='+JSON.stringify(d).slice(0,150);
  }catch(e){return 'THROW: '+String(e)+' | '+(e&&e.message)}
})()`,true);
console.log('manual login fetch:',manual);
ws.close();process.exit(0);
