/* ══════════════════════════════════════════════════════════════════════
   SCENE 3D — cinematic wish (Three.js r128 vendored di js/vendor/)
   Satu siklus orb (durasi diskalakan `DUR`):
     intro → summon → charging → burst → done
   1× pull  : DUR penuh (4.8s, ★5 5.4s + meteor + god rays)
     10× pull : DUR ringkas 1.5s/orb berurutan; ★5 di batch tetap dapat durasi penuh
   Abort  : Scene3D.abort()  → hentikan loop rAF + reset scene (dipakai Skip)
   Dispose: Scene3D.dispose() → bebaskan geometry/material/texture/renderer
   Fallback: tanpa THREE/WebGL → Scene2D (CSS only)
   ══════════════════════════════════════════════════════════════════════ */
(function(){'use strict';

window.Scene3D={ready:false,engine:null,
  run:function(stage,results,done){
    if(!this.ready||!this.engine)return window.Scene2D.run(stage,results,done);
    this.engine.play(results,done);
  },
  abort:function(){ if(this.engine&&this.engine.abort)this.engine.abort(); else window.Scene2D.abort&&window.Scene2D.abort(); },
  dispose:function(){ if(this.engine&&this.engine.dispose)this.engine.dispose(); }
};

function boot(){
  if(!window.THREE)return;
  var THREE=window.THREE;
  try{
    var canvas=document.getElementById('gl');
    var renderer=new THREE.WebGLRenderer({canvas:canvas,alpha:true,antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.setSize(innerWidth,innerHeight);
    var scene=new THREE.Scene();
    var camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,100);
    var BASE_Z=7; camera.position.z=BASE_Z;

    /* registry resource → dipakai dispose() */
    var RES=[]; function keep(x){if(x&&typeof x.dispose==='function')RES.push(x);return x}

    /* tekstur sprite generatif (radial gradient ke canvas) — bukan file eksternal */
    function softSprite(inner,outer){
      var c=document.createElement('canvas');c.width=c.height=128;
      var g=c.getContext('2d'),rg=g.createRadialGradient(64,64,0,64,64,64);
      rg.addColorStop(0,inner);rg.addColorStop(.4,outer);rg.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=rg;g.fillRect(0,0,128,128);
      return keep(new THREE.CanvasTexture(c));
    }
    var tex=softSprite('rgba(255,255,255,1)','rgba(255,255,255,.35)');

    /* ── starfield ── */
    var STAR=900,sPos=new Float32Array(STAR*3);
    for(var i=0;i<STAR;i++){
      var r=4+Math.random()*8,a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1);
      sPos[i*3]=r*Math.sin(b)*Math.cos(a);sPos[i*3+1]=r*Math.sin(b)*Math.sin(a);sPos[i*3+2]=r*Math.cos(b)-3;
    }
    var starGeo=keep(new THREE.BufferGeometry());
    starGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3));
    var stars=new THREE.Points(starGeo,keep(new THREE.PointsMaterial({map:tex,color:0x9bbcff,size:.09,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending})));
    scene.add(stars);

    /* ── orb: kristal + halo + 2 ring ── */
    var orbGroup=new THREE.Group();scene.add(orbGroup);
    var gem=new THREE.Mesh(keep(new THREE.IcosahedronGeometry(1.05,1)),keep(new THREE.MeshStandardMaterial({color:0xffbf50,emissive:0xff7b18,emissiveIntensity:2.5,roughness:.15,metalness:.4,flatShading:true,transparent:true,opacity:.98})));
    var halo=new THREE.Sprite(keep(new THREE.SpriteMaterial({map:tex,color:0xffc860,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})));
    halo.scale.setScalar(5);
    var ring=new THREE.Mesh(keep(new THREE.TorusGeometry(1.55,.02,8,90)),keep(new THREE.MeshBasicMaterial({color:0xffd56b,transparent:true,opacity:.85,blending:THREE.AdditiveBlending})));
    var ring2=new THREE.Mesh(keep(new THREE.TorusGeometry(2.1,.008,8,90)),keep(new THREE.MeshBasicMaterial({color:0x8fb4ff,transparent:true,opacity:.5,blending:THREE.AdditiveBlending})));
    orbGroup.add(gem,halo,ring,ring2);
    var coreLight=new THREE.PointLight(0xffb83d,6,14);orbGroup.add(coreLight);

    /* ── meteor khusus ★5 ── */
    var meteor=new THREE.Group();
    var mHead=new THREE.Sprite(keep(new THREE.SpriteMaterial({map:tex,color:0xffe08a,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})));
    mHead.scale.setScalar(1.6);
    var mTail=new THREE.Mesh(keep(new THREE.CylinderGeometry(.12,.015,6,10,1,true)),keep(new THREE.MeshBasicMaterial({color:0xffd36b,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})));
    mTail.rotation.x=Math.PI/2;mTail.position.z=3;
    meteor.add(mHead,mTail);scene.add(meteor);

    /* ── charging particles ── */
    var CH=700,chPos=new Float32Array(CH*3),chHome=[];
    for(i=0;i<CH;i++){
      var q=Math.random()*Math.PI*2,rr=2.2+Math.random()*3.5;
      var x=Math.cos(q)*rr,y=(Math.random()-.5)*4.5,z=Math.sin(q)*rr;
      chPos[i*3]=x;chPos[i*3+1]=y;chPos[i*3+2]=z;chHome.push([x,y,z]);
    }
    var chGeo=keep(new THREE.BufferGeometry());
    chGeo.setAttribute('position',new THREE.BufferAttribute(chPos,3));
    var chargePts=new THREE.Points(chGeo,keep(new THREE.PointsMaterial({map:tex,color:0xffcf6a,size:.09,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})));
    scene.add(chargePts);

    /* ── burst particles ── */
    var BU=900,buPos=new Float32Array(BU*3),buVel=[];
    for(i=0;i<BU;i++)buVel.push(new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize().multiplyScalar(.04+Math.random()*.13));
    var buGeo=keep(new THREE.BufferGeometry());
    buGeo.setAttribute('position',new THREE.BufferAttribute(buPos,3));
    var burstPts=new THREE.Points(buGeo,keep(new THREE.PointsMaterial({map:tex,color:0xffd36b,size:.14,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending})));
    scene.add(burstPts);

    /* ── shockwave rings ── */
    function shock(color){var m=new THREE.Mesh(keep(new THREE.RingGeometry(.86,1,48)),keep(new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending})));scene.add(m);return m}
    var wave1=shock(0xffe9b0),wave2=shock(0xb08cff);

    /* ── god rays ★5 ── */
    var rayGroup=new THREE.Group();
    for(i=0;i<6;i++){
      var ray=new THREE.Mesh(keep(new THREE.ConeGeometry(1.1,7,10,1,true)),keep(new THREE.MeshBasicMaterial({color:0xffdf8a,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending})));
      ray.rotation.z=Math.PI/2;ray.rotation.y=i*(Math.PI/3);rayGroup.add(ray);
    }
    scene.add(rayGroup);
    var amb=new THREE.AmbientLight(0x596dff,1.6),fill=new THREE.PointLight(0x6e7fff,3,16);
    scene.add(amb,fill);

    function easeOut(p){return 1-Math.pow(1-p,3)}
    var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ── render loop idle ── */
    var playing=false,raf=0;
    function idle(){
      raf=requestAnimationFrame(idle);
      var t=performance.now();
      stars.rotation.y=t*.000025;ring.rotation.z-=.018;ring2.rotation.z+=.01;
      if(!playing)renderer.render(scene,camera);
    }
    idle();

    window.addEventListener('resize',onResize);
    function onResize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}

    window.Scene3D.ready=true;

    /* ═══════════ ENGINE ═══════════ */
    var state={cancel:false,doneFired:false};

    function resetScene(col,legendary){
      gem.material.color.setHex(col);
      gem.material.emissive.setHex(legendary?0xff9a20:(col===0xb879ff?0x8b3dff:0x1e6fd0));
      gem.material.emissiveIntensity=2.5;
      halo.material.color.setHex(col);halo.material.opacity=0;halo.scale.setScalar(5);
      ring.material.color.setHex(col);coreLight.color.setHex(col);coreLight.intensity=6;
      chargePts.material.color.setHex(col);burstPts.material.color.setHex(col);
      mHead.material.color.setHex(legendary?0xffe08a:col);
      mTail.material.color.setHex(legendary?0xffd36b:col);
      mHead.material.opacity=0;mTail.material.opacity=0;
      orbGroup.scale.setScalar(.01);orbGroup.rotation.set(0,0,0);
      chargePts.material.opacity=0;burstPts.material.opacity=0;
      for(var j=0;j<CH;j++){chPos[j*3]=chHome[j][0];chPos[j*3+1]=chHome[j][1];chPos[j*3+2]=chHome[j][2]}
      chGeo.attributes.position.needsUpdate=true;
      buPos.fill(0);buGeo.attributes.position.needsUpdate=true;
      wave1.scale.setScalar(1);wave2.scale.setScalar(1);
      wave1.material.opacity=0;wave2.material.opacity=0;
      rayGroup.children.forEach(function(r){r.material.opacity=0});
      camera.position.set(0,0,BASE_Z);
      stars.material.opacity=.8;
    }

    /* Satu siklus orb untuk SATU hasil. onDone dipanggil saat selesai/abort. */
    function cycle(result,onDone){
      var legendary=result.rarity===5,epic=result.rarity===4,
          col=legendary?0xffd05c:epic?0xb879ff:0x55baff;
      resetScene(col,legendary);
      var cap=document.getElementById('stageCaption'),flash=document.getElementById('flash');
      var DUR=reduced?300:(durOverride||(legendary?5400:epic?4800:4400));
      var start=performance.now(),fired={},shake=0;
      playing=true;

      function once(k,t0,fn){if(!fired[k]&&performance.now()-start>=t0){fired[k]=true;fn()}}

      function anim(){
        if(state.cancel){playing=false;return onDone();}
        var el=performance.now()-start,p=Math.min(1,el/DUR);
        /* rasio fase tetap sama walau DUR berubah (mode ringkas 10×) */
        var fIntro=.21,fSummonEnd=.52,fChargeEnd=.83;
        var introEnd=DUR*fIntro;

        if(el<introEnd){
          camera.position.z=BASE_Z-easeOut(el/introEnd)*1.4;
        }

        if(legendary&&el>DUR*.19&&el<DUR*.46){
          var mp=(el-DUR*.19)/(DUR*.27);
          once('whoosh',DUR*.19,function(){SFX.whoosh();SFX.riser()});
          meteor.position.set(6-mp*12,4-mp*7,-mp*2);
          mHead.material.opacity=mTail.material.opacity=Math.sin(mp*Math.PI)*.95;
          meteor.rotation.z=Math.atan2(-7,-12);
        }

        if(el>=introEnd&&el<DUR*fSummonEnd){
          once('summon',introEnd,function(){
            cap.textContent=legendary?'Bintang jatuh pertanda…':'Jalur astral terbuka…';
            SFX.click();SFX.tick();if(legendary)SFX.chime(5);
          });
          var sp=easeOut((el-introEnd)/(DUR*fSummonEnd-introEnd));
          orbGroup.scale.setScalar(.01+sp*1.05);
          orbGroup.rotation.y+=.04+sp*.05;orbGroup.rotation.x+=.02;
          halo.material.opacity=sp;
          camera.position.z=BASE_Z-1.4;
        }

        if(el>=DUR*fSummonEnd&&el<DUR*fChargeEnd){
          once('charge',DUR*fSummonEnd,function(){
            cap.textContent=legendary?'TEKANAN TAKDIR MENINGKAT':'Resonansi terkumpul…';
            SFX.riser();
          });
          var cp=(el-DUR*fSummonEnd)/(DUR*(fChargeEnd-fSummonEnd));
          chargePts.material.opacity=.55+cp*.45;
          var speed=.02+cp*.06;
          for(var j=0;j<CH;j++){var k=j*3;
            chPos[k]+=(0-chPos[k])*speed;chPos[k+1]+=(0-chPos[k+1])*speed;chPos[k+2]+=(0-chPos[k+2])*speed;}
          chGeo.attributes.position.needsUpdate=true;
          orbGroup.rotation.y+=.06+cp*.34;
          orbGroup.scale.setScalar((1.06+cp*.22)*(1+Math.sin(el*.04)*.06*cp));
          gem.material.emissiveIntensity=2.5+cp*7;
          coreLight.intensity=6+cp*10;
          halo.scale.setScalar(5+cp*2.5);halo.material.opacity=.9+cp*.1;
          if(legendary)rayGroup.children.forEach(function(r){r.material.opacity=cp*.12;r.rotation.y+=.01});
          camera.position.z=BASE_Z-1.4-cp*.5;
          once('tick',DUR*.62,function(){SFX.tick()});
          once('tick2',DUR*.76,function(){SFX.tick()});
        }

        if(el>=DUR*fChargeEnd){
          if(!fired.burst){fired.burst=true;
            cap.textContent=legendary?'★ ★ ★':'RESONANSI';
            SFX.impact(legendary?5:epic?4:3);
            if(legendary)SFX.fanfare();else SFX.chime(epic?4:3);
            shake=legendary?1:epic?.55:.35;
            flash.style.transition='opacity .08s';
            flash.style.opacity=legendary?'.95':epic?'.6':'.4';
            setTimeout(function(){flash.style.transition='opacity .5s';flash.style.opacity='0'},legendary?160:80);
          }
          var bp=(el-DUR*fChargeEnd)/(DUR*(1-fChargeEnd)),be=easeOut(Math.min(1,bp*1.4));
          chargePts.material.opacity=0;
          burstPts.material.opacity=1-be*.9;
          for(var j2=0;j2<BU;j2++){var k2=j2*3;
            buPos[k2]+=buVel[j2].x*2;buPos[k2+1]+=buVel[j2].y*2;buPos[k2+2]+=buVel[j2].z*2;
            buPos[k2+1]-=bp*.012;}
          buGeo.attributes.position.needsUpdate=true;
          var w1=easeOut(Math.min(1,bp*1.8));
          wave1.scale.setScalar(.1+w1*7);wave1.material.opacity=(1-w1)*.85;
          var w2=easeOut(Math.min(1,Math.max(0,bp-.08)*1.6));
          wave2.scale.setScalar(.1+w2*5.5);wave2.material.opacity=(1-w2)*.6;
          orbGroup.scale.setScalar(1.28*(1-be*.55));
          gem.material.emissiveIntensity=Math.max(0,(1-bp)*9);
          coreLight.intensity=Math.max(0,(1-bp)*16);
          halo.material.opacity=1-bp;halo.scale.setScalar(5+be*6);
          if(legendary)rayGroup.children.forEach(function(r){r.material.opacity=Math.max(0,(1-bp)*.4);r.rotation.y+=.02});
          stars.material.opacity=.8*(1-bp*.5);
          shake*=.92;
          camera.position.x=(Math.random()-.5)*shake*.5;
          camera.position.y=(Math.random()-.5)*shake*.5;
        }

        if(p<1){renderer.render(scene,camera);requestAnimationFrame(anim)}
        else{clear(p)}

        function clear(){
          playing=false;
          mHead.material.opacity=0;mTail.material.opacity=0;
          burstPts.material.opacity=0;chargePts.material.opacity=0;
          wave1.material.opacity=0;wave2.material.opacity=0;
          halo.material.opacity=0;rayGroup.children.forEach(function(r){r.material.opacity=0});
          stars.material.opacity=.8;camera.position.set(0,0,BASE_Z);
          cap.textContent='';flash.style.opacity='0';
          onDone();
        }
      }
      anim();
    }

    /* mode ringkas untuk 10×: ~1.5s/orb (spek), ★5 tetap durasi penuh */
    var briefMode=false,durOverride=0;
    function cycleBrief(result,onDone){
      if(!briefMode||result.rarity===5)return cycle(result,onDone);
      durOverride=1500;
      cycle(result,function(){durOverride=0;onDone()});
    }

    window.Scene3D.engine={
      play:function(results,done){
        state.cancel=false;state.doneFired=false;
        briefMode=results.length>1;
        var i=0;
        var tally=document.getElementById('batchTally');
        if(tally){tally.hidden=results.length<10;
          if(results.length>=10)tally.textContent='0 / '+results.length;}
        (function next(){
          if(state.cancel){if(tally)tally.hidden=true;return finish();}
          if(i>=results.length){if(tally)tally.hidden=true;return finish();}
          var r=results[i++];
          if(tally&&results.length>=10)tally.textContent=i+' / '+results.length;
          cycleBrief(r,function(){setTimeout(next,briefMode?90:0)});
        })();
        function finish(){if(!state.doneFired){state.doneFired=true;done()}}
      },
      abort:function(){
        state.cancel=true;playing=false;
        briefMode=false;durOverride=0; /* jangan bocor ke run berikutnya */
        var cap=document.getElementById('stageCaption'),flash=document.getElementById('flash'),
            tally=document.getElementById('batchTally');
        if(cap)cap.textContent='';if(flash)flash.style.opacity='0';if(tally)tally.hidden=true;
        mHead.material.opacity=0;mTail.material.opacity=0;
        burstPts.material.opacity=0;chargePts.material.opacity=0;
        wave1.material.opacity=0;wave2.material.opacity=0;
        halo.material.opacity=0;rayGroup.children.forEach(function(r){r.material.opacity=0});
        stars.material.opacity=.8;camera.position.set(0,0,BASE_Z);
      },
      dispose:function(){
        cancelAnimationFrame(raf);
        RES.forEach(function(x){try{x.dispose()}catch(e){}});
        RES.length=0;
        window.removeEventListener('resize',onResize);
        renderer.dispose();
        if(renderer.forceContextLoss)renderer.forceContextLoss();
        window.Scene3D.ready=false;window.Scene3D.engine=null;
      }
    };
  }catch(e){window.Scene3D.ready=false}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();
})();
