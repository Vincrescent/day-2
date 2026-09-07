/* CSS-only fallback: dipakai otomatis jika WebGL / CDN Three.js tidak tersedia. */
(function(){'use strict';
window.Scene2D={run:function(stage,results,done){
  var legendary=results.some(function(x){return x.rarity===5}),epic=!legendary&&results.some(function(x){return x.rarity===4});
  var color=legendary?'#ffd36b':epic?'#bd7dff':'#63b8ff';
  var fx=document.getElementById('fx2d'),cap=document.getElementById('stageCaption'),flash=document.getElementById('flash');
  cap.textContent='Menyelaraskan jalur astral…';
  fx.innerHTML='<div class="fallback-stars"></div><div class="fallback-rays"></div><div class="fallback-orb" style="--fx:'+color+'"></div><div class="fallback-ring" style="--fx:'+color+'"></div><div class="fallback-sparks" style="--fx:'+color+'"></div>';
  SFX.whoosh();
  setTimeout(function(){cap.textContent=legendary?'TEKANAN TAKDIR MENINGKAT':'Resonansi terkumpul…';SFX.riser()},900);
  setTimeout(function(){cap.textContent=legendary?'★ ★ ★':'RESONANSI';flash.style.opacity=legendary?'.9':'.55';SFX.impact(legendary?5:epic?4:3);if(legendary)SFX.fanfare();else SFX.chime(epic?4:3);setTimeout(function(){flash.style.opacity='0'},130)},2200);
  setTimeout(function(){fx.innerHTML='';cap.textContent='';done()},3000);
}};})();
