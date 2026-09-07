/* ══════════════════════════════════════════════════════════════════════
   APP — orkestrasi UI + dual-mode (API server 4100 / localStorage fallback).
   
   ALUR:
     1. auth.js → tampilkan overlay login (kalau belum login).
     2. app.js dual-mode:
        - ONLINE: gem/sigil/owned/pull semua via API (server-side pity, anti-cheat)
        - OFFLINE: gem/sigil/owned/pull pakai localStorage (demo tanpa server)
     3. Banner rotasi: timer reset setiap 60 menit (state tetap tersimpan).
   ══════════════════════════════════════════════════════════════════════ */
(function(){'use strict';
var KEY='lumenveil-state-v2';
var DEFAULT={v:2,gems:16000,sigils:0,owned:{},history:[],banner:'crown',
  bannerEnd:0,banners:{crown:{pulls:0,pity5:0,pity4:0,guaranteed:false,fiveTotal:0,fiveLog:[]},
                       forge:{pulls:0,pity5:0,pity4:0,guaranteed:false,fiveTotal:0,fiveLog:[]}}};
var busy=false,skipped=false,showcaseTimer=null,gridToken=0;

/* ── DUAL MODE: deteksi server vs local ── */
/* Backend API hidup di :4100 (Express+MySQL). Kalau halaman sudah di-serve
   dari :4100 → pakai same-origin (tanpa CORS). Kalau dari :8080/file:// →
   absolut 4100 (CORS Access-Control-Allow-Origin:* sudah di-set server). */
var API_ABS='http://localhost:4100';
var SERVER_URL=(location.protocol==='http:'||location.protocol==='https:')&&location.port==='4100'
  ? location.origin.replace(/\/+$/,'') : API_ABS;
var AUTH_KEY='lumenvail-auth'; // token dari server
var MODE; // 'online'|'offline'
var authGateShown=false;
function detectMode(){
  fetch(SERVER_URL+'/api/health',{method:'HEAD'}).then(function(r){return r.ok}).catch(function(){return false}).then(function(ok){
    MODE=ok?'online':'offline';
    $('modeBadge').textContent=ok?'◈ ONLINE':'◈ LOCAL';
    if(ok){
      if(getToken()){startSession()}        /* auto-login: token tersimpan → langsung masuk */
      else if(!authGateShown){authGateShown=true;setTimeout(function(){if(!getToken()&&MODE==='online')showAuth()},400)}
    }
  });
}
function getToken(){try{return localStorage.getItem(AUTH_KEY)||''}catch(e){return ''}}
function setToken(t){try{localStorage.setItem(AUTH_KEY,t)}catch(e){}}
function clearAuth(){try{localStorage.removeItem(AUTH_KEY)}catch(e){}}
function authHeader(){var t=getToken();return t?{'Authorization':'Bearer '+t}:null}

/* ── state + migrasi versi lama (v1 flat → v2 per-banner) ── */
function loadLocal(){
  try{
    var raw=localStorage.getItem(KEY)||localStorage.getItem('lumenveil-state-v1');
    if(!raw)return clone(DEFAULT);
    var s=JSON.parse(raw);
    if(s.v===2)return Object.assign(clone(DEFAULT),s);
    var d=clone(DEFAULT);
    d.gems=s.gems; d.history=s.history||[];
    d.banners.crown={pulls:s.pulls||0,pity5:s.pity5||0,pity4:s.pity4||0,
      guaranteed:!!s.guaranteed,fiveTotal:s.fiveTotal||0,fiveLog:[]};
    localStorage.setItem(KEY,JSON.stringify(d));
    return d;
  }catch(e){
    try{localStorage.setItem('lumenveil-backup',localStorage.getItem(KEY)||localStorage.getItem('lumenveil-state-v1'))}catch(_){}
    return clone(DEFAULT);
  }
}
function clone(x){return JSON.parse(JSON.stringify(x))}
function saveLocal(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}

/* untuk offline: ambil state lokal; untuk online: diambil saat init / refresh */
var state=loadLocal();

/* ── LOGIN / REGISTER UI ── */
var authMode='login'; // 'login'|'register'

function showAuth(){
  $('authOverlay').hidden=false;
  $('authError').textContent='';
  $('authUsername').value='';
  $('authPassword').value='';
  $('authSubmit').textContent=authMode==='login'?'Masuk':'Daftar';
  $('authToggle').textContent=authMode==='login'?'Belum punya akun? Klik lagi tombol Masuk/Daftar':'Sudah punya akun? Klik lagi tombol Masuk/Daftar';
}
function hideAuth(){
  $('authOverlay').hidden=true;
  startSession();
}
function startSession(){
  $('authOverlay').hidden=true; /* login sukses / offline / auto-login → masuk game */
  /* kalau offline mode, render langsung; kalau online, fetch user */
  if(MODE==='online'){
    var tok=getToken();
    if(!tok){showAuth();return}
    fetch(SERVER_URL+'/api/me',{headers:authHeader()}).then(function(r){return r.json()}).then(function(d){
      if(d.error){clearAuth();showAuth();return}
      applyServerState(d);
      render();tickTimer();
    }).catch(function(){showAuth()});
  }else{
    state=loadLocal();render();tickTimer();
  }
}
function applyServerState(d){
  /* server tidak menyimpan banner aktif client → pertahankan banner yang sedang aktif (kalau valid) */
  var keep=(d.banners&&d.banners[state.banner])?state.banner:(d.currentBanner||'crown');
  state={v:2,gems:d.user.gems,sigils:d.user.sigils||0,
    owned:d.user.owned||{},history:d.history.map(function(h){return {name:h.name,rarity:h.rarity,color:getColor(h.rarity),time:h.time,duplicate:h.duplicate}}),
    banner:keep,
    bannerEnd:snapToNextHour(),
    banners:{}};
  Object.keys(d.banners||{}).forEach(function(k){state.banners[k]=d.banners[k]});
}
function getColor(r){return r===5?'#ffd36b':r===4?'#bb82ff':'#75b9ff'}

$('authForm').onsubmit=function(e){
  e.preventDefault();
  var u=$('authUsername').value.trim();
  var p=$('authPassword').value;
  $('authError').textContent='';
  var url=authMode==='login'?'/api/login':'/api/register';
  fetch(SERVER_URL+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})}).then(function(r){return r.json()}).then(function(d){
    if(d.error){$('authError').textContent=d.error;return}
    setToken(d.token);toast(authMode==='register'?'Akun dibuat! Selamat datang, '+d.user.username+'~':'Selamat datang, '+d.user.username+'!');startSession();
  }).catch(function(e){$('authError').textContent='Koneksi ke server gagal.'});
};
$('btnOfflineOnly').onclick=function(){MODE='offline';hideAuth()};
$('authToggle').onclick=function(){authMode=(authMode==='login'?'register':'login');showAuth()};

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
  saveLocal(); /* cache state tiap render → fallback offline tak basi; online tetap di-overwrite oleh /api/me */
  tickTimer(); /* jam rotasi banner selalu mengikuti render */
}
function renderTabs(){
  var el=$('bannerTabs'); if(!el)return;
  el.innerHTML=BannerCtx.list().map(function(b){
    return '<button class="banner-tab'+(b.id===state.banner?' active':'')+'" data-id="'+b.id+'">'+esc(b.title)+'</button>'}).join('');
  el.querySelectorAll('.banner-tab').forEach(function(t){
    t.onclick=function(){SFX.click();state.banner=t.getAttribute('data-id');render();
      /* online: ambil banner state terbaru dari server agar pity tidak usang */
      if(MODE==='online'&&getToken()){var h=authHeader();if(h){fetch(SERVER_URL+'/api/me',{headers:h}).then(function(r){return r.json()}).then(function(d){if(!d.error){applyServerState(d);render();tickTimer()}})}}}
  });
}
function renderShop(){
  var el=$('shopList'); if(!el)return;
  el.innerHTML=Shop.TRADES.map(function(t){
    var can=(state.sigils||0)>=t.cost;
    return '<div class="shop-row"><span>'+esc(t.label)+'</span><button class="mini-btn shop-btn" data-id="'+t.id+'"'+(can?'':' disabled')+'> '+t.cost+'✦</button></div>'}).join('');
  el.querySelectorAll('.shop-btn').forEach(function(bu){
    bu.onclick=function(){
      var id=bu.getAttribute('data-id');
      if(MODE==='online'){
        /* trade online: server-side (sigil/gems tervalidasi di DB, tidak bisa dimanipulasi) */
        if(!getToken()){showAuth();return}
        fetch(SERVER_URL+'/api/trade',{method:'POST',headers:{"Content-Type":"application/json","Authorization":"Bearer "+getToken()},body:JSON.stringify({id:id})}).then(function(r){return r.json()}).then(function(d){
          if(d.error){toast(d.error);return}
          state.gems=d.gems;state.sigils=d.sigils;
          SFX.coin();render();toast('Tukar berhasil — gems bertambah.');
        }).catch(function(){toast('Server tidak reachable.')});
      }else{
        if(Shop.trade(state,id)){SFX.coin();saveLocal();render();toast('Tukar berhasil — gems bertambah.')}
        else{toast('Sigils tidak cukup.')}
      }
    };
  });
}
function tickTimer(){
  var d=state.bannerEnd-Date.now(),el=$('bannerTimer');
  if(!el)return;
  el.textContent=d>0?('Berakhir dalam '+Math.floor(d/864e5)+'h '+Math.floor(d%864e5/36e5)+'j '+Math.floor(d%36e5/6e4)+'m'):'Banner berakhir — pity tetap tersimpan.';
}
/* Rotasi banner tiap jam penuh: simpan target jam berikutnya di localStorage,
   bukan offset dari waktu load agar reload di tengah jam tidak menambah timer baru. */
