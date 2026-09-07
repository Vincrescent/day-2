// debug-anim.mjs — jalankan pull 1x, pantau exception + state Scene3D.
const PORT=9334,BASE='http://localhost:4100';
const uname='danim'+Date.now().toString(36);
const reg=await (await fetch(BASE+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,password:'pass1234'})})).json();
if(!reg.token){console.log('register gagal:',reg.error);process.exit(1)}
const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE+'/')}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
let id=0;
const pending=new Map();
const errs=[];
const logs=[];
const warns=[];
const send=(m,p={})=>new Promise(res=>{
  const i=++id;
  pending.set(i,res);
  ws.send(JSON.stringify({id:i,method:m,params:p}));
});
ws.onmessage=ev=>{
  const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){
    pending.get(m.id)(m.result||{});
    pending.delete(m.id);
    return;
  }
  if(m.method==='Runtime.consoleAPICalled'){
    const t=(m.params.args||[]).map(a=>a.value||a.description||'').join(' ');
    if(m.params.type==='error')errs.push(t);
    else if(m.params.type==='warning')warns.push(t);
    else logs.push(t.slice(0,120));
  }
};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');
await send('Runtime.enable');
const t0=Date.now();
while(Date.now()-t0<20000){
  const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});
  if(rs.result&&rs.result.value==='complete')break;
  await new Promise(r=>setTimeout(r,300));
}
await new Promise(r=>setTimeout(r,1800));
const ev=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
await ev(`localStorage.setItem('lumenvail-auth','${reg.token}');location.reload();1`);
{
  const tx=Date.now();
  while(Date.now()-tx<15000){
    const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});
    if(rs.result&&rs.result.value==='complete')break;
    await new Promise(r=>setTimeout(r,300));
  }
  await new Promise(r=>setTimeout(r,2500));
}
console.log('=== BOOT ===');
console.log('Scene3D.ready:',await ev('!!window.Scene3D'));
console.log('THREE loaded:',await ev('!!window.THREE'));
console.log('mode:',await ev("MODE||'undefined'"));
console.log('token present:',!!(await ev("localStorage.getItem('lumenvail-auth')")));
console.log('\n=== PULL 1X VIA UI ===');
await ev("document.getElementById('btnPull1').click();1");
for(let i=0;i<10;i++){
  await new Promise(r=>setTimeout(r,750));
  const glEl=document.getElementById('gl');
  const ctx=glEl?.getContext('webgl')||glEl?.getContext('experimental-webgl');
  console.log('  ['+Math.round((i+1)*0.75)+'s] stage.hidden='+String(await ev("document.getElementById('stage').hidden"))+' canvasCtx='+(ctx?'webgl':'none')+' resultLayer.hidden='+String(await ev("document.getElementById('resultLayer').hidden"))+' cards='+String(await ev("document.querySelectorAll('.result-card').length")));
}
console.log('\n=== ERRORS during animation ===');
console.log(errs.length?errs.join('\n'):'(tidak ada exception)');
console.log('\n=== WARNINGS ===');
console.log(warns.length?warns.join('\n'):'(tidak ada)');
ws.close();
process.exit(0);
