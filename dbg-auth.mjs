// dbg-auth.mjs — telusuri mengapa /me reject token valid
const BASE='http://localhost:4100';
const uname='dbg'+Date.now().toString(36);
const reg=await (await fetch(BASE+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,password:'pass1234'})})).json();
console.log('register:',reg.token?'OK':'FAIL',reg.error||'');
const tok=reg.token;
const tests=[
  '*** '+tok,          // spasi sebelum token (client-side)
  'Bearer ' + tok,     // Bearer space token
  tok,                 // raw token tanpa Bearer
];
for(const h of tests){
  try{
    const r=await fetch(BASE+'/api/me',{method:'GET',headers:{'Authorization':h}});
    console.log('header='+JSON.stringify(h).slice(0,50),'→ status',r.status,'body=',(await r.text()).slice(0,100));
  }catch(e){console.log('header='+JSON.stringify(h).slice(0,50),' THROW:',e.message)}
}
// cek juga token di DB
const mysql=require('mysql2/promise');
const pool=mysql.createPool({host:'127.0.0.1',user:'root',password:'',database:'lumenveil_db'});
const [rows]=await pool.query('SELECT id,username,LENGTH(token) tok_len FROM users WHERE username=?',[uname]);
console.log('DB token len:',rows[0]?.tok_len,'token hex:',rows[0]?tok.toString(16).slice(0,16):'(no rows)');
await pool.end();
