/* Fallback CSS-only: otomatis aktif kalau Three.js/WebGL tidak tersedia.
   Jalur visual & SFX-nya meniru scene3d (whoosh → riser → impact). */
(function(){'use strict';
var timers=[];
function T(fn,ms){var id=setTimeout(fn,ms);timers.push(id);return id}
window.Scene2D={
  run:function(stage,results,done){
    var legendary=results.some(function(x){return x.rarity===5}),epic=!legendary&&results.some(function(x){return x.rarity===4});
    var color=legendary?'#ffd36b':epic?'#bd7dff':'#63b8ff';
    var fx=document.getElementById('fx2d'),cap=document.getElementById('stageCaption'),flash=document.getElementById('flash');
    cap.textContent='Menyelaraskan jalur astral…';
    fx.innerHTML='<div class="fallback-stars"></div><div class="fallback-rays" style="--fx:'+color+'"></div><div class="fallback-ring" style="--fx:'+color+'"></div><div class="fallback-orb" style="--fx:'+color+'"></div><div class="fallback-sparks" style="--fx:'+color+'"></div>';
    SFX.whoosh();
    T(function(){cap.textContent=legendary?'TEKANAN TAKDIR MENINGKAT':'Resonansi terkumpul…';SFX.riser()},900);
    T(function(){cap.textContent=legendary?'★ ★ ★':'RESONANSI';flash.style.opacity=legendary?'.9':'.55';
      SFX.impact(legendary?5:epic?4:3);if(legendary)SFX.fanfare();else SFX.chime(epic?4:3);
      T(function(){flash.style.opacity='0'},130)},2200);
    T(function(){clean();done()},3000);
  },
  abort:function(){
    timers.forEach(function(id){clearTimeout(id)});
    timers=[];
    var fx=document.getElementById('fx2d'),cap=document.getElementById('stageCaption'),flash=document.getElementById('flash');
    if(fx)fx.innerHTML='';if(cap)cap.textContent='';if(flash)flash.style.opacity='0';
  }
};
function clean(){
  timers.forEach(function(id){clearTimeout(id)});timers=[];
  var fx=document.getElementById('fx2d');if(fx)fx.innerHTML='';
  var cap=document.getElementById('stageCaption');if(cap)cap.textContent='';
  var flash=document.getElementById('flash');if(flash)flash.style.opacity='0';
}
})();
