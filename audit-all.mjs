// audit-all.mjs — audit menyeluruh: error console, network 404, gambar kosong,
// teks kepotong, elemen hidden yang tampil, overflow. Login user e2e.
const PORT=9334,BASE='http://localhost:4100';
const login=await (await fetch(BASE+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'e2e'+(process.argv[2]||'last'),password:'pass1234'})})).json();
const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE+'/')}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
let id=0;const pending=new Map();const consoleErrs=[];const netFail=[];const consoleAll=[];
const send=(m,p={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.onmessage=ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id);return}
  if(m.method==='Runtime.consoleAPICalled'){const t=(m.params.args||[]).map(a=>a.value||a.description||'').join(' ');consoleAll.push(m.params.type+': '+t);if(m.params.type==='error'||m.params.type==='warning')consoleErrs.push(t)}
  if(m.method==='Network.responseReceived'){const r=m.params.response;if(r.status>=400)netFail.push(r.status+' '+(r.url||'').slice(0,80))}
  if(m.method==='Network.loadingFailed'){netFail.push('FAIL '+(m.params.requestId||'')+' '+(m.params.errorText||''))}
};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
const t0=Date.now();
while(Date.now()-t0<20000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
await new Promise(r=>setTimeout(r,1800));
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
if(login.token){await ev(`localStorage.setItem('lumenvail-auth','${login.token}');location.reload();1`);
  const t1=Date.now();while(Date.now()-t1<15000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
  await new Promise(r=>setTimeout(r,2500));
}

// 1. GAMBAR / BACKGROUND yang gagal (naturalWidth 0 / 404)
const imgAudit=await ev(`(()=>{
  const out=[];
  document.querySelectorAll('img').forEach(im=>{if(im.naturalWidth===0&&im.src)out.push('IMG 404/broken: '+im.src.slice(-40))});
  return out;
})()`);
console.log('\n=== 1. GAMBAR RUSAK (404) ===');
console.log(imgAudit.length?imgAudit.join('\n'):'(tidak ada <img> rusak)');

// 2. Network 404 / loading failed
console.log('\n=== 2. NETWORK 404 / GAGAL ===');
console.log(netFail.length?netFail.filter(x=>!x.includes('favicon')).join('\n'):'(tidak ada 404)');

// 3. Console error / warning
console.log('\n=== 3. CONSOLE ERROR/WARNING ===');
console.log(consoleErrs.length?consoleErrs.slice(0,15).join('\n'):'(bersih)');

// 4. Teks yang kepotong / keluar viewport / overlap tombol
const clip=await ev(`(()=>{
  const out=[],vw=innerWidth,vh=innerHeight;
  // elemen dengan scrollHeight>clientHeight yang disembunyikan (overflow tak terlihat)
  document.querySelectorAll('*').forEach(el=>{
    const cs=getComputedStyle(el);
    if(cs.overflowY==='hidden'||cs.overflowY==='clip'){
      if(el.scrollHeight>el.clientHeight+4){
        const r=el.getBoundingClientRect();
        if(r.width>50&&r.height>20)out.push('CLIPPED: '+el.tagName+'#'+(el.id||'')+' scrollH='+el.scrollHeight+' clientH='+el.clientHeight);
      }
    }
  });
  // teks yang melewati tepi bawah/kanan viewport (bukan yang sengaja scroll)
  const body=document.body;
  return out;
})()`);
console.log('\n=== 4. KONTEN CLIPPED (overflow hidden menyembunyikan konten) ===');
console.log(clip.length?clip.join('\n'):'(tidak ada)');

// 5. Elemen [hidden] yang tetap tampil (display bukan none)
const hidShow=await ev(`(()=>{
  const out=[];
  document.querySelectorAll('[hidden]').forEach(el=>{
    const d=getComputedStyle(el).display;
    if(d!=='none')out.push(el.tagName+'#'+(el.id||'')+' display='+d);
  });
  return out;
})()`);
console.log('\n=== 5. ELEMEN [hidden] YANG TETAP TAMPIL (bug z-index/display) ===');
console.log(hidShow.length?hidShow.join('\n'):'(tidak ada)');

// 6. Riwayat: ukuran card vs isi
const hist=await ev(`(()=>{const c=document.querySelector('.history-card'),h=document.getElementById('historyLog');
  if(!c||!h)return{err:'no hist'};const cr=c.getBoundingClientRect(),hr=h.getBoundingClientRect();
  return{cardH:Math.round(cr.height),histH:Math.round(hr.height),gap:Math.round(cr.height-hr.height),scrollH:h.scrollHeight,clientH:h.clientHeight,rows:document.querySelectorAll('.history-row').length};})()`);
console.log('\n=== 6. RIWAYAT WISH (full atau kepotong) ===');
console.log(JSON.stringify(hist));

// 7. Overlap teks vs tombol wish (area atas)
const ov=await ev(`(()=>{
  const p1=document.getElementById('btnPull1').getBoundingClientRect(),p10=document.getElementById('btnPull10').getBoundingClientRect();
  const W={left:Math.min(p1.left,p10.left),top:Math.min(p1.top,p10.top),right:Math.max(p1.right,p10.right),bottom:Math.max(p1.bottom,p10.bottom)};
  const hits=[];
  for(const n of document.querySelectorAll('.banner-panel *,.topbar *')){
    let t='';for(const c of n.childNodes)if(c.nodeType===3)t+=c.nodeValue;t=t.replace(/\\s+/g,' ').trim();
    if(!t)continue;const b=n.getBoundingClientRect();
    if(b.width<2||b.height<2)continue;
    if(b.left<W.right&&b.right>W.left&&b.top<W.bottom&&b.bottom>W.top)hits.push(t.slice(0,30)+' ['+Math.round(b.top)+'-'+Math.round(b.bottom)+']');
  }
  return {wish:{top:Math.round(W.top),bottom:Math.round(W.bottom)},inside:hits};
})()`);
console.log('\n=== 7. TEKS DI ATAS KOTAK TOMBOL WISH ===');
console.log(JSON.stringify(ov,null,1));

console.log('\n=== CONSOLE SEMUA (sample) ===');
console.log(consoleAll.slice(-10).join('\n')||'(kosong)');
ws.close();process.exit(0);
