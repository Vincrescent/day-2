/* ══════════════════════════════════════════════════════════════════════
   BANNERS — katalog banner. Tiap banner punya pool item + item rate-up.
   Tambah banner = tambah satu objek ke BANNERS.
   buildCtx(id) menyiapkan pool per-rarity untuk GachaCore.
     - rate-up ★5  → 50/50 aktif (featured:true)
     - rate-up ★4  → 50/50 TIDAK aktif; item hanya masuk pool 4★
   ══════════════════════════════════════════════════════════════════════ */
(function(){'use strict';
function byId(name){return window.GACHA_ITEMS.filter(function(x){return x.name===name})[0]}
function names(list){return list.map(byId).filter(Boolean)}

window.BANNERS=[
  {id:'crown',tag:'BANNER TERBATAS · CELESTIAL FORGE',title:'Crown of Embers',
   sub:'Rate-up: <strong>Virelai, Crown of Embers</strong> ★5',
   featuredName:'Virelai',art:'assets/items/virelai.png',accent:'#ffd36b',
   featured:{name:'Virelai',pool5:['Orin Vale','Nyra Sol'],pool4:['Aster Pike','Mira Quill','Kestrel-9'],pool3:['Cinder Pin','Luma Thread','Brasswing','Vesper Bell']}},
  {id:'forge',tag:'BANNER PERMANEN · ASTRAL ARMORY',title:'Forges of the Void',
   sub:'Rate-up: <strong>Aster Pike, Skyline Sentinel</strong> ★4',
   featuredName:'Aster Pike',art:'assets/items/aster.png',accent:'#8fb4ff',
   featured:{name:'Aster Pike',pool5:['Orin Vale','Nyra Sol'],pool4:['Mira Quill','Kestrel-9'],pool3:['Cinder Pin','Luma Thread','Brasswing','Vesper Bell']}}
];

window.BannerCtx={
  list:function(){return window.BANNERS},
  get:function(id){return window.BANNERS.filter(function(b){return b.id===id})[0]||window.BANNERS[0]},
  build:function(id){
    var b=this.get(id);
    var feat=b.featured.name?byId(b.featured.name):null;
    var std5=names(b.featured.pool5);
    var p4=names(b.featured.pool4);
    var p3=names(b.featured.pool3);
    if(feat&&feat.rarity===5)
      return {items5:[feat].concat(std5),items4:p4,items3:p3,featured:true};
    return {items5:std5,items4:p4.concat(feat?[feat]:[]),items3:p3,featured:false};
  }
};
})();
