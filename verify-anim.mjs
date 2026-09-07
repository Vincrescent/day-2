// verify-anim.mjs — cek computed display stage saat pull (bug display:none root cause).
const PORT=9334,BASE='http://localhost:4100';
const uname='vanim'+Date.now().toString(36);
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

// state sebelum pull
console.log('SEBELUM PULL — stage computed display:',await ev("getComputedStyle(document.getElementById('stage')).display"));
// PULL 1X
await ev("document.getElementById('btnPull1').click();1");
// sampel computed display tiap 400ms selama ~6s (animasi 4.4s + buffer)
for(let i=1;i<=15;i++){
  await new Promise(r=>setTimeout(r,400));
  const s=await ev(`(()=>{const st=document.getElementById('stage');const rl=document.getElementById('resultLayer');const sh=document.getElementById('showcase');
    return {stage:getComputedStyle(st).display, rl:getComputedStyle(rl).display, show:getComputedStyle(sh).display, cards:document.querySelectorAll('.result-card').length, gl:!!(document.getElementById('gl').getContext('webgl')||document.getElementById('gl').getContext('experimental-webgl'))};})()`);
  console.log('['+(i*0.4).toFixed(1)+'s] stage='+s.stage+' resultLayer='+s.rl+' showcase='+s.show+' cards='+s.cards+' webgl='+s.gl);
  if(s.cards>=1)break;
}
console.log('\nERRORS:',errs.length?errs.join(' | ').slice(0,300):'(none)');
ws.close();process.exit(0);