var ROTATE_KEY='lumenveil-rotate-h';
function snapToNextHour(){
  var n=Date.now()+3600*1000-(Date.now()%3600*1000); // round up ke jam berikutnya
  try{var saved=parseInt(localStorage.getItem(ROTATE_KEY)||'0',10)}catch(e){var saved=0}
  if(saved<=Date.now())saved=n; // sinkronisasi jika device sleep / clock drift
  return saved;
}
function initRotate(){
  if(Date.now()>state.bannerEnd){
    state.bannerEnd=snapToNextHour();
    if(MODE==='offline')saveLocal();
  }
}
initRotate();
setInterval(function(){
  /* cek jam: saat masuk jam baru, rotasi banner & reset timer ke jam berikutnya */
  if(Date.now()>state.bannerEnd){
    var next=snapToNextHour();
    state.bannerEnd=next;
    /* ganti banner aktif ke yang berikutnya */
    var ids=['crown','forge'],cur=ids.indexOf(state.banner),nx=ids[(cur+1)%ids.length];
    state.banner=nx;
    if(MODE==='online'){
      fetch(SERVER_URL+'/api/me',{headers:authHeader()}).then(function(r){return r.json()}).then(function(d){
        if(!d.error)applyServerState(d);initRotate();render();tickTimer();
      }).catch(function(){initRotate();render();tickTimer()});
    }else{initRotate();render();tickTimer()}
  }
},30000);

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
function results(list,force){
  if(skipped&&!force)return;
  if(force){grid(list);return}
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
  var cards=l.querySelectorAll('.result-card');
  list.forEach(function(x,i){
    setTimeout(function(){
      if(gen!==gridToken||!cards[i])return;
      cards[i].classList.remove('pending');
      if(x.item.rarity===5){cards[i].classList.add('hit-5');SFX.chime(5);}else SFX.tick();
    },i*100);
  });
}
function closeStage(){
  clearTimeout(showcaseTimer);showcaseTimer=null;gridToken++;
  $('stage').hidden=true;$('resultLayer').hidden=true;$('showcase').hidden=true;
  busy=false;render();
}

