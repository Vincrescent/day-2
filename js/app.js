/* ══════════════════════════════════════════════════════════════════════
   APP — orkestrasi UI: state (localStorage), banner, pull, hasil,
   statistik, shop, dev tools. Logika pity/probabilitas di gacha-core.js.
   ══════════════════════════════════════════════════════════════════════ */
(function(){'use strict';
var KEY='lumenveil-state-v2';
var DEFAULT={v:2,gems:16000,sigils:0,owned:{},history:[],banner:'crown',
  bannerEnd:0,banners:{crown:{pulls:0,pity5:0,pity4:0,guaranteed:false,fiveTotal:0,fiveLog:[]},
                       forge:{pulls:0,pity5:0,pity4:0,guaranteed:false,fiveTotal:0,fiveLog:[]}}};
var busy=false,skipped=false,showcaseTimer=null,gridToken=0;

/* ── state + migrasi versi lama (v1 flat → v2 per-banner) ── */
function load(){
  try{
    var raw=localStorage.getItem(KEY)||localStorage.getItem('lumenveil-state-v1');
    if(!raw)return clone(DEFAULT);
    var s=JSON.parse(raw);
    if(s.v===2)return Object.assign(clone(DEFAULT),s);
    /* migrasi v1 → v2 */
    var d=clone(DEFAULT);
    d.gems=s.gems; d.history=s.history||[];
    d.banners.crown={pulls:s.pulls||0,pity5:s.pity5||0,pity4:s.pity4||0,
      guaranteed:!!s.guaranteed,fiveTotal:s.fiveTotal||0,fiveLog:[]};
    localStorage.setItem(KEY,JSON.stringify(d));
    return d;
  }catch(e){
    /* JSON rusak → jangan crash: simpan salinan rusak, mulai bersih */
    try{localStorage.setItem('lumenveil-backup',localStorage.getItem(KEY)||localStorage.getItem('lumenveil-state-v1'))}catch(_){}
    return clone(DEFAULT);
  }
}
function clone(x){return JSON.parse(JSON.stringify(x))}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
function $(id){return document.getElementById(id)}
function esc(x){return String(x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function time(x){return new Date(x).toLocaleString('id-ID',{dateStyle:'short',timeStyle:'short'})}
function toast(msg){var e=document.createElement('div');e.className='toast';e.textContent=msg;$('toastRack').appendChild(e);setTimeout(function(){e.remove()},3500)}
function bs(){var s=state.banners[state.banner];if(!s){state.banner='crown';s=state.banners.crown}return s}
function totalPulls(){return Object.keys(state.banners).reduce(function(a,k){return a+state.banners[k].pulls},0)}
function totalFives(){return Object.keys(state.banners).reduce(function(a,k){return a+(state.banners[k].fiveTotal||0)},0)}
function countRare(){return state.history.filter(function(x){return x.rarity===4}).length}

var state=load();
if(!state.bannerEnd)state.bannerEnd=Date.now()+72*3600*1000;

/* ── RENDER ── */
function render(){
  var b=BannerCtx.get(state.banner),s=bs();
  $('gemCount').textContent=state.gems.toLocaleString('id-ID');
  var sig=$('sigilCount');if(sig)sig.textContent=(state.sigils||0).toLocaleString('id-ID');
  $('pity5Num').innerHTML=s.pity5+'<small>/90</small>';
  $('pity4Num').innerHTML=s.pity4+'<small>/10</small>';
  $('pity5Bar').style.width=Math.min(100,s.pity5/90*100)+'%';
  $('pity4Bar').style.width=Math.min(100,s.pity4/10*100)+'%';
  $('guaranteeLabel').textContent=s.guaranteed?'Guaranteed ★5':'Fair 50/50';
  $('bannerTag').textContent=b.tag;
  $('bannerTitle').textContent=b.title;
  $('bannerSub').innerHTML=b.sub;
  $('featuredName').textContent=b.featuredName;
  /* meta featured ikut banner: ★5 featured → 50/50 aktif; ★4 rate-up → tidak */
  var featItem=GACHA_ITEMS.filter(function(x){return x.name===b.featuredName})[0];
  var featR=featItem?featItem.rarity:5;
  $('rarityStars').textContent='★'.repeat(featR);
  $('rarityStars').setAttribute('data-r',featR);
  $('featuredType').textContent=featR===5?'★5 Featured · 50/50':'★4 Rate-up · tanpa 50/50';
  $('featuredChance').textContent=featR===5
    ?'Peluang saat ★5 muncul: 50% featured (100% setelah kalah)'
    :'Rate-up ★4: saat ★4 jatuh, 50% Aster Pike. ★5 tetap dari pool standar.';
  var art=$('featuredArt'); if(art)art.style.backgroundImage="url('"+b.art+"')";
  renderTabs();
  $('statGrid').innerHTML=
    '<div class="stat"><b>'+totalPulls()+'</b><span>Total pull</span></div>'+
    '<div class="stat"><b>'+totalFives()+'</b><span>Legendary</span></div>'+
    '<div class="stat"><b>'+s.pity5+'</b><span>Jarak ★5 (banner)</span></div>'+
    '<div class="stat"><b>'+countRare()+'</b><span>Rare didapat</span></div>'+
    '<div class="stat"><b>'+(state.sigils||0)+'</b><span>Astral Sigils</span></div>'+
    '<div class="stat"><b>'+Object.keys(state.owned||{}).length+'</b><span>Item unik</span></div>';
  renderShop();
  $('historyLog').innerHTML=state.history.length?state.history.slice().reverse().map(function(x){
    return '<div class="history-row"><b>'+('★'.repeat(x.rarity))+'</b><div><div class="item">'+esc(x.name)+
      (x.duplicate?' <span class="dup-badge">+'+x.duplicate+'✦</span>':'')+'</div><time>'+time(x.time)+'</time></div>'+
      '<span style="color:'+x.color+'">★'+x.rarity+'</span></div>'}).join(''):
    '<p style="color:var(--muted)">Belum ada wish. Takdir menunggu.</p>';
  save();
}
function renderTabs(){
  var el=$('bannerTabs'); if(!el)return;
  el.innerHTML=BannerCtx.list().map(function(b){
    return '<button class="banner-tab'+(b.id===state.banner?' active':'')+'" data-id="'+b.id+'">'+esc(b.title)+'</button>'}).join('');
  el.querySelectorAll('.banner-tab').forEach(function(t){
    t.onclick=function(){SFX.click();state.banner=t.getAttribute('data-id');render();};
  });
}
function renderShop(){
  var el=$('shopList'); if(!el)return;
  el.innerHTML=Shop.TRADES.map(function(t){
    var can=(state.sigils||0)>=t.cost;
    return '<div class="shop-row"><span>'+esc(t.label)+'</span><button class="mini-btn shop-btn" data-id="'+t.id+'"'+(can?'':' disabled')+'> '+t.cost+'✦</button></div>'}).join('');
  el.querySelectorAll('.shop-btn').forEach(function(bu){
    bu.onclick=function(){if(Shop.trade(state,bu.getAttribute('data-id'))){SFX.coin();render();toast('Tukar berhasil — gems bertambah.')}else toast('Sigils tidak cukup.')};
  });
}
function tickTimer(){
  var d=state.bannerEnd-Date.now(),el=$('bannerTimer');
  if(!el)return;
  el.textContent=d>0?('Berakhir dalam '+Math.floor(d/864e5)+'h '+Math.floor(d%864e5/36e5)+'j '+Math.floor(d%36e5/6e4)+'m'):'Banner berakhir — pity tetap tersimpan.';
}

/* ── PANEL RATE ── */
function rates(){
  var p=$('sidePanel'),open=p.hidden;
  p.hidden=!open;$('btnRates').setAttribute('aria-expanded',open);
  if(open){var R=GachaCore.RATES;
    $('rateBody').innerHTML='<div class="rate-row"><span>★5 Legendary</span><b>'+(R.rate5*100)+'%</b></div>'+
      '<div class="rate-row"><span>★4 Rare</span><b>'+(R.rate4*100)+'%</b></div>'+
      '<div class="rate-row"><span>★3 Common</span><b>'+(100-R.rate5*100-R.rate4*100).toFixed(1)+'%</b></div>'+
      '<p><b>Soft pity:</b> mulai pull ke-'+R.softPity+', peluang ★5 naik tajam (kuadrat).</p>'+
      '<p><b>Hard pity:</b> ★5 dijamin di pull ke-'+R.hardPity+' · ★4 dijamin tiap '+R.hardPity4+' pull.</p>'+
      '<p><b>50/50:</b> saat ★5 muncul, 50% featured; kalah → ★5 berikutnya guaranteed.</p>';
  }
}

/* ── HASIL: showcase ★5 → grid kartu stagger ── */
function results(list){
  if(skipped)return; /* sudah di-render lewat Skip — abaikan callback terlambat */
  var has5=list.some(function(x){return x.item.rarity===5});
  if(has5)showcase(list.filter(function(x){return x.item.rarity===5})[0].item,function(){grid(list)});
  else grid(list);
}
function showcase(item,cb){
  var l=$('showcase');
  l.innerHTML='<div class="showcase-inner" style="--rarity:'+item.color+'">'+
    '<div class="showcase-art" style="background-image:url(\''+item.image+'\')"></div>'+
    '<div class="showcase-name">'+esc(item.name)+'</div>'+
    '<div class="showcase-rarity">★ ★ ★ ★ ★ · '+(item.featured?'RATE-UP':'LEGENDARY')+'</div>'+
    '<div class="showcase-skip">klik di mana saja untuk lanjut ▸</div></div>';
  l.hidden=false;
  SFX.fanfare();
  var go=function(){SFX.whoosh();l.hidden=true;l.innerHTML='';clearTimeout(showcaseTimer);cb();};
  l.onclick=go;
  showcaseTimer=setTimeout(go,2200);
}
function grid(list){
  var gen=gridToken,l=$('resultLayer');
  l.innerHTML='<h2 class="result-title">Resonansi Terbuka</h2><div class="result-grid">'+
    list.map(function(x,i){
      var it=x.item;
      return '<article class="result-card pending" style="--rarity:'+it.color+';--delay:'+(i*100)+'ms">'+
        '<div class="result-art" style="background-image:url(\''+it.image+'\')"></div>'+
        (x.featured?'<div class="featured-badge">RATE-UP</div>':'')+
        '<div class="result-rarity">'+(it.rarity===5?'LEGENDARY':it.rarity===4?'RARE':'COMMON')+' · ★'+it.rarity+'</div>'+
        '<div class="result-name">'+esc(it.name)+'</div>'+
        '<small>'+esc(it.title)+(x.duplicate?' · <span class="dup-badge">DUP +'+x.duplicate+'✦</span>':'')+'</small></article>'}).join('')+
    '</div><button class="result-close" id="btnCloseResults">Kembali ke banner</button>';
  l.hidden=false;
  $('btnCloseResults').onclick=closeStage;
  /* stagger reveal: 100 ms antar kartu + SFX per kartu */
  var cards=l.querySelectorAll('.result-card');
  list.forEach(function(x,i){
    setTimeout(function(){
      if(gen!==gridToken||!cards[i])return; /* stage sudah ditutup → abaikan */
      cards[i].classList.remove('pending');
      if(x.item.rarity===5){cards[i].classList.add('hit-5');SFX.chime(5);}else SFX.tick();
    },i*100);
  });
}
function closeStage(){clearTimeout(showcaseTimer);showcaseTimer=null;gridToken++;$('stage').hidden=true;$('resultLayer').hidden=true;$('showcase').hidden=true;busy=false;render()}

/* ── PULL ── */
function pull(n){
  if(busy)return;
  if(!SFX.isEnabled()){} else SFX.click();
  var cost=n===10?1600:160;
  if(state.gems<cost){toast('Gems tidak cukup — klik saldo untuk top-up demo.');return}
  busy=true;skipped=false;
  state.gems-=cost;
  var ctx=BannerCtx.build(state.banner);
  var raw=GachaCore.pull(bs(),n,ctx);
  var list=raw.map(function(r){
    var dup=Shop.grant(state,r.item);
    state.history.push({name:r.item.name,rarity:r.item.rarity,color:r.item.color,time:Date.now(),duplicate:dup});
    return {item:r.item,featured:!!r.featured,duplicate:dup};
  });
  render();
  $('stage').hidden=false;
  /* Skip baru muncul setelah 1 detik (spek butir 2.7) */
  $('btnSkip').hidden=true;
  setTimeout(function(){$('btnSkip').hidden=busy?false:true},1000);
  $('btnSkip').onclick=function(){
    if(skipped)return; skipped=true;
    SFX.tick();
    /* batalkan animasi 3D & 2D (loop rAF + timer SFX) */
    if(window.Scene3D.abort)window.Scene3D.abort();
    if(window.Scene2D.abort)window.Scene2D.abort();
    results(list);
  };
  window.Scene3D.run($('stage'),list.map(function(x){return x.item}),function(){results(list)});
}

/* ── DEV TOOLS (untuk demo/showcase: paksa pity) ── */
function devTools(){
  var el=$('devPanel');if(!el)return;
  el.innerHTML='<button class="mini-btn dev-btn" data-act="p89">Pity 89 → ★5 berikutnya</button>'+
    '<button class="mini-btn dev-btn" data-act="p74">Pity 74 (soft)</button>'+
    '<button class="mini-btn dev-btn" data-act="zero">Zero pity</button>'+
    '<button class="mini-btn dev-btn" data-act="gems">+16k gems</button>';
  el.querySelectorAll('.dev-btn').forEach(function(b){
    b.onclick=function(){SFX.click();var a=b.getAttribute('data-act'),s=bs();
      if(a==='p89'){s.pity5=89;toast('Pity ★5 diset 89 — pull berikutnya DIJAMIN ★5.')}
      if(a==='p74'){s.pity5=74;toast('Pity ★5 diset 74 — zona soft pity.')}
      if(a==='zero'){s.pity5=0;s.pity4=0;toast('Pity di-nol-kan.')}
      if(a==='gems'){state.gems+=16000;toast('+16.000 gems.')}
      render();};
  });
}

/* ── INIT ── */
function init(){
  if(window.__lumenveilBooted)return;
  window.__lumenveilBooted=true;
  $('sidePanel').hidden=true;
  $('btnRates').onclick=rates;$('btnCloseRates').onclick=rates;
  $('btnPull1').onclick=function(){pull(1)};
  $('btnPull10').onclick=function(){pull(10)};
  $('btnSfx').onclick=function(){SFX.setEnabled(!SFX.isEnabled());
    this.setAttribute('aria-pressed',String(SFX.isEnabled()));
    this.textContent=SFX.isEnabled()?'🔊 SFX':'🔇 SFX'};
  $('wallet').onclick=function(){SFX.coin();state.gems+=1600;render();toast('+1.600 Gems demo ditambahkan.')};
  $('btnClearLog').onclick=function(){if(confirm('Hapus riwayat pull?')){state.history=[];render()}};
  $('btnResetAll').onclick=function(){if(confirm('Reset semua data, pity, dan sigils?')){state=clone(DEFAULT);state.bannerEnd=Date.now()+72*3600*1000;render()}};
  $('btnExport').onclick=function(){var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
    a.download='lumenveil-history.json';a.click()};
  devTools();
  tickTimer();setInterval(tickTimer,60000);
  /* badge engine: 3D kalau WebGL siap, 2D kalau fallback aktif */
  setTimeout(function(){var m=$('btnMode');if(m)m.textContent=window.Scene3D&&Scene3D.ready?'◈ 3D':'◈ 2D'},250);
  render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
