/* ══════════════════════════════════════════════════════════════════════
   GACHA CORE — logika probabilitas & pity (banner-agnostic).
   state `s` = {pulls, pity5, pity4, guaranteed, fiveTotal, fiveLog, lastFivePull, featuredWon}
   ctx       = {items5:[...], items4:[...], items3:[...], featured:boolean}
   Tiap banner memanggil pick()/pull() dengan ctx pool-nya sendiri,
   jadi pity antar-banner terpisahkan TANPA menyentuh logika di sini.
   ══════════════════════════════════════════════════════════════════════ */
(function(){'use strict';

/* ── Konstanta (ubah di sini, panel rate & statistik membaca dari RATES) ──
   RATE_5   : peluang dasar ★5 (0.6%)
   RATE_4   : peluang dasar ★4 (5.1%)
   SOFT_PITY: mulai pull ke-74 peluang ★5 naik tajam
   HARD_PITY: pull ke-90 DIJAMIN ★5
   HARD_PITY4: pull ke-10 DIJAMIN ★4+ (counter reset tiap dapat 4★/5★)
   Rumus soft pity (bentuk kuadrat, di-clamp maksimum 100%):
     p(pity) = min(1, RATE_5 + (pity-73)^2 * SOPE_EXP)
     pity 74 → 1.2% · pity 80 → 30% · pity 89 → 100%  */
var RATE_5=0.006, RATE_4=0.051,
    SOFT_PITY=74, HARD_PITY=90, HARD_PITY4=10, SOPE_EXP=0.006;

function chance5(pity5){
  if(pity5>=HARD_PITY) return 1;                                   // hard pity
  if(pity5>=SOFT_PITY) return Math.min(1,RATE_5+Math.pow(pity5-(SOFT_PITY-1),2)*SOPE_EXP); // clamp ≤100%
  return RATE_5;                                                    // base
}
function randOf(list){return list[Math.floor(Math.random()*list.length)]}

window.GachaCore={
  RATES:{rate5:RATE_5,rate4:RATE_4,softPity:SOFT_PITY,hardPity:HARD_PITY,hardPity4:HARD_PITY4},
  chance5:chance5,

  /* SATU pull. Mengembalikan {item, featured}. */
  pick:function(s,ctx){
    s.pulls++; s.pity5++; s.pity4++;

    var got5=Math.random()<chance5(s.pity5);
    var got4=!got5&&(s.pity4>=HARD_PITY4||Math.random()<RATE_4);

    if(got5){
      s.pity5=0; s.pity4=0;            // ★4 pity reset juga (spek)
      s.fiveTotal=(s.fiveTotal||0)+1;
      s.lastFiveAt=s.pulls;
      (s.fiveLog=s.fiveLog||[]).push(s.lastFiveAt-(s.prevFiveAt||0));
      s.prevFiveAt=s.lastFiveAt;
      /* 50/50: kalah sekali → guaranteed → ★5 berikutnya PASTI featured */
      var featured=ctx.featured&&(s.guaranteed||Math.random()<0.5);
      s.guaranteed=ctx.featured&&!featured;
      if(featured)s.featuredWon=(s.featuredWon||0)+1;
      var pool5=ctx.featured
        ? (featured?ctx.items5.filter(function(x){return x.featured}):ctx.items5.filter(function(x){return !x.featured}))
        : ctx.items5;
      if(!pool5.length)pool5=ctx.items5; /* guard: misconfig pool kosong */
      return {item:randOf(pool5),featured:!!featured};
    }
    if(got4){ s.pity4=0; return {item:randOf(ctx.items4),featured:false}; }
    return {item:randOf(ctx.items3),featured:false};
  },

  /* n pull sekaligus. 10× tanpa satu pun ★4+ → slot terakhir di-backfill ★4. */
  pull:function(s,n,ctx){
    var out=[];
    for(var i=0;i<n;i++){var r=this.pick(s,ctx);out.push({item:r.item,featured:r.featured})}
    if(n>=10 && !out.some(function(x){return x.item.rarity>=4})){
      /* backfill ★4 di slot terakhir. PENTING: jangan pakai pick() —
         pick() menambah pulls/pity, dan itu akan mendistorsi counter
         (satu pull jadi dihitung dua kali). Pilih item langsung. */
      out[out.length-1]={item:randOf(ctx.items4),featured:false};
    }
    return out;
  }
};})();
