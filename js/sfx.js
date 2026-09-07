/* SFX engine — semua suara digenerate pakai WebAudio (oscillator + noise),
   jadi tidak ada file audio eksternal yang perlu di-download. */
(function(){'use strict';
var ctx=null,on=true;
function ac(){if(!ctx){try{ctx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){ctx=null}}if(ctx&&ctx.state==='suspended')ctx.resume();return ctx}
function osc(type,f0,f1,dur,vol,delay){var c=ac();if(!c||!on)return;var t=c.currentTime+(delay||0),o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(f0,1),t);if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(f1,1),t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+Math.min(.03,dur/3));g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+dur+.05)}
function noise(dur,vol,f0,f1,q,delay){var c=ac();if(!c||!on)return;var t=c.currentTime+(delay||0),len=Math.max(1,(dur*c.sampleRate)|0),b=c.createBuffer(1,len,c.sampleRate),d=b.getChannelData(0);for(var i=0;i<len;i++)d[i]=Math.random()*2-1;var n=c.createBufferSource();n.buffer=b;var f=c.createBiquadFilter();f.type='bandpass';f.Q.value=q||1.1;f.frequency.setValueAtTime(Math.max(f0,20),t);f.frequency.exponentialRampToValueAtTime(Math.max(f1,20),t+dur);var g=c.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+dur*.25);g.gain.exponentialRampToValueAtTime(.0001,t+dur);n.connect(f);f.connect(g);g.connect(c.destination);n.start(t);n.stop(t+dur+.05)}
function bell(f,delay,vol){osc('sine',f,f,1.1,vol||.16,delay);osc('sine',f*2,f*2,.5,vol*.3||.05,delay)}
window.SFX={
  setEnabled:function(v){on=v},isEnabled:function(){return on},
  click:function(){osc('triangle',620,900,.08,.12)},
  tick:function(){osc('sine',1300,800,.07,.08)},
  whoosh:function(){noise(.8,.3,160,2200,.9)},
  riser:function(){osc('sawtooth',65,540,1.9,.1);noise(1.9,.16,260,1600,.8)},
  impact:function(r){osc('sine',170,36,.55,.45);noise(.4,.35,1100,140,.7);if(r>=4){bell(880,.05,.12);bell(1320,.12,.09)}},
  chime:function(r){if(r===5){[523,659,784,1047].forEach(function(f,i){bell(f,i*.09,.16)});noise(.8,.12,2000,7000,.6,.1)}else if(r===4){bell(587,0,.14);bell(880,.09,.11)}else{bell(392,0,.07)}},
  fanfare:function(){[392,523,659,784,1047,1319].forEach(function(f,i){bell(f,i*.08,.18)});noise(1.4,.18,800,5200,.5);osc('sine',98,49,1.4,.3)},
  coin:function(){osc('square',988,988,.06,.08);osc('square',1319,1319,.12,.08,.06)}
};})();
