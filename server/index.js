/* ══════════════════════════════════════════════════════════════════════
   LUMENVEIL server — Express + MariaDB (XAMPP, root/no password).
   Satu port (4000): juga menyajikan frontend statis di atasnya.
   Jalankan:  cd server && node index.js
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
const path=require('path'),crypto=require('crypto'),express=require('express');
const mysql=require('mysql2/promise');

const PORT=process.env.PORT||4100;
const app=express();
app.use(express.json());
/* CORS longgar agar buka via file:// atau port lain tetap bisa (demo) */
app.use((req,res,next)=>{res.header('Access-Control-Allow-Origin','*');
  res.header('Access-Control-Allow-Headers','Content-Type,Authorization');
  res.header('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  if(req.method==='OPTIONS')return res.sendStatus(204);next();});

const pool=mysql.createPool({host:'127.0.0.1',port:3306,user:'root',password:'',
  database:'lumenveil_db',connectionLimit:5,waitForConnections:true});

/* ── util auth ── */
function hashPass(pw,salt){return crypto.scryptSync(pw,salt,32).toString('hex')}
function newToken(){return crypto.randomBytes(24).toString('hex')}
async function authUser(req,res,next){
  const h=req.headers.authorization||'';
  const tok=h.replace(/^Bearer /i,'');
  if(!tok)return res.status(401).json({error:'Token tidak ada'});
  const [rows]=await pool.query('SELECT id,username FROM users WHERE token=?',[tok]);
  if(!rows.length)return res.status(401).json({error:'Token tidak valid'});
  req.user=rows[0];next();
}
const VALID_BANNERS=new Set(['crown','forge']);

/* ── LOGIKA GACHA SERVER-SIDE (mirror gacha-core.js — JAGA SENJANG) ──
   RATE_5 0.6% · RATE_4 5.1% · soft pity 74 (kuadrat, clamp ≤100%) ·
   hard pity 90 · ★4 dijamin tiap 10 · 50/50 + guarantee. */
const RATE_5=0.006,RATE_4=0.051,SOFT_PITY=74,HARD_PITY=90,HARD_PITY4=10,SOPE_EXP=0.006;
function chance5(p){if(p>=HARD_PITY)return 1;
  if(p>=SOFT_PITY)return Math.min(1,RATE_5+Math.pow(p-(SOFT_PITY-1),2)*SOPE_EXP);return RATE_5}
const POOLS={ /* nama item per banner/rarity — harus sama dengan banners.js */
  crown:{f5:['Virelai'],s5:['Orin Vale','Nyra Sol'],p4:['Aster Pike','Mira Quill','Kestrel-9'],p3:['Cinder Pin','Luma Thread','Brasswing','Vesper Bell'],featured5:true},
  forge:{f5:[],s5:['Orin Vale','Nyra Sol'],p4:['Mira Quill','Kestrel-9'],p3:['Cinder Pin','Luma Thread','Brasswing','Vesper Bell'],featured5:false,featured4:'Aster Pike'}
};
const RARITY={};['Virelai','Orin Vale','Nyra Sol'].forEach(n=>RARITY[n]=5);
['Aster Pike','Mira Quill','Kestrel-9'].forEach(n=>RARITY[n]=4);
['Cinder Pin','Luma Thread','Brasswing','Vesper Bell'].forEach(n=>RARITY[n]=3);
const SIGILS={3:5,4:20,5:150};
const pick=n=>n[Math.floor(Math.random()*n.length)];
function serverPick(st,ctx){ /* st = baris banner_state */
  st.pulls++;st.pity5++;st.pity4++;
  const got5=Math.random()<chance5(st.pity5);
  const got4=!got5&&(st.pity4>=HARD_PITY4||Math.random()<RATE_4);
  if(got5){
    st.pity5=0;st.pity4=0;st.five_total++;
    st.last_five_at=st.pulls;
    const log=st.five_log?JSON.parse(st.five_log):[];
    log.push(st.last_five_at-(st.prev_five_at||0));st.five_log=JSON.stringify(log);
    st.prev_five_at=st.last_five_at;
    let featured=false;
    if(ctx.featured5){featured=st.guaranteed||Math.random()<0.5;st.guaranteed=!featured?1:0;
      if(featured)st.featured_won=(st.featured_won||0)+1;}
    const pool5=ctx.featured5?(featured?ctx.f5:ctx.s5):ctx.s5;
    return {name:pick(pool5),rarity:5,featured:!!featured};
  }
  if(got4){st.pity4=0;
    /* banner ★4-rate-up: 50% item featured saat ★4 jatuh */
    if(ctx.featured4&&Math.random()<0.5)return {name:ctx.featured4,rarity:4,featured:true};
    return {name:pick(ctx.p4),rarity:4,featured:false};}
  return {name:pick(ctx.p3),rarity:3,featured:false};
}

/* ── routes ── */
app.get('/api/health',(req,res)=>res.json({ok:true,db:!!pool.pool}));

app.post('/api/register',async(req,res)=>{
  try{
    const {username,password}=req.body||{};
    const u=String(username||'').trim(),p=String(password||'');
    if(!/^[a-zA-Z0-9_]{3,20}$/.test(u))return res.status(400).json({error:'Username 3-20 karakter huruf/angka/_'});
    if(p.length<4)return res.status(400).json({error:'Password minimal 4 karakter'});
    const [dup]=await pool.query('SELECT id FROM users WHERE username=?',[u]);
    if(dup.length)return res.status(409).json({error:'Username sudah dipakai'});
    const salt=crypto.randomBytes(8).toString('hex');
    const tok=newToken();
    const [r]=await pool.query(
      'INSERT INTO users (username,pass_hash,salt,token,gems) VALUES (?,?,?,?,16000)',[u,hashPass(p,salt),salt,tok]);
    for(const b of ['crown','forge'])
      await pool.query('INSERT INTO banner_state (user_id,banner) VALUES (?,?)',[r.insertId,b]);
    res.json({token:tok,user:{id:r.insertId,username:u,gems:16000}});
  }catch(e){console.error(e);res.status(500).json({error:'Server error: '+e.message})}
});

app.post('/api/login',async(req,res)=>{
  try{
    const {username,password}=req.body||{};
    const [rows]=await pool.query('SELECT * FROM users WHERE username=?',[String(username||'').trim()]);
    if(!rows.length)return res.status(401).json({error:'Username atau password salah'});
    const u=rows[0];
    if(hashPass(String(password||''),u.salt)!==u.pass_hash)return res.status(401).json({error:'Username atau password salah'});
    const tok=newToken();
    await pool.query('UPDATE users SET token=? WHERE id=?',[tok,u.id]);
    res.json({token:tok,user:{id:u.id,username:u.username,gems:u.gems}});
  }catch(e){console.error(e);res.status(500).json({error:'Server error: '+e.message})}
});

app.get('/api/me',authUser,async(req,res)=>{
  try{
    const [u]=await pool.query('SELECT id,username,gems,sigils,owned FROM users WHERE id=?',[req.user.id]);
    const [bs]=await pool.query('SELECT banner,pulls,pity5,pity4,guaranteed,five_total,five_log,featured_won FROM banner_state WHERE user_id=?',[req.user.id]);
    const [hist]=await pool.query('SELECT item_name,rarity,is_featured,duplicate,pulled_at,banner FROM pull_history WHERE user_id=? ORDER BY id DESC LIMIT 60',[req.user.id]);
    res.json({user:{id:u[0].id,username:u[0].username,gems:u[0].gems,sigils:u[0].sigils,
      owned:(u[0].owned&&u[0].owned!=='null')?JSON.parse(u[0].owned):{}},
      banners:Object.fromEntries(bs.map(r=>[r.banner,{pulls:r.pulls,pity5:r.pity5,pity4:r.pity4,
        guaranteed:!!r.guaranteed,fiveTotal:r.five_total,fiveLog:r.five_log?JSON.parse(r.five_log):[],featuredWon:r.featured_won}])),
      history:hist.map(h=>({name:h.item_name,rarity:h.rarity,featured:!!h.is_featured,
        duplicate:h.duplicate,time:h.pulled_at.getTime?h.pulled_at.getTime():+new Date(h.pulled_at),banner:h.banner}))});
  }catch(e){console.error(e);res.status(500).json({error:'Server error: '+e.message})}
});

app.post('/api/pull',authUser,async(req,res)=>{
  const {n,banner}=(req.body||{});
  const count=n===10?10:1;
  if(!VALID_BANNERS.has(banner))return res.status(400).json({error:'Banner tidak dikenal'});
  const cost=count===10?1600:160;
  try{
    const conn=await pool.getConnection();
    try{
      await conn.beginTransaction();
      const [rows]=await conn.query('SELECT * FROM users WHERE id=? FOR UPDATE',[req.user.id]);
      if(!rows.length)throw new Error('User hilang');
      const user=rows[0];
      if(user.gems<cost){await conn.rollback();return res.status(400).json({error:'Gems tidak cukup'})}
      const [brows]=await conn.query('SELECT * FROM banner_state WHERE user_id=? AND banner=? FOR UPDATE',[req.user.id,banner]);
      if(!brows.length)throw new Error('Banner state hilang');
      const st=brows[0];
      const ctx=POOLS[banner];
      let owned=(user.owned&&user.owned!=='null')?JSON.parse(user.owned):{};
      const out=[];
      for(let i=0;i<count;i++){
        const r=serverPick(st,ctx);
        const dup=owned[r.name]||0;
        owned[r.name]=dup+1;
        const sigil=dup>0?SIGILS[r.rarity]:0;
        out.push({...r,duplicate:sigil});
        await conn.query(
          'INSERT INTO pull_history (user_id,banner,item_name,rarity,is_featured,duplicate) VALUES (?,?,?,?,?,?)',
          [req.user.id,banner,r.name,r.rarity,r.featured?1:0,sigil]);
      }
      /* aturan 10×: tanpa ★4+ → ganti slot terakhir dengan ★4.
         Item yang digantikan harus DIBATALKAN dari owned (tidak diterima),
         dan ★4 barunya dihitung dup normal. */
      if(count>=10&&!out.some(x=>x.rarity>=4)){
        st.pity4=0;
        const last=out[out.length-1];
        owned[last.name]=Math.max(0,(owned[last.name]||0)-1);
        const r4=pick(ctx.p4);
        const dup4=owned[r4]||0;
        owned[r4]=dup4+1;
        const sigil4=dup4>0?SIGILS[4]:0;
        out[out.length-1]={name:r4,rarity:4,featured:false,duplicate:sigil4};
        await conn.query('UPDATE pull_history SET item_name=?,rarity=4,is_featured=0,duplicate=? WHERE user_id=? ORDER BY id DESC LIMIT 1',[r4,sigil4,req.user.id]);
      }
      await conn.query('UPDATE users SET gems=gems-?,sigils=sigils+?,owned=? WHERE id=?',[cost,
        out.reduce((a,x)=>a+(x.duplicate||0),0),JSON.stringify(owned),req.user.id]);
      await conn.query(
        'UPDATE banner_state SET pulls=?,pity5=?,pity4=?,guaranteed=?,five_total=?,five_log=?,last_five_at=?,prev_five_at=?,featured_won=? WHERE user_id=? AND banner=?',
        [st.pulls,st.pity5,st.pity4,st.guaranteed,st.five_total,st.five_log,st.last_five_at,st.prev_five_at,st.featured_won,req.user.id,banner]);
      await conn.commit();
      const [u2]=await conn.query('SELECT gems,sigils FROM users WHERE id=?',[req.user.id]);
      res.json({results:out,gems:u2[0].gems,sigils:u2[0].sigils,
        banner:{pulls:st.pulls,pity5:st.pity5,pity4:st.pity4,guaranteed:!!st.guaranteed}});
    }catch(e){await conn.rollback();throw e}
    finally{conn.release()}
  }catch(e){console.error(e);res.status(500).json({error:'Server error: '+e.message})}
});

app.post('/api/trade',authUser,async(req,res)=>{
  const TRADES={t1:{cost:50,gems:400},t2:{cost:200,gems:1600},t3:{cost:1000,gems:8000}};
  const t=TRADES[(req.body||{}).id];
  if(!t)return res.status(400).json({error:'Trade tidak dikenal'});
  try{
    const [r]=await pool.query('UPDATE users SET sigils=sigils-?,gems=gems+? WHERE id=? AND sigils>=?',[t.cost,t.gems,req.user.id,t.cost]);
    if(!r.affectedRows)return res.status(400).json({error:'Sigils tidak cukup'});
    const [u]=await pool.query('SELECT gems,sigils FROM users WHERE id=?',[req.user.id]);
    res.json({ok:true,gems:u[0].gems,sigils:u[0].sigils});
  }catch(e){console.error(e);res.status(500).json({error:'Server error: '+e.message})}
});

app.post('/api/topup',authUser,async(req,res)=>{
  await pool.query('UPDATE users SET gems=gems+1600 WHERE id=?',[req.user.id]);
  const [r]=await pool.query('SELECT gems FROM users WHERE id=?',[req.user.id]);
  res.json({gems:r[0].gems});
});

app.post('/api/logout',authUser,async(req,res)=>{
  await pool.query('UPDATE users SET token=NULL WHERE id=?',[req.user.id]);
  res.json({ok:true});
});

/* ── statis: sajikan frontend dari folder atas (satu port, nol CORS) ── */
app.use(express.static(path.join(__dirname,'..'),{maxAge:'0',etag:false,
  setHeaders(res){res.setHeader('Cache-Control','no-store')}}));

app.listen(PORT,()=>console.log('LUMENVEIL server: http://localhost:'+PORT));
