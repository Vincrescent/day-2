/* ══════════════════════════════════════════════════════════════════
   SCENE 3D — cinematic wish sequence (Three.js r128, global THREE)
   Timeline (ms, sinkron dengan SFX):
     0    – 1000  intro      : starfield drift + kamera zoom-in
     1000 – 2500  summon     : orb/pecahan kristal muncul; ★5: comet
                               melintas dulu (meteor) baru orb menyala emas
     2500 – 4000  charging   : partikel tersedot, orb makin terang + spin cepat
     4000 – 4800  burst      : ledakan partikel + shockwave + flash + shake
     4800         done       : callback → UI reveal kartu
   Fallback: kalau THREE tidak load / WebGL mati → Scene2D (CSS).
   ══════════════════════════════════════════════════════════════════ */
(function(){'use strict';

window.Scene3D={ready:false,engine:null,
  run:function(stage,results,done){
    if(!this.ready||!this.engine)return window.Scene2D.run(stage,results,done);
    this.engine.play(results,done);
  }};

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
    var BASE_Z=7;camera.position.z=BASE_Z;

    /* ---- sprite tekstur: radial gradient digambar ke canvas (generatif,
       bukan file eksternal). Dipakai untuk semua partikel/glow → jauh lebih
       halus daripada point kotak default, dan tetap 1 draw-call per system. */
    function softSprite(inner,outer){
      var c=document.createElement('canvas');c.width=c.height=128;
      var g=c.getContext('2d'),rg=g.createRadialGradient(64,64,0,64,64,64);
      rg.addColorStop(0,inner);rg.addColorStop(.4,outer);rg.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=rg;g.fillRect(0,0,128,128);
      var t=new THREE.CanvasTexture(c);return t;
    }
    var tex=softSprite('rgba(255,255,255,1)','rgba(255,255,255,.35)');

    /* ---- starfield latar (900 pts, additive) ---- */
    var STAR=900,sPos=new Float32Array(STAR*3);
    for(var i=0;i<STAR;i++){
      var r=4+Math.random()*8,a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1);
      sPos[i*3]=r*Math.sin(b)*Math.cos(a);sPos[i*3+1]=r*Math.sin(b)*Math.sin(a);sPos[i*3+2]=r*Math.cos(b)-3;
    }
    var starGeo=new THREE.BufferGeometry();
    starGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3));
    var stars=new THREE.Points(starGeo,new THREE.PointsMaterial({map:tex,color:0x9bbcff,size:.09,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending}));
    scene.add(stars);

    /* ---- orb group: kristal + halo glow + ring ---- */
    var orbGroup=new THREE.Group();scene.add(orbGroup);
    var gem=new THREE.Mesh(new THREE.IcosahedronGeometry(1.05,1),
      new THREE.MeshStandardMaterial({color:0xffbf50,emissive:0xff7b18,emissiveIntensity:2.5,roughness:.15,metalness:.4,flatShading:true,transparent:true,opacity:.98}));
    var halo=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color:0xffc860,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));
    halo.scale.setScalar(5);
    var ring=new THREE.Mesh(new THREE.TorusGeometry(1.55,.02,8,90),
      new THREE.MeshBasicMaterial({color:0xffd56b,transparent:true,opacity:.85,blending:THREE.AdditiveBlending}));
    var ring2=new THREE.Mesh(new THREE.TorusGeometry(2.1,.008,8,90),
      new THREE.MeshBasicMaterial({color:0x8fb4ff,transparent:true,opacity:.5,blending:THREE.AdditiveBlending}));
    orbGroup.add(gem,halo,ring,ring2);
    var coreLight=new THREE.PointLight(0xffb83d,6,14);orbGroup.add(coreLight);

    /* ---- meteor ★5: streak comet melintas sebelum orb menyala ---- */
    var meteor=new THREE.Group();
    var mHead=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color:0xffe08a,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    mHead.scale.setScalar(1.6);
    var mTail=new THREE.Mesh(new THREE.CylinderGeometry(.12,.015,6,10,1,true),
      new THREE.MeshBasicMaterial({color:0xffd36b,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    mTail.rotation.x=Math.PI/2;mTail.position.z=3;
    meteor.add(mHead,mTail);scene.add(meteor);

    /* ---- charging particles: tersedot ke pusat ---- */
    var CH=700,chPos=new Float32Array(CH*3),chHome=[];
    for(i=0;i<CH;i++){
      var q=Math.random()*Math.PI*2,rr=2.2+Math.random()*3.5;
      var x=Math.cos(q)*rr,y=(Math.random()-.5)*4.5,z=Math.sin(q)*rr;
      chPos[i*3]=x;chPos[i*3+1]=y;chPos[i*3+2]=z;
      chHome.push([x,y,z]);
    }
    var chGeo=new THREE.BufferGeometry();
    chGeo.setAttribute('position',new THREE.BufferAttribute(chPos,3));
    var chargePts=new THREE.Points(chGeo,new THREE.PointsMaterial({map:tex,color:0xffcf6a,size:.09,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    scene.add(chargePts);

    /* ---- burst particles: meledak dari pusat ---- */
    var BU=900,buPos=new Float32Array(BU*3),buVel=[];
    for(i=0;i<BU;i++){
      buVel.push(new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize().multiplyScalar(.04+Math.random()*.13));
    }
    var buGeo=new THREE.BufferGeometry();
    buGeo.setAttribute('position',new THREE.BufferAttribute(buPos,3));
    var burstPts=new THREE.Points(buGeo,new THREE.PointsMaterial({map:tex,color:0xffd36b,size:.14,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    scene.add(burstPts);

    /* ---- shockwave: 2 cincin mengembang saat burst ---- */
    function shock(color){var m=new THREE.Mesh(new THREE.RingGeometry(.86,1,48),
      new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
      scene.add(m);return m}
    var wave1=shock(0xffe9b0),wave2=shock(0xb08cff);

    /* ---- god rays ★5: kerucut additive yang berputar + fade ---- */
    var rayGroup=new THREE.Group();
    for(i=0;i<6;i++){
      var ray=new THREE.Mesh(new THREE.ConeGeometry(1.1,7,10,1,true),
        new THREE.MeshBasicMaterial({color:0xffdf8a,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
      ray.rotation.z=Math.PI/2;ray.rotation.y=i*(Math.PI/3);
      rayGroup.add(ray);
    }
    scene.add(rayGroup);

    scene.add(new THREE.AmbientLight(0x596dff,1.6),new THREE.PointLight(0x6e7fff,3,16));

    /* ---- easing helpers ---- */
    function easeOut(p){return 1-Math.pow(1-p,3)}
    function easeIn(p){return p*p*p}

    /* ---- render loop idle (starfield + ring selalu hidup) ---- */
    function idle(){
      requestAnimationFrame(idle);
      var t=performance.now();
      stars.rotation.y=t*.000025;
      ring.rotation.z-=.018;ring2.rotation.z+=.01;
      if(!playing)renderer.render(scene,camera);
    }
    var playing=false;
    idle();

    window.addEventListener('resize',function(){
      camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
      renderer.setSize(innerWidth,innerHeight);
    });

    window.Scene3D.ready=true;
    window.Scene3D.engine={play:function(results,done){
      var legendary=results.some(function(x){return x.rarity===5}),
          epic=!legendary&&results.some(function(x){return x.rarity===4}),
          col=legendary?0xffd05c:epic?0xb879ff:0x55baff;

      /* reset state semua objek */
      gem.material.color.setHex(col);
      gem.material.emissive.setHex(legendary?0xff9a20:epic?0x8b3dff:0x1e6fd0);
      halo.material.color.setHex(col);ring.material.color.setHex(col);
      coreLight.color.setHex(col);coreLight.intensity=6;
      chargePts.material.color.setHex(col);burstPts.material.color.setHex(col);
      mHead.material.color.setHex(legendary?0xffe08a:col);
      mTail.material.color.setHex(legendary?0xffd36b:col);
      orbGroup.scale.setScalar(.01);orbGroup.rotation.set(0,0,0);
      rayGroup.children.forEach(function(r){r.material.opacity=0});
      for(i=0;i<CH;i++){chPos[i*3]=chHome[i][0];chPos[i*3+1]=chHome[i][1];chPos[i*3+2]=chHome[i][2]}
      chGeo.attributes.position.needsUpdate=true;
      buPos.fill(0);buGeo.attributes.position.needsUpdate=true;
      wave1.scale.setScalar(1);wave2.scale.setScalar(1);
      wave1.material.opacity=0;wave2.material.opacity=0;
      mHead.material.opacity=0;mTail.material.opacity=0;

      var cap=document.getElementById('stageCaption'),
          flash=document.getElementById('flash'),
          D=legendary?5400:4800,      /* ★5 sedikit lebih panjang = lebih dramatis */
          start=performance.now(),fired={},shake=0;
      playing=true;

      function once(k,t0,fn){if(!fired[k]&&performance.now()-start>=t0){fired[k]=true;fn()}}

      function anim(){
        var now=performance.now(),el=now-start,p=Math.min(1,el/D);
        var introEnd=legendary?1.6e3:1e3;

        /* phase 1 — INTRO: kamera zoom mendekat perlahan */
        if(el<introEnd){
          camera.position.z=BASE_Z-easeOut(el/introEnd)*1.4;
          stars.material.opacity=.8;
        }

        /* ★5: METEOR melintas 0.9–2.2s (komik: langit terbelah) */
        if(legendary&&el>900&&el<2200){
          var mp=(el-900)/1300;
          once('whoosh',900,function(){SFX.whoosh();SFX.riser()});
          meteor.position.set(6-mp*12,4-mp*7,-mp*2);
          mHead.material.opacity=mTail.material.opacity=Math.sin(mp*Math.PI)*.95;
          meteor.rotation.z=Math.atan2(-7,-12);
        }

        /* phase 2 — SUMMON: orb scale-in + rotasi */
        if(el>=introEnd&&el<2500){
          once('summon',introEnd,function(){
            cap.textContent=legendary?'Bintang jatuh pertanda…':'Jalur astral terbuka…';
            SFX.click();SFX.tick();
            if(legendary){SFX.chime(5)}
          });
          var sp=easeOut((el-introEnd)/(2500-introEnd));
          orbGroup.scale.setScalar(.01+sp*1.05);
          orbGroup.rotation.y+=.04+sp*.05;orbGroup.rotation.x+=.02;
          halo.material.opacity=sp;
          camera.position.z=BASE_Z-1.4;
        }

        /* phase 3 — CHARGING: partikel tersedot, spin + cahaya naik terus */
        if(el>=2500&&el<4000){
          once('charge',2500,function(){
            cap.textContent=legendary?'TEKANAN TAKDIR MENINGKAT':'Resonansi terkumpul…';
            SFX.riser();
          });
          var cp=(el-2500)/1500;
          chargePts.material.opacity=.55+cp*.45;
          var speed=.02+cp*.06;
          for(var j=0;j<CH;j++){var k=j*3;
            chPos[k]+=(0-chPos[k])*speed;chPos[k+1]+=(0-chPos[k+1])*speed;chPos[k+2]+=(0-chPos[k+2])*speed;}
          chGeo.attributes.position.needsUpdate=true;
          orbGroup.rotation.y+=.06+cp*.34;
          var puls=1+Math.sin(el*.04)*.06*cp;
          orbGroup.scale.setScalar((1.06+cp*.22)*puls);
          gem.material.emissiveIntensity=2.5+cp*7;
          coreLight.intensity=6+cp*10;
          halo.scale.setScalar(5+cp*2.5);halo.material.opacity=.9+cp*.1;
          if(legendary)rayGroup.children.forEach(function(r){r.material.opacity=cp*.12;r.rotation.y+=.01});
          camera.position.z=BASE_Z-1.4-cp*.5;
          once('tick',3200,function(){SFX.tick()});once('tick2',3700,function(){SFX.tick()});
        }

        /* phase 4 — BURST: peledakan + shockwave + flash + shake */
        if(el>=4000){
          if(!fired.burst){fired.burst=true;
            cap.textContent=legendary?'★ ★ ★':'RESONANSI';
            SFX.impact(legendary?5:epic?4:3);
            if(legendary)SFX.fanfare();else SFX.chime(epic?4:3);
            shake=legendary?1:epic?.55:.35;
            flash.style.opacity=legendary?'.95':epic?'.6':'.4';
            setTimeout(function(){flash.style.transition='opacity .5s';flash.style.opacity='0'},legendary?160:80);
          }
          var bp=(el-4000)/(D-4000),be=easeOut(Math.min(1,bp*1.4));
          chargePts.material.opacity=0;
          burstPts.material.opacity=1-be*.9;
          for(j=0;j<BU;j++){k=j*3;
            buPos[k]+=buVel[j].x*2;buPos[k+1]+=buVel[j].y*2;buPos[k+2]+=buVel[j].z*2;
            buPos[k+1]-=bp*.012;} /* sedikit gravitasi biar natural */
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
          /* camera shake meluruh eksponensial */
          shake*=.92;
          camera.position.x=(Math.random()-.5)*shake*.5;
          camera.position.y=(Math.random()-.5)*shake*.5;
        }

        if(p<1){renderer.render(scene,camera);requestAnimationFrame(anim)}
        else{
          playing=false;
          mHead.material.opacity=0;mTail.material.opacity=0;
          burstPts.material.opacity=0;chargePts.material.opacity=0;
          wave1.material.opacity=0;wave2.material.opacity=0;
          halo.material.opacity=0;rayGroup.children.forEach(function(r){r.material.opacity=0});
          stars.material.opacity=.8;camera.position.set(0,0,BASE_Z);
          cap.textContent='';flash.style.opacity='0';
          done();
        }
      }
      anim();
    }};
  }catch(e){window.Scene3D.ready=false}
}

/* ---- load three.js via CDN; kalau gagal → flag ready=false (Scene2D) ---- */
try{
  var s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  s.onload=boot;
  s.onerror=function(){window.Scene3D.ready=false};
  document.head.appendChild(s);
}catch(e){window.Scene3D.ready=false}
})();
