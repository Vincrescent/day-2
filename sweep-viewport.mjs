// sweep-viewport.mjs — temukan overlap/clip di BANYAK ukuran viewport (bug visual ukuran-dependent).
// Pakai Emulation.setDeviceMetricsOverride untuk resize satu tab ke banyak ukuran.
const PORT=9334,BASE='http://localhost:4100';
const uname='sweep'+Date.now().toString(36);
const reg=await (await fetch(BASE+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,password:'pass1234'})})).json();
if(!reg.token){console.log('register gagal:',reg.error);process.exit(1)}
const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE+'/')}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
let id=0;const pending=new Map();
const send=(m,p={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id)}};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');await send('Runtime.enable');
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
// load + login
{const t0=Date.now();while(Date.now()-t0<20000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
 await new Promise(r=>setTimeout(r,1500));
 await ev(`localStorage.setItem('lumenvail-auth','${reg.token}');location.reload();1`);
 const t1=Date.now();while(Date.now()-t1<15000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
 await new Promise(r=>setTimeout(r,2500));}

const SIZES=[[1920,1080],[1536,900],[1456,782],[1366,768],[1280,800],[1280,720],[1024,768],[900,700],[390,844],[360,640]];
// probe overlap+clip+history dalam satu eval (dipanggil ulang tiap ukuran)
const PROBE=`(()=>{
  const out={};
  // 1) teks (bukan tombol) yang menabrak kotak tombol wish
  const p1=document.getElementById('btnPull1').getBoundingClientRect(),p10=document.getElementById('btnPull10').getBoundingClientRect();
  const W={left:Math.min(p1.left,p10.left),top:Math.min(p1.top,p10.top),right:Math.max(p1.right,p10.right),bottom:Math.max(p1.bottom,p10.bottom)};
  const hits=[];
  for(const n of document.querySelectorAll('.banner-panel *,.topbar *')){
    if(n.closest('.pull-btn'))continue; // skip teks tombol itu sendiri
    let t='';for(const c of n.childNodes)if(c.nodeType===3)t+=c.nodeValue;t=t.replace(/\\s+/g,' ').trim();
    if(!t)continue;const b=n.getBoundingClientRect();
    if(b.width<2||b.height<2)continue;
    if(b.left<W.right&&b.right>W.left&&b.top<W.bottom&&b.bottom>W.top)hits.push(t.slice(0,26));
  }
  out.wishHits=hits;
  // 2) konten KLI (text/button) di section banner yang ter-clipped (bukan dekorasi)
  const sec=document.getElementById('bannerPanel');
  const clipBot=sec.getBoundingClientRect().bottom;
  const clipped=[];
  sec.querySelectorAll('h1,h2,h3,p,button,span,.banner-tab,.featured-card,.pity-chip,.pull-btn,.banner-timer,.pull-hint').forEach(el=>{
    const r=el.getBoundingClientRect();
    if(r.height<3)return;
    if(r.bottom>clipBot+3)clipped.push(el.tagName+'.'+(typeof el.className==='string'?el.className.slice(0,18):'')+' below='+Math.round(r.bottom-clipBot));
  });
  out.bannerClipped=clipped;
  // 3) elemen [hidden] yang tampil
  const hidBad=[];document.querySelectorAll('[hidden]').forEach(el=>{if(getComputedStyle(el).display!=='none')hidBad.push(el.tagName+'#'+(el.id||''))});
  out.hiddenShown=hidBad;
  // 4) halaman scroll horizontally (overflow X)
  out.overflowX=document.documentElement.scrollWidth-innerWidth;
  // 5) tombol wish terpotong bawah viewport?
  out.wishBelowFold=Math.round(Math.max(p1.bottom,p10.bottom)-innerHeight);
  return out;
})()`;

for(const [w,h] of SIZES){
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<500});
  await new Promise(r=>setTimeout(r,600));
  const r=await ev(PROBE);
  const prob=[];
  if(r.wishHits.length)prob.push('TEXT-NUMPUK-WISH: '+r.wishHits.join(','));
  if(r.bannerClipped.length)prob.push('CLIP-KONTEN: '+r.bannerClipped.join(','));
  if(r.hiddenShown.length)prob.push('HIDDEN-TAMPIL: '+r.hiddenShown.join(','));
  if(r.overflowX>1)prob.push('OVERFLOW-X+'+r.overflowX+'px');
  if(r.wishBelowFold>1)prob.push('WISH-KEBAWAH-FOLD+'+r.wishBelowFold+'px');
  console.log((prob.length?'❌ ':'✅ ')+w+'x'+h+'  '+(prob.length?prob.join(' | '):'bersih'));
}
console.log('\\n(✅ = tidak ada teks menumpuk tombol, tidak ada konten clip, tidak ada overflow-X)');
ws.close();process.exit(0);