/* ── PULL ── */
function pull(n){
  if(busy)return;
  if(!SFX.isEnabled()){}else SFX.click();
  var cost=n===10?1600:160;
  
  if(MODE==='offline'){
    if(state.gems<cost){toast('Gems tidak cukup — klik saldo untuk top-up demo.');return}
    pullOffline(n,cost);
  }else{
    /* online mode: panggil API server-side pull */
    if(!getToken()){showAuth();return}
    busy=true;skipped=false;
    fetch(SERVER_URL+'/api/pull',{method:'POST',headers:{"Content-Type":"application/json","Authorization":"Bearer "+getToken()},
      body:JSON.stringify({n:n,banner:state.banner})}).then(function(r){return r.json()}).then(function(d){
      if(d.error){toast(d.error);busy=false;return}
      state.gems=d.gems;state.sigils=d.sigils;
      if(!state.banners[d.banner])state.banners[d.banner]={pulls:0,pity5:0,pity4:0,guaranteed:false,fiveTotal:0,fiveLog:[]};
      Object.assign(state.banners[d.banner],d.banner);
      var n5=0;
      d.results.forEach(function(r){
        var dup=r.duplicate||0;
        if(r.rarity===5)n5++;
        state.owned=state.owned||{};
        state.owned[r.name]=(state.owned[r.name]||0)+1; /* mirror "owned" server → stat "Item unik" jadi live */
        state.history.push({name:r.name,rarity:r.rarity,color:getColor(r.rarity),time:Date.now(),duplicate:dup});
      });
      state.banners[d.banner].fiveTotal=(state.banners[d.banner].fiveTotal||0)+n5; /* stat "Legendary" live */
      render();showResults(d.results);
    }).catch(function(e){console.error('[pull]',e);toast('Server tidak reachable. Coba mode offline.');busy=false});
  }
}
function pullOffline(n,cost){
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
  saveLocal();
  render();showStageAndResults(list);
}
function showStageAndResults(list){
  $('stage').hidden=false;
  $('btnSkip').hidden=true;
  setTimeout(function(){$('btnSkip').hidden=busy?false:true},1000);
  $('btnSkip').onclick=function(){
    if(skipped)return; skipped=true;
    SFX.tick();
    if(window.Scene3D&&window.Scene3D.abort)window.Scene3D.abort();
    if(window.Scene2D&&window.Scene2D.abort)window.Scene2D.abort();
    results(list,true);
  };
  window.Scene3D.run($('stage'),list.map(function(x){return x.item}),function(){results(list)});
}
function showResults(rawResults){
  /* online: rawResults adalah array object {name,rarity,...} tanpa image. */
  var list=rawResults.map(function(r){
    var item=GACHA_ITEMS.filter(function(x){return x.name===r.name})[0]||{name:r.name,rarity:r.rarity,color:getColor(r.rarity),image:''};
    return {item:item,featured:!!r.featured,duplicate:r.duplicate||0};
  });
  render();
  $('stage').hidden=false;
  $('btnSkip').hidden=true;
  setTimeout(function(){$('btnSkip').hidden=busy?false:true},1000);
  $('btnSkip').onclick=function(){
    if(skipped)return; skipped=true;
    SFX.tick();
    if(window.Scene3D&&window.Scene3D.abort)window.Scene3D.abort();
    if(window.Scene2D&&window.Scene2D.abort)window.Scene2D.abort();
    results(list,true);
  };
  window.Scene3D.run($('stage'),list.map(function(x){return x.item}),function(){results(list)});
}

