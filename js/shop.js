/* ══════════════════════════════════════════════════════════════════════
   SHOP — ekonomi duplikat. Item yang sudah dimiliki tidak hilang:
   dikonversi jadi "Astral Sigils" (★3→5, ★4→20, ★5→150).
   Sigils bisa ditukar ke Gems di shop.
   ══════════════════════════════════════════════════════════════════════ */
(function(){'use strict';
var SIGILS={3:5,4:20,5:150};
var TRADES=[
  {id:'t1',label:'400 Gems',cost:50,gems:400},
  {id:'t2',label:'1.600 Gems (1× pull)',cost:200,gems:1600},
  {id:'t3',label:'8.000 Gems (5× pull)',cost:1000,gems:8000}
];
window.Shop={
  SIGILS:SIGILS,TRADES:TRADES,
  /* daftarkan item; kalau duplikat, beri sigils sesuai rarity. */
  grant:function(state,item){
    state.owned=state.owned||{};
    state.sigils=state.sigils||0;
    var dup=state.owned[item.name]||0;
    state.owned[item.name]=dup+1;
    return dup>0?SIGILS[item.rarity]:0;
  },
  trade:function(state,id){
    var t=TRADES.filter(function(x){return x.id===id})[0];
    if(!t)return false;
    if((state.sigils||0)<t.cost)return false;
    state.sigils-=t.cost;
    state.gems=(state.gems||0)+t.gems;
    return true;
  }
};})();
