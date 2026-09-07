// probe-cover.mjs — 1) gate tanpa token (fresh) 2) apa yang menutup btnPull1.
const PORT=9334,BASE='http://localhost:4100';
const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE+'/')}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
let id=0;const pending=new Map();
const send=(m,p={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id)}};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');await send('Runtime.enable');
const t0=Date.now();
while(Date.now()-t0<20000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
await new Promise(r=>setTimeout(r,1200));
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;

console.log('=== A) TOKEN LAMA DI PROFILE? ===');
console.log('token tersimpan:',await ev("localStorage.getItem('lumenvail-auth')||'(kosong)'"));

console.log('\n=== B) APA YANG MENUTUPI TITIK TENGAH btnPull1? ===');
const cov=await ev(`(()=>{
  const btn=document.getElementById('btnPull1');
  const r=btn.getBoundingClientRect();
  const cx=Math.round(r.left+r.width/2),cy=Math.round(r.top+r.height/2);
  const el=document.elementFromPoint(cx,cy);
  const chain=[];let n=el;
  while(n&&chain.length<8){chain.push(n.tagName+'#'+(n.id||'')+'.'+(typeof n.className==='string'?n.className:'').slice(0,30));n=n.parentElement}
  return {point:[cx,cy],btnBox:{top:Math.round(r.top),left:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)},el:chain};
})()`);
console.log(JSON.stringify(cov,null,1));

console.log('\n=== C) GATE FRESH: hapus token → reload → overlay harus tampil ===');
await ev("localStorage.removeItem('lumenvail-auth');localStorage.removeItem('lumenveil-state-v2');localStorage.removeItem('lumenveil-rotate-h');1");
await send('Page.reload');
const t1=Date.now();
while(Date.now()-t1<20000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
await new Promise(r=>setTimeout(r,2500));
console.log('overlay hidden (harus false/tampil):',await ev("document.getElementById('authOverlay').hidden"));
console.log('modeBadge:',await ev("(document.getElementById('modeBadge')||{}).textContent"));
ws.close();process.exit(0);