/* ── DEV TOOLS (demo/showcase: paksa pity + top-up) ──
   OFFLINE: mengubah state lokal langsung.
   ONLINE: pity hidup di DB (anti-cheat) → dev tool tidak bisa mengubahnya;
   top-up gems tetap jalan via /api/topup. */
function devTools(){
  var el=$('devPanel');if(!el)return;
  el.innerHTML='<button class="mini-btn dev-btn" data-act="p89">Pity 89 → ★5 berikutnya</button>'+
    '<button class="mini-btn dev-btn" data-act="p74">Pity 74 (soft)</button>'+
    '<button class="mini-btn dev-btn" data-act="zero">Zero pity</button>'+
    '<button class="mini-btn dev-btn" data-act="gems">+16k gems</button>';
  el.querySelectorAll('.dev-btn').forEach(function(b){
    b.onclick=function(){SFX.click();var a=b.getAttribute('data-act'),s=bs();
      if(a==='gems'){
        if(MODE==='online'){
          fetch(SERVER_URL+'/api/topup',{method:'POST',headers:authHeader()}).then(function(r){return r.json()}).then(function(d){state.gems=d.gems;render();toast('+16.000 gems (server).')}).catch(function(){toast('Server tidak reachable.')});
        }else{state.gems+=16000;saveLocal();toast('+16.000 gems.')}
        return;
      }
      if(MODE==='online'){toast('Pity online tersimpan di server — pakai pull sampai 74/89 (atau mode offline untuk demo).');return}
      if(a==='p89'){s.pity5=89;toast('Pity ★5 diset 89 — pull berikutnya DIJAMIN ★5.')}
      if(a==='p74'){s.pity5=74;toast('Pity ★5 diset 74 — zona soft pity.')}
      if(a==='zero'){s.pity5=0;s.pity4=0;toast('Pity di-nol-kan.')}
      saveLocal();render();};
  });
}

