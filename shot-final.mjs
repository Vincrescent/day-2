// shot-final.mjs — screenshot bersih halaman utama (login user e2e terakhir) di 1456x782.
const PORT=9334,BASE='http://localhost:4100';
const j=async(p,o)=>{const r=await fetch(BASE+p,o);return{status:r.status,d:await r.json().catch(()=>({}))};};
const login=await j('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'e2e'+process.env.u,password:'pass1234'})});
const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE+'/')}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
let id=0;const pending=new Map();
const send=(m,p={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id)}};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');await send('Runtime.enable');
const t0=Date.now();
while(Date.now()-t0<20000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
await new Promise(r=>setTimeout(r,1500));
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
// login via localStorage token
if(login.d.token){await ev(`localStorage.setItem('lumenvail-auth','${login.d.token}');location.reload();1`);
  const t1=Date.now();while(Date.now()-t1<15000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
  await new Promise(r=>setTimeout(r,2500));
}
await ev("window.scrollTo(0,0);1");
await new Promise(r=>setTimeout(r,600));
const gem=await ev("document.getElementById('gemCount').textContent");
const rows=await ev("document.querySelectorAll('.history-row').length");
console.log('logged-in gems:',gem,'| history rows:',rows);
// full-page screenshot
const met=await send('Page.getLayoutMetrics');
const w=Math.min(1456,Math.ceil(met.cssContentSize?.width||1456)),h=Math.ceil(met.cssContentSize?.height||1400);
const s=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:w,height:Math.min(h,1600),scale:1}});
const fs=await import('node:fs');
fs.writeFileSync('C:/Users/M S I/AppData/Local/Temp/lv-final-full.png',Buffer.from(s.data,'base64'));
console.log('SAVED temp/lv-final-full.png',w+'x'+Math.min(h,1600));
// top-area overlap check (text di atas vs tombol wish)
const ov=await ev(`(()=>{
  const p1=document.getElementById('btnPull1').getBoundingClientRect(),p10=document.getElementById('btnPull10').getBoundingClientRect();
  const W={left:Math.min(p1.left,p10.left),top:Math.min(p1.top,p10.top),right:Math.max(p1.right,p10.right),bottom:Math.max(p1.bottom,p10.bottom)};
  const hits=[];
  for(const n of document.querySelectorAll('.topbar *,.banner-panel *')){
    let t='';for(const c of n.childNodes)if(c.nodeType===3)t+=c.nodeValue;t=t.replace(/\\s+/g,' ').trim();
    if(!t)continue;const b=n.getBoundingClientRect();
    if(b.width<2)continue;
    if(b.left<W.right&&b.right>W.left&&b.top<W.bottom&&b.bottom>W.top)hits.push(t.slice(0,28));
  }
  return {wishBox:{top:Math.round(W.top),bottom:Math.round(W.bottom)},insideText:hits};
})()`);
console.log('OVERLAP:',JSON.stringify(ov));
ws.close();process.exit(0);
