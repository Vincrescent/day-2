// e2e-lv.mjs — E2E headless (Edge 9334, 1456x782): register → pull → tutup → verifikasi.
import fs from'node:fs';
const PORT=9334,BASE='http://localhost:4100';
const j=async(p,o)=>{const r=await fetch(BASE+p,o);let d;try{d=await r.json()}catch(e){d={parse_error:1}};return{status:r.status,d}};
const P=[];let fail=0;
const T=(name,cond,extra='')=>{P.push((cond?'PASS':'FAIL')+' | '+name+(extra?' — '+extra:''));if(!cond)fail++};

/* 1. register akun fresh */
const uname='e2e'+Date.now().toString(36);
const reg=await j('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,password:'pass1234'})});
T('register',reg.status===200&&reg.d.token,JSON.stringify(reg.d).slice(0,80));
const TOK=reg.d.token;
const H={'Content-Type':'application/json',Authorization:'Bearer '+TOK};
const me0=await j('/api/me',{headers:H});
T('me awal: gems=16000',me0.status===200&&me0.d.user.gems===16000,'');

/* 2. pull 10x via API (server-side) */
const pull=await j('/api/pull',{method:'POST',headers:H,body:JSON.stringify({n:10,banner:'crown'})});
T('pull 10x',pull.status===200&&pull.d.results.length===10,JSON.stringify(pull.d.error||''));
T('pull: gems 14400',pull.d.gems===14400,'');
T('pull: ada >=1 bintang4',pull.d.results.some(r=>r.rarity>=4),'');
/* 3. dup & owned benar */
const me1=await j('/api/me',{headers:H});
T('me: owned bukan null & terisi',me1.d.user.owned&&Object.keys(me1.d.user.owned).length>0,JSON.stringify(me1.d.user.owned).slice(0,80));
T('me: history=10',me1.d.history.length===10,'');

/* 4. UI via CDP */
const ver=await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE+'/')}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
let id=0;const pending=new Map();
const send=(m,p={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id)}};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');await send('Runtime.enable');
const evs=[];
ws.onmessage=ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id)}
  else if(m.method==='Runtime.exceptionThrown'){
    const ex=m.params.exceptionDetails;
    const frame=(ex.stackTrace&&ex.stackTrace.callFrames&&ex.stackTrace.callFrames[0])||{};
    evs.push('EXC line'+ex.lineNumber+': '+(ex.exception&&ex.exception.description||'').slice(0,600)+' @'+(frame.functionName||'')+' '+(frame.url||'').split('/').pop()+':'+frame.lineNumber);}
  else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')evs.push('console.error: '+m.params.args.map(a=>a.value||a.description||'').join(' ').slice(0,200));
};
const t0=Date.now();
while(Date.now()-t0<20000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
await new Promise(r=>setTimeout(r,1500));

const ev=(expr)=>send('Runtime.evaluate',{expression:expr,returnByValue:true}).then(r=>r.result?r.result.value:undefined);

// 4a. login via UI
T('UI: boot',await ev('!!window.__lumenveilBooted')===true);
T('UI: mode ONLINE',String(await ev("(document.getElementById('modeBadge')||{}).textContent")).includes('ONLINE'));
await new Promise(r=>setTimeout(r,1500)); /* gate muncul 400ms setelah health OK */
/* pastikan fresh: hapus token lama di profile supaya gate benar-benar terlihat */
await ev("localStorage.removeItem('lumenvail-auth');1");
await ev("location.reload();'reloaded'");
const t2=Date.now();while(Date.now()-t2<15000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
await new Promise(r=>setTimeout(r,1800));
T('UI: mode ONLINE (fresh)',String(await ev("(document.getElementById('modeBadge')||{}).textContent")).includes('ONLINE'));
T('UI: auth overlay tampil (belum login) — fresh',await ev("!document.getElementById('authOverlay').hidden")===true);
await ev(`document.getElementById('authUsername').value='${uname}';document.getElementById('authPassword').value='pass1234';document.getElementById('authForm').dispatchEvent(new Event('submit',{cancelable:true}));'ok'`);
await new Promise(r=>setTimeout(r,2500));
T('UI: overlay hilang setelah login',await ev("document.getElementById('authOverlay').hidden")===true);
T('UI: gems dari server (14400)',String(await ev("document.getElementById('gemCount').textContent")).replace(/\./g,'').includes('14400'),String(await ev("document.getElementById('gemCount').textContent")));
T('UI: history terisi 10 baris',await ev("document.querySelectorAll('.history-row').length")===10,'');

// 4b. pull 10x lagi via UI (offline? no — online)
await ev("document.getElementById('btnPull10').click();'ok'");
await new Promise(r=>setTimeout(r,1200));
T('UI: stage terbuka',await ev("!document.getElementById('stage').hidden")===true);
// skip animasi
await ev("document.getElementById('btnSkip').click();'ok'");
await new Promise(r=>setTimeout(r,1200));
T('UI: result layer tampil',await ev("!document.getElementById('resultLayer').hidden")===true);
T('UI: 10 kartu hasil',await ev("document.querySelectorAll('.result-card').length")===10,'');
// 4c. TUTUP → kembali ke banner (BUG REPORTED)
await ev("document.getElementById('btnCloseResults').click();'ok'");
await new Promise(r=>setTimeout(r,800));
T('UI: stage tertutup setelah close',await ev("document.getElementById('stage').hidden")===true);
T('UI: result layer tertutup',await ev("document.getElementById('resultLayer').hidden")===true);
T('UI: showcase tertutup',await ev("document.getElementById('showcase').hidden")===true);
const wishClickable=async()=>{
  await ev(`document.getElementById('btnPull1').scrollIntoView({block:'center'});1`);
  await new Promise(r=>setTimeout(r,300));
  return await ev(`(()=>{
    const r=document.getElementById('btnPull1').getBoundingClientRect();
    const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return el&&(el.id==='btnPull1'||el.closest('#btnPull1'))})()`)===true;
};
T('UI: banner tombol wish bisa diklik (stage tidak menumpuk)',await wishClickable());
T('UI: history jadi 20 baris',await ev("document.querySelectorAll('.history-row').length")===20,String(await ev("document.querySelectorAll('.history-row').length")));
T('UI: gems 12800',String(await ev("document.getElementById('gemCount').textContent")).replace(/\./g,'').includes('12800'),String(await ev("document.getElementById('gemCount').textContent")));

// 4d. RIWAYAT FULL (fix cek): area scroll history memenuhi card
const mH=await ev(`(()=>{const c=document.querySelector('.history-card'),h=document.getElementById('historyLog');
const cr=c.getBoundingClientRect(),hr=h.getBoundingClientRect();
return{cardH:Math.round(cr.height),histH:Math.round(hr.height),gap:Math.round(cr.bottom-hr.bottom-40),scrollH:h.scrollHeight,clientH:h.clientHeight}})()`);
T('UI: riwayat area ≈ tinggi card (gap<60px)',mH&&mH.gap<60,JSON.stringify(mH));

// 4e. OVERLAP AUDIT vs tombol wish di 1456x782
const ov=await ev(`(()=>{
function box(el){const r=el.getBoundingClientRect();return{top:r.top,left:r.left,right:r.right,bottom:r.bottom}}
const p1=box(document.getElementById('btnPull1')),p10=box(document.getElementById('btnPull10'));
const W={left:Math.min(p1.left,p10.left),top:Math.min(p1.top,p10.top),right:Math.max(p1.right,p10.right),bottom:Math.max(p1.bottom,p10.bottom)};
const hits=[];
for(const n of document.querySelectorAll('.topbar *,.banner-panel *')){
  let t='';for(const c of n.childNodes)if(c.nodeType===3)t+=c.nodeValue;t=t.replace(/\\s+/g,' ').trim();
  if(!t)continue;const b=box(n);
  if(b.left<W.right&&b.right>W.left&&b.top<W.bottom&&b.bottom>W.top)hits.push(t.slice(0,30)+'['+Math.round(b.top)+','+Math.round(b.bottom)+']');
}
const hint=box(document.getElementById('pullHint'));
return{hits:hits.filter(h=>!h.startsWith('Wish ')&&!h.startsWith('160')&&!h.startsWith('1600')&&!h.startsWith('+1')),hintTop:Math.round(hint.top),wishTop:Math.round(W.top)};
})()`);
T('UI: TIDAK ADA teks lain yang menabrak tombol wish',ov&&ov.hits.length===0,JSON.stringify(ov));

// 4f. banner timer rotasi jam
const timer=String(await ev("document.getElementById('bannerTimer').textContent"));
T('UI: banner timer tampil hitung mundur',/Berakhir dalam .*\d+m/.test(timer),timer);

// 4g. reload → auto-login (state server langsung, tanpa overlay)
await send('Page.reload');
const t1=Date.now();
while(Date.now()-t1<20000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
await new Promise(r=>setTimeout(r,3000));
T('UI: setelah reload, overlay TIDAK muncul (auto-login)',await ev("document.getElementById('authOverlay').hidden")===true);
T('UI: setelah reload, gems masih 12800',String(await ev("document.getElementById('gemCount').textContent")).replace(/\./g,'').includes('12800'),String(await ev("document.getElementById('gemCount').textContent")));
T('UI: setelah reload, history 20 baris',await ev("document.querySelectorAll('.history-row').length")===20,String(await ev("document.querySelectorAll('.history-row').length")));

P.push('JS EXCEPTIONS: '+(evs.length?evs.map(s=>s.replace(/\\n/g,' ')).join(' || ').slice(0,2000):'none'));
if(evs.length)fail++;

/* screenshot final (viewport 1456x782) */
try{
  const s=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:1456,height:782,scale:1}});
  fs.writeFileSync('C:/Users/M S I/AppData/Local/Temp/lv-e2e-1456.png',Buffer.from(s.data,'base64'));
  P.push('SHOTS: temp/lv-e2e-1456.png (viewport 1456x782)');
}catch(e){P.push('screenshot gagal: '+e.message)}
console.log(P.join('\n'));
console.log('\n===== E2E: '+(fail?fail+' FAIL':'ALL PASS')+' =====');
ws.close();process.exit(0);
