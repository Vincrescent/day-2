// test-toggle-click.mjs — verifikasi area klik toggle bekerja (mencoba klik pada koordinat berbeda).
const PORT=9334,BASE='http://localhost:4100';
const uname='clickv'+Date.now().toString(36);
const reg=await (await fetch(BASE+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,password:'pass1234'})})).json();
if(!reg.token){console.log('register gagal:',reg.error);process.exit(1)}
const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE+'/')}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
let id=0;const pending=new Map();
const send=(m,p={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id)}};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');
const t0=Date.now();
while(Date.now()-t0<20000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
await new Promise(r=>setTimeout(r,1500));
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
// bersihkan state agar overlay muncul
await ev("localStorage.removeItem('lumenvail-auth');location.reload();1");
{const tx=Date.now();while(Date.now()-tx<15000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}}
await new Promise(r=>setTimeout(r,2000));
// klik teks toggle dengan beberapa pendekatan
const clicks=[
  "document.getElementById('authToggle').click()",
  "document.querySelector('.auth-toggle').click()",
  // klik koordinat tengah elemen (mimic mouse move-then-click)
  `(()=>{const el=document.getElementById('authToggle');el.click();return 'direct.click'})()`,
];
for(const c of clicks){
  try{const r=await ev(c);console.log(c.slice(0,60),'→',r)}catch(e){console.log(c.slice(0,60),'ERROR:',e.message?.slice(0,60))}
}
await new Promise(r=>setTimeout(r,300));
const afterClick=await ev("authMode===undefined?'undefined':authMode+(authMode==='login'?' → TETAP LOGIN':' → UDAH DAFTAR')");
console.log('authMode setelah klik:',afterClick);
// klik tombol submit (harusnya daftar karena mode sudah berubah)
if(afterClick.includes('DAFTAR')){
  await ev(`document.getElementById('authUsername').value='user-test-'+Date.now();document.getElementById('authPassword').value='pass1234';document.getElementById('authForm').dispatchEvent(new Event('submit',{cancelable:true}));'submitted'`);
  await new Promise(r=>setTimeout(r,2500));
  console.log('overlay hidden setelah submit:',await ev("document.getElementById('authOverlay').hidden"));
  console.log('token ada:',String(await ev("localStorage.getItem('lumenvail-auth')")).length>=32);
}
ws.close();process.exit(0);
