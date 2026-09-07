// probe-cover2.mjs — kenapa elementFromPoint null di tengah btnPull1?
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
await new Promise(r=>setTimeout(r,3000));
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;

console.log('viewport:',await ev("innerWidth+'x'+innerHeight"));
console.log('scroll:',await ev('scrollY'));
console.log('stage hidden:',await ev("document.getElementById('stage').hidden"),
  '| stage computed display:',await ev("getComputedStyle(document.getElementById('stage')).display"));
console.log('btnPull1 box:',JSON.stringify(await ev(`(()=>{const r=document.getElementById('btnPull1').getBoundingClientRect();return{top:Math.round(r.top),left:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height)}})()`)));
const probe=await ev(`(()=>{
  const btn=document.getElementById('btnPull1');
  const r=btn.getBoundingClientRect();
  const cx=Math.round(r.left+r.width/2),cy=Math.round(r.top+r.height/2);
  const pts=[[cx,cy],[Math.round(r.left+5),Math.round(r.top+5)],[Math.round(r.right-5),Math.round(r.bottom-5)]];
  const out=pts.map(([x,y])=>{
    const el=document.elementFromPoint(x,y);
    if(!el)return {x,y,el:'NULL'};
    let n=el,chain=[];
    for(let i=0;i<6&&n;i++){chain.push(n.tagName+(n.id?'#'+n.id:'')+'.'+(typeof n.className==='string'?n.className:'').slice(0,25));n=n.parentElement}
    return {x,y,chain};
  });
  const btnVisible=btn.checkVisibility?btn.checkVisibility():'n/a';
  return {out,btnVisible,btnInFlow:btn.offsetParent!==null};
})()`);
console.log(JSON.stringify(probe,null,1));
ws.close();process.exit(0);