/* ── UTIL ── */
function $(id){return document.getElementById(id)}
function esc(x){return String(x).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})}
function time(x){return new Date(x).toLocaleString('id-ID',{dateStyle:'short',timeStyle:'short'})}
function toast(msg){var e=document.createElement('div');e.className='toast';e.textContent=msg;$('toastRack').appendChild(e);setTimeout(function(){e.remove()},3500)}
function bs(){var s=state.banners[state.banner];if(!s){state.banner='crown';s=state.banners.crown}return s}
function totalPulls(){return Object.keys(state.banners).reduce(function(a,k){return a+state.banners[k].pulls},0)}
function totalFives(){return Object.keys(state.banners).reduce(function(a,k){return a+(state.banners[k].fiveTotal||0)},0)}
function countRare(){return state.history.filter(function(x){return x.rarity===4}).length}

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
  $('wallet').onclick=function(){SFX.coin();
    if(MODE==='offline'){state.gems+=1600;saveLocal();toast('+1.600 Gems demo ditambahkan.')}
    else{fetch(SERVER_URL+'/api/topup',{method:'POST',headers:authHeader()||{}}).then(function(r){return r.json()}).then(function(d){if(d.error){toast(d.error);return}state.gems=d.gems;render();toast('+1.600 Gems demo ditambah (server).')}).catch(function(){toast('Server tidak reachable.')})}
  };
  $('btnClearLog').onclick=function(){
    if(MODE==='online'){toast('Mode online: riwayat tersimpan di server — tidak bisa dihapus dari sini.');return}
    if(confirm('Hapus riwayat pull?')){state.history=[];saveLocal();render()}};
  $('btnResetAll').onclick=function(){
    if(MODE==='online'){toast('Mode online: data & pity tersimpan di server — reset hanya tersedia offline.');return}
    if(confirm('Reset semua data, pity, dan sigils?')){state=clone(DEFAULT);initRotate();render()}};
  $('btnExport').onclick=function(){var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
    a.download='lumenveil-history.json';a.click()};
  $('btnUser').onclick=function(){if(MODE==='online'){clearAuth();MODE='offline';$('btnUser').hidden=true;$('modeBadge').textContent='◈ LOCAL';toast('Logout. Mode offline.');startSession()}else{MODE='online';$('btnUser').hidden=false;$('modeBadge').textContent='◈ ONLINE';toast('Beralih ke mode online. Silakan login.');showAuth()}};
  devTools();
  render();
  detectMode();
  /* badge engine: 3D kalau WebGL siap, 2D kalau fallback aktif */
  setTimeout(function(){var m=$('btnMode');if(m)m.textContent=window.Scene3D&&Scene3D.ready?'◈ 3D':'◈ 2D'},250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
