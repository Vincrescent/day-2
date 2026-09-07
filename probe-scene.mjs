// probe-scene.mjs — cek window.Scene2D/Scene3D + error load script.
const PORT=9334,BASE='http://localhost:4100';
const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE+'/')}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
let id=0;const pending=new Map();const logs=[];
const send=(m,p={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.onmessage=ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id)}
  else if(m.method==='Runtime.consoleAPICalled'){logs.push('console['+m.params.type+']: '+m.params.args.map(a=>a.value||a.description||'').join(' '))}
  else if(m.method==='Runtime.exceptionThrown'){logs.push('EXC: '+(m.params.exceptionDetails.exception?.description||'').slice(0,400)+' @line'+m.params.exceptionDetails.lineNumber)}};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');await send('Runtime.enable');
const t0=Date.now();
while(Date.now()-t0<20000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
await new Promise(r=>setTimeout(r,1500));
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
console.log('typeof Scene2D =',await ev('typeof window.Scene2D'));
console.log('typeof Scene2D.abort =',await ev('typeof (window.Scene2D&&window.Scene2D.abort)'));
console.log('typeof Scene3D =',await ev('typeof window.Scene3D'));
console.log('Scene3D.ready =',await ev('window.Scene3D?window.Scene3D.ready:undefined'));
console.log('scene2d script src ada di DOM =',await ev("[...document.scripts].filter(s=>s.src.includes('scene2d')).length"));
console.log('scene3d script src ada di DOM =',await ev("[...document.scripts].filter(s=>s.src.includes('scene3d')).length"));
console.log('app booted =',await ev('!!window.__lumenveilBooted'));
console.log('__THREE_LOAD_FAIL =',await ev('window.__THREE_LOAD_FAIL'));
console.log('--- console/error logs ---');
logs.forEach(l=>console.log(' ',l));
ws.close();process.exit(0);
