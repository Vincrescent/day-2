// audit-detail.mjs — cek clipped content + network failure detail.
const PORT=9334,BASE='http://localhost:4100';
const uname='audit'+Date.now().toString(36);
const reg=await (await fetch(BASE+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,password:'pass1234'})})).json();
if(!reg.token){console.log('register gagal:',reg.error);process.exit(1)}
const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE+'/')}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
let id=0;const pending=new Map();const netFail=[];const consoleErrs=[];const consoleAll=[];
const send=(m,p={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.onmessage=ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id);return}
  if(m.method==='Runtime.consoleAPICalled'){const t=(m.params.args||[]).map(a=>a.value||a.description||'').join(' ');consoleAll.push(m.params.type+': '+t);if(m.params.type==='error'||m.params.type==='warning')consoleErrs.push(t)}
  if(m.method==='Network.loadingFailed'){netFail.push(JSON.stringify({id:m.params.requestId,url:(m.params.failedRequest?.url||''),error:m.params.errorText,time:m.params.time?.timeStamp}))}
  if(m.method==='Network.responseReceived'&&m.params.response.status>=400){netFail.push('HTTP '+m.params.response.status+' '+((m.params.response.url)||'').slice(-80))}
};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
const t0=Date.now();
while(Date.now()-t0<20000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
await new Promise(r=>setTimeout(r,1800));
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
if(reg.token){await ev(`localStorage.setItem('lumenvail-auth','${reg.token}');location.reload();1`);
  const t1=Date.now();while(Date.now()-t1<15000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
  await new Promise(r=>setTimeout(r,2500));
}

// DETAIL CLIPPED: apa saja yang tersembunyi di dalam bannerPanel?
const clippedDetail=await ev(`(()=>{
  const sec=document.getElementById('bannerPanel');
  if(!sec)return{err:'no bannerPanel'};
  const cs=getComputedStyle(sec);
  const children=Array.from(sec.querySelectorAll('*')).filter(el=>{
    const r=el.getBoundingClientRect();
    return r.height>5&&r.width>5;
  });
  // cari elemen yang bagian bawahnya melewati batas bawah section
  const clipBot=sec.getBoundingClientRect().bottom;
  const hidden=children.filter(el=>{
    const r=el.getBoundingClientRect();
    return r.bottom>clipBot+5&&el.offsetParent===sec; // anak langsung atau tidak langsung
  });
  // juga ambil elemen terakhir 10px di atas clipBot
  const near=children.filter(el=>{
    const r=el.getBoundingClientRect();
    return Math.abs(r.bottom-clipBot)<50;
  }).sort((a,b)=>b.getBoundingClientRect().bottom-a.getBoundingClientRect().bottom).slice(0,5);
  return {
    clipBox:{top:Math.round(sec.getBoundingClientRect().top),bottom:Math.round(clipBot),height:Math.round(sec.getBoundingClientRect().height)},
    hiddenElems:hidden.map(el=>el.tagName+(el.id?'#'+el.id:'')+'.'+(typeof el.className==='string'?el.className.slice(0,25):'')+' bottom='+Math.round(el.getBoundingClientRect().bottom)),
    nearElems:near.map(el=>el.tagName+(el.id?'#'+el.id:'')+'.'+(typeof el.className==='string'?el.className.slice(0,25):'')+' bottom='+Math.round(el.getBoundingClientRect().bottom))
  };
})()`);
console.log('=== CLIPPED DETAIL ===');
console.log(JSON.stringify(clippedDetail,null,1));

// Network fail detail
console.log('\n=== NETWORK FAIL (full) ===');
console.log(netFail.length?netFail.join('\n'):'(tidak ada)');

// Console errors
console.log('\n=== CONSOLE ERRORS ===');
console.log(consoleErrs.length?consoleErrs.join('\n'):'(bersih)');

ws.close();process.exit(0);
