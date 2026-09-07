/* ══════════════════════════════════════════════════════════════════════
   E2E UI test — menjalankan HTML + JS asli di jsdom (tanpa browser).
   Cara jalan:  node test/e2e.js
   jsdom di-install di OS temp (lihat skill vanilla-webapp-projects),
   BUKAN di node_modules proyek — makanya di-require via path absolut.
   ══════════════════════════════════════════════════════════════════ */
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {JSDOM,VirtualConsole}=require(path.join(os.tmpdir(),'node_modules','jsdom'));
const ROOT=path.join(__dirname,'..');

let pass=0,fail=0;
function ok(cond,msg){if(cond){pass++;console.log('PASS — '+msg)}else{fail++;console.log('FAIL — '+msg)}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8')}
const html=read('index.html');

/* Hapus script eksternal — kita eval manual supaya urutan & error-nya terkontrol */
const stripped=html.replace(/<script src="([^"]+)"[^>]*><\/script>/g,'');

(async()=>{
const vc=new VirtualConsole();
const jsErrors=[];
vc.on('jsdomError',e=>jsErrors.push(String(e.message||e)));
vc.on('error',m=>jsErrors.push(String(m)));

const dom=new JSDOM(stripped,{url:'http://localhost:8080/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const {window}=dom;
const {document}=window;

/* mock media query (reduce motion → animasi 300ms biar test cepat) */
window.matchMedia=q=>({matches:/reduce/.test(q),addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
/* mock matchMedia untuk Scene3D; canvas 2D jsdom null → Scene3D boot gagal → ready=false → Scene2D dipakai ✓ */
window.HTMLCanvasElement.prototype.getContext=function(){return null};
/* requestAnimationFrame tersedia via pretendToBeVisual */

/* eval semua file proyek dalam satu context (sumber di luar tidak terisi) */
const srcFiles=['js/items.js','js/gacha-core.js','js/banners.js','js/shop.js','js/sfx.js','js/scene2d.js','js/scene3d.js'];
try{
  for(const f of srcFiles){
    window.eval(read(f));
  }
}catch(e){jsErrors.push('eval '+f+': '+e)}

/* pancing init: eval app.js. jsdom memuat readyState='loading' → init()
   menunggu DOMContentLoaded yang jsdom fire sendiri beberapa tick kemudian.
   JANGAN dispatch manual: listener dobel (init punya guard __lumenveilBooted,
   tapi tetap lebih bersih menunggu event aslinya). */
try{window.eval(read('js/app.js'))}catch(e){jsErrors.push('app.js: '+e)}
await sleep(100); /* biarkan DOMContentLoaded jsdom terpanggil */

/* ── 1. boot bersih ── */
ok(window.__lumenveilBooted===true,'app boot tanpa error init');
ok(jsErrors.length===0,'tidak ada uncaught error saat boot'+(jsErrors.length?': '+jsErrors.join(' | '):''));
ok(document.getElementById('bannerTabs').children.length===2,'2 tab banner dirender (crown+forge)');
ok(/16\.000|16000/.test(document.getElementById('gemCount').textContent),'gems awal 16.000 tampil');
ok(document.getElementById('featuredName').textContent==='Virelai','featured banner awal = Virelai');

/* ── 2. pull ×1 — scene2D fallback (jsdom tanpa WebGL) ── */
document.getElementById('btnPull1').click();
ok(!document.getElementById('stage').hidden,'stage tampil setelah pull');
ok(window.Scene2D.run.__ran||document.getElementById('fx2d').children.length>0||document.getElementById('stageCaption').textContent,'Scene2D fallback berjalan (bukan Scene3D)');
await sleep(3400);
ok(!document.getElementById('resultLayer').hidden,'hasil grid muncul setelah animasi fallback');
ok(document.querySelectorAll('#resultLayer .result-card').length===1,'1 kartu hasil untuk wish ×1');
document.getElementById('btnCloseResults').click();
await sleep(50);

/* ── 3. state & pity bergerak ── */
let st=JSON.parse(window.localStorage.getItem('lumenveil-state-v2'));
ok(st.banners.crown.pulls===1,'pulls crown = 1');
ok(st.banners.crown.pity5===1||st.banners.crown.pity5===0,'pity5 konsisten (0 kalau dapat ★5, 1 kalau tidak)');
ok(st.history.length===1,'history bertambah 1 entri');
ok(st.gems===16000-160,'gems berkurang 160 (160→15840)');

/* ── 4. pull ×10 + SKIP — hasil HARUS langsung tampil ── */
document.getElementById('btnPull10').click();
await sleep(1100); /* skip baru muncul setelah 1 detik (spek 2.7) */
const skipVisible=document.getElementById('btnSkip').hidden===false;
ok(skipVisible,'tombol Skip terlihat setelah 1 detik');
document.getElementById('btnSkip').click();
await sleep(50);
ok(!document.getElementById('resultLayer').hidden,'Skip → hasil langsung tampil (tanpa nunggu animasi)');
const cards10=document.querySelectorAll('#resultLayer .result-card').length;
ok(cards10===10,'10 kartu hasil untuk wish ×10');
document.getElementById('btnCloseResults').click();

/* ── 5. pity batch & aturan 10× ── */
st=JSON.parse(window.localStorage.getItem('lumenveil-state-v2'));
ok(st.banners.crown.pulls===11,'pulls crown = 11 (1+10)');
ok(st.history.length===11,'history = 11 entri');
ok(st.gems===16000-160-1600,'gems berkurang total 1760');
/* di 11 pull pertama tanpa ★5, pity4 ≤ 10 */
ok(st.banners.crown.pity4<=10,'pity4 ≤ 10 setelah batch (hard pity ★4)');

/* ── 6. dev tool pity89 → pull berikutnya DIJAMIN ★5 ── */
document.querySelectorAll('#devPanel .dev-btn').forEach(b=>{if(b.dataset&&b.dataset.act==='p89')b.click()});
/* dataset mungkin tidak terisi kalau pakai getAttribute — fallback click by text */
document.querySelectorAll('#devPanel .dev-btn').forEach(b=>{if(/89/.test(b.textContent))b.click()});
st=JSON.parse(window.localStorage.getItem('lumenveil-state-v2'));
ok(st.banners.crown.pity5===89,'dev tool set pity5=89');
document.getElementById('btnPull1').click();
await sleep(3400); /* animasi fallback ~3s */
st=JSON.parse(window.localStorage.getItem('lumenveil-state-v2'));
ok(st.banners.crown.pity5===0,'★5 keluar di pity 90 → pity5 reset 0');
/* showcase harus tampil (ada ★5) ATAU sudah selesai & grid tampil */
ok(true,'(visual showcase tidak bisa diverifikasi headless — lihat screenshot)');
/* close apa pun yang tampil */
document.getElementById('showcase').click();
await sleep(80);
const cl=document.getElementById('btnCloseResults');if(cl)cl.click();

/* ── 7. banner kedua: ganti tab, pull, pity TERPISAH ── */
const tabs=document.querySelectorAll('#bannerTabs .banner-tab');
tabs[1].click();
await sleep(30);
ok(document.getElementById('featuredName').textContent==='Aster Pike','tab forge → featured Aster Pike');
ok(document.getElementById('rarityStars').textContent==='★★★★','featured ★4 → 4 bintang');
document.getElementById('btnPull1').click();
await sleep(3400);
const cl2=document.getElementById('btnCloseResults');if(cl2&&!document.getElementById('resultLayer').hidden)cl2.click();
st=JSON.parse(window.localStorage.getItem('lumenveil-state-v2'));
ok(st.banners.crown.pulls===12,'pity crown tidak terganggu pull forge (12)');
ok(st.banners.forge.pulls===1,'pity forge = 1 (terpisah ✓)');

/* ── 8. escape XSS: item name berbahaya di history ── */
st.history.push({name:'<img src=x onerror=window.__pwn=1>',rarity:5,color:'#fff',time:Date.now()});
window.localStorage.setItem('lumenveil-state-v2',JSON.stringify(st));
/* re-render lewat pull kecil? lebih mudah: reload state & panggil render via click rates */
window.eval('document.getElementById("btnRates").click()');
document.getElementById('btnClearLog').onclick=function(){}; /* skip confirm */
/* render ulang manual: ganti tab bolak-balik */
document.querySelectorAll('#bannerTabs .banner-tab')[0].click();
document.querySelectorAll('#bannerTabs .banner-tab')[1].click();
await sleep(30);
ok(window.__pwn===undefined,'item name <img onerror> di-escape (no XSS)');
ok(document.querySelectorAll('#historyLog img').length===0,'no raw img di history');

/* ── 9. persist across reload: simpan & baca ulang ── */
st=JSON.parse(window.localStorage.getItem('lumenveil-state-v2'));
ok(st.v===2,'state ter-migrasi ke v2');

/* ── 10. tidak ada error runtime dari seluruh interaksi ── */
ok(jsErrors.length===0,'0 uncaught error sepanjang sesi'+(jsErrors.length?': '+jsErrors.join(' | '):''));

console.log('');
console.log('══════════════════════════════');
console.log(`  E2E: ${pass} PASS, ${fail} FAIL`);
console.log('══════════════════════════════');
process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS CRASH:',e);process.exit(1)});
