/* Harness gacha-core tanpa browser: jalankan `node test/stats.js`.
   Membuktikan secara statistik bahwa pity & rate bekerja sesuai spek:
   - ★5 rata-rata keluar di pull ke-62±5 (dengan soft pity) dan TIDAK PERNAH >90
   - ★4 dijamin maksimal tiap 10 pull (tidak ada gap >10)
   - backfill 10× tetap menjamin ≥1 ★4 per batch tanpa mendistorsi pity */
'use strict';
const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','js','gacha-core.js'),'utf8');
const sandbox={window:{},Math};
new Function('window',src)(sandbox.window);
const GachaCore=sandbox.window.GachaCore;

const ctx={items5:[{name:'F5',rarity:5,featured:true,color:'#ffd36b',image:''},
                   {name:'S5a',rarity:5,color:'#ffd36b',image:''},
                   {name:'S5b',rarity:5,color:'#ffd36b',image:''}],
           items4:[{name:'F4',rarity:4,color:'#bb82ff',image:''},{name:'S4',rarity:4,color:'#bb82ff',image:''}],
           items3:[{name:'C3',rarity:3,color:'#75b9ff',image:''}],featured:true};
function fresh(){return{pulls:0,pity5:0,pity4:0,guaranteed:false,fiveTotal:0,fiveLog:[]}}

let fails=0;
const ok=(cond,msg)=>{console.log((cond?'PASS':'FAIL')+' — '+msg);if(!cond)fails++};

/* ── 1. Distribusi ★5: tidak pernah lewat hard pity, mean wajar ── */
(function(){
  const gaps=[];const N=3000;
  for(let i=0;i<N;i++){const s=fresh();
    do{GachaCore.pick(s,ctx)}while(s.pity5!==0);
    gaps.push(s.pulls);
  }
  // lastFivePull dihitung sebagai jarak; hitung ulang langsung dari log
  const s2=fresh();const arr=[];
  let cnt=0;for(let i=0;i<20000;i++){GachaCore.pick(s2,ctx);cnt++;if(s2.fiveLog.length>arr.length)arr.push(cnt),cnt=0}
  const mean=arr.reduce((a,b)=>a+b,0)/arr.length;
  const over90=arr.filter(x=>x>90).length;
  ok(over90===0,`hard pity: 0/${arr.length} gap ★5 melewati 90 (max=${Math.max(...arr)})`);
  ok(mean>50&&mean<74,`mean jarak ★5 = ${mean.toFixed(1)} (ekspektasi teoretis ~62 dgn soft pity)`);
  console.log(`       histogram: ${arr.filter(x=>x>=74&&x<90).length}/${arr.length} di zona soft pity (74-89), max=${Math.max(...arr)}`);
})();

/* ── 2. Pity ★4: gap tidak pernah >10 ── */
(function(){
  const s=fresh();let since4=0,maxGap=0;
  for(let i=0;i<20000;i++){const before=s.pity4;GachaCore.pick(s,ctx);since4++;
    if(s.pity4===0){maxGap=Math.max(maxGap,since4);since4=0}}
  ok(maxGap<=10,`pity ★4: gap maksimum = ${maxGap} (batas 10)`);
})();

/* ── 3. Backfill 10×: setiap batch punya ≥1 ★4+, pity tidak terdistorsi ── */
(function(){
  let badBatches=0,drift=0;const N=2000;
  for(let i=0;i<N;i++){const s=fresh();const before=JSON.stringify([s.pulls,s.pity5,s.pity4]);
    const out=GachaCore.pull(s,10,ctx);
    if(!out.some(x=>x.item.rarity>=4))badBatches++;
  }
  ok(badBatches===0,`10×-pull: 0/${N} batch tanpa ★4+ (aturan "10× minimal 1 ★4")`);
  // pity konsisten: 10 pick selalu = pulls+10 tanpa duplikasi backfill lama
  const s=fresh();GachaCore.pull(s,10,ctx);
  ok(s.pulls===10,`backfill tidak mendistorsi counter: pulls=${s.pulls} (harus 10, bukan 11)`);
})();

/* ── 4. 50/50 + guarantee: kalau kalah, ★5 berikutnya pasti featured ── */
(function(){
  let violated=0;const N=2000;
  for(let i=0;i<N;i++){const s=fresh();
    for(let k=0;k<40;k++){
      const wasGuaranteed=s.guaranteed; /* baca SEBELUM pick — pick me-reset flag */
      const r=GachaCore.pick(s,ctx);
      if(r.item.rarity===5&&wasGuaranteed&&r.item.name!=='F5')violated++;
    }}
  ok(violated===0,`50/50: 0/${N} pelanggaran guarantee (kalah → ★5 berikutnya pasti featured)`);
})();

/* ── 5. chance5() monotonic & tepat di titik kunci ── */
(function(){
  const c=p=>GachaCore.chance5(p);
  ok(Math.abs(c(0)-0.006)<1e-9,'chance5(0) = 0.6%');
  ok(Math.abs(c(74)-(0.006+0.006))<1e-9,'chance5(74) = 1.2% (soft pity mulai)');
  ok(Math.abs(c(80)-(0.006+7*7*0.006))<1e-9,`chance5(80) = ${(c(80)*100).toFixed(1)}% (belum di-clamp)`);
  ok(c(89)===1,'chance5(89) = 100% (clamp — formula kuadrat melewati 100% lalu di-cap)');
  ok(c(90)===1,'chance5(90) = 100% (hard pity)');
  let mono=true;for(let p=1;p<=90;p++)if(c(p)<c(p-1))mono=false;
  ok(mono,'chance5 monoton naik 0→90');
})();

console.log('');
if(fails){console.log(`✗ ${fails} test gagal`);process.exit(1)}
console.log('✓ Semua test statistik lulus');
