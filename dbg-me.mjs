// dbg-me.mjs — why does /me throw after reload? login fresh, then call /me.
const BASE='http://localhost:4100';
const uname='dbg'+Date.now().toString(36);
const reg=await (await fetch(BASE+'/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:uname,password:'pass1234'})})).json();
console.log('register token:',reg.token?'OK':'FAIL',reg.error||'');
const tok=reg.token;
// call /me exactly like client
try{
  const r=await fetch(BASE+'/api/me',{method:'GET',headers:{'Authorization':'***'+tok}});
  const text=await r.text();
  console.log('me status:',r.status);
  console.log('me body:',text.slice(0,300));
  const j=JSON.parse(text);
  console.log('me.user:',JSON.stringify(j.user),'\nme.banner:',JSON.stringify(j.banner),'\nme.history len:',(j.history||[]).length);
}catch(e){console.log('me THROW:',e.message)}
// now simulate client: does response look like a "valid" login to the client?
console.log('--- if client does r.json() then applyServerState(d): banner=',reg?'(see above)':'');
