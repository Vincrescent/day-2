// e2e-register.mjs — uji flow DAFTAR asli: fresh → gate → toggle → register → in-game.
const PORT=9334,BASE='http://localhost:4100';
const uname='reg'+Date.now().toString(36);
const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE+'/')}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
let id=0;const pending=new Map();const P=[];let ok=0;
const send=(m,p={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id)}};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');await send('Runtime.enable');
send('Runtime.consoleAPICalled').then?.(()=>{});
const t0=Date.now();
while(Date.now()-t0<20000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
await new Promise(r=>setTimeout(r,2200));
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result?.value;
const T=(name,res,extra='')=>{P.push((res?'PASS':'FAIL')+' | '+name+(extra?' — '+extra:''));if(res)ok++;};
// bersihkan state lama di profile supaya tes "fresh" valid
await ev("localStorage.removeItem('lumenvail-auth');localStorage.removeItem('lumenvail-state-v2');location.reload();1");
{const tx=Date.now();while(Date.now()-tx<15000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}}
await new Promise(r=>setTimeout(r,2200));

T('gate tampil (fresh)',await ev("!document.getElementById('authOverlay').hidden")===true);
T('awal: mode LOGIN',String(await ev("document.getElementById('authToggle').textContent")).includes('Belum punya akun'));

// toggle → register
await ev("document.getElementById('authToggle').click();1");
await new Promise(r=>setTimeout(r,300));
T('setelah toggle: tombol jadi DAFTAR',String(await ev("document.getElementById('authSubmit').textContent")).trim()==='Daftar',String(await ev("document.getElementById('authSubmit').textContent")));
T('setelah toggle: teks jadi "Sudah punya akun"',String(await ev("document.getElementById('authToggle').textContent")).includes('Sudah punya akun'));

// isi form register + submit
await ev(`document.getElementById('authUsername').value='${uname}';document.getElementById('authPassword').value='pass1234';document.getElementById('authForm').dispatchEvent(new Event('submit',{cancelable:true}));1`);
await new Promise(r=>setTimeout(r,3000));
T('overlay hilang setelah DAFTAR',await ev("document.getElementById('authOverlay').hidden")===true);
T('toast "Akun dibuat" muncul',String(await ev("document.querySelector('.toast')?.textContent||''")).includes('Akun dibuat'),String(await ev("document.querySelector('.toast')?.textContent||''")));
T('token tersimpan',String(await ev("localStorage.getItem('lumenvail-auth')")).length>=32);
T('gem baru 16000',String(await ev("document.getElementById('gemCount').textContent")).replace('.','').includes('16000'),String(await ev("document.getElementById('gemCount').textContent")));

// reload → auto-login ke akun baru (WAJIB sebelum cek server, karena /api/login
// menggantikan token di DB → token lama client jadi tidak valid)
await ev("location.reload();1");
const t1=Date.now();while(Date.now()-t1<15000){const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(rs.result&&rs.result.value==='complete')break;await new Promise(r=>setTimeout(r,300))}
await new Promise(r=>setTimeout(r,2500));
T('reload: tidak ke gate (auto-login)',await ev("document.getElementById('authOverlay').hidden")===true,
  'token='+String(await ev("localStorage.getItem('lumenvail-auth')")).slice(0,10)+' boot='+await ev("!!window.__lumenveilBooted")+' mode='+(await ev("(document.getElementById('modeBadge')||{}).textContent")));
T('reload: gem 16000 (akun baru)',String(await ev("document.getElementById('gemCount').textContent")).replace('.','').includes('16000'),String(await ev("document.getElementById('gemCount').textContent")));

// cek di server: user benar-benar ada (login ulang — ini menggantikan token, jadi di akhir)
const r=await fetch(BASE+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,password:'pass1234'})});
const d=await r.json();
T('server: user ada di DB (login ulang OK)',d.token?true:false,d.user?.username||JSON.stringify(d).slice(0,80));

console.log(P.join('\n'));
console.log('\n===== REGISTER FLOW:',ok+'/'+P.length,'PASS =====');
ws.close();process.exit(0);
