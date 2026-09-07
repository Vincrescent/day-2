/* probe-core.js v2 — detail teks + uji overlap pixel vs tombol wish. */
(()=>{
function cs(e,p){return getComputedStyle(e).getPropertyValue(p).trim()}
function box(el){const r=el.getBoundingClientRect();
  return{top:Math.round(r.top),left:Math.round(r.left),w:Math.round(r.width),h:Math.round(r.height),
    bottom:Math.round(r.bottom),right:Math.round(r.right)}}
function intersects(a,b,pad=2){
  return a.left<b.right+pad&&a.right>b.left-pad&&a.top<b.bottom+pad&&a.bottom>b.top-pad}
const L=[];
L.push('VIEWPORT='+innerWidth+'x'+innerHeight);

/* kotak tombol wish (pull buttons) */
const p1=document.getElementById('btnPull1'),p10=document.getElementById('btnPull10');
const wishBox=p1&&p10?{left:Math.min(p1.getBoundingClientRect().left,p10.getBoundingClientRect().left),
  top:Math.min(p1.getBoundingClientRect().top,p10.getBoundingClientRect().top),
  right:Math.max(p1.getBoundingClientRect().right,p10.getBoundingClientRect().right),
  bottom:Math.max(p1.getBoundingClientRect().bottom,p10.getBoundingClientRect().bottom)}:null;
if(wishBox)L.push('WISH_BUTTONS_BOX: '+JSON.stringify(wishBox));

/* semua elemen ber-TEKS di banner-panel + topbar */
L.push('--- TEKS DI BANNER PANEL + TOPBAR (dengan overlap wish?) ---');
const root=document.querySelector('.banner-panel')||document.body;
const all=[...document.querySelectorAll('.topbar *, .banner-panel *')];
for(const n of all){
  /* ambil teks langsung (bukan dari children) */
  let txt='';for(const c of n.childNodes)if(c.nodeType===3)txt+=c.nodeValue;
  txt=txt.replace(/\s+/g,' ').trim();
  if(!txt)continue;
  const b=box(n);
  if(b.w<1||b.h<1)continue;
  if(b.bottom<0||b.top>innerHeight*2)continue;
  const hit=wishBox?intersects(b,wishBox):false;
  const flag=hit?'  <<< OVERLAP WISH >>>':'';
  L.push((hit?'[HIT]':'     ')+n.tagName+'.'+(n.className&&n.className.baseVal!==undefined?n.className.baseVal:(n.className||'')).toString().slice(0,22)+' id='+(n.id||'-')+' box='+JSON.stringify(b)+' txt="'+txt.slice(0,42)+'"'+flag);
}

/* kotak spesifik */
L.push('--- KOTAK KHUSUS ---');
for(const id of['bannerTag','bannerTitle','bannerSub','featuredCard','featuredName','featuredChance','bannerTimer','pityStrip','pull-dock','bannerTabs','gemCount','modeBadge','btnMode']){
  const e=document.getElementById(id);
  if(!e){
    /* coba class */
    const c2=document.querySelector('[id="'+id+'"]')||document.querySelector('.'+id);
    if(c2){L.push(id+': '+JSON.stringify(box(c2)));continue}else continue;
  }
  L.push(id+': '+JSON.stringify(box(e)));
}
const dock=document.querySelector('.pull-dock');
if(dock){L.push('pull-dock(css pos='+cs(dock,'position')+'): '+JSON.stringify(box(dock)));
  const pc=document.querySelector('.banner-content');
  if(pc){const pb=box(pc),db=box(dock);
    L.push('banner-content: '+JSON.stringify(pb));
    L.push(pb.bottom>db.top?'!! banner-content bottom ('+pb.bottom+') MASUK area pull-dock (top '+db.top+') → TEXT TERTEMPATKAN TOMBOL WISH':'OK: konten selesai di atas pull-dock (content bottom '+pb.bottom+' < dock top '+db.top+')');
  }}
return L.join('\n');
})();
