// cdp-probe.mjs — buka halaman via Edge headless + CDP, jalankan probe, print hasil.
// Pakai: node cdp-probe.mjs [url]
const URL=process.argv[2]||'http://localhost:4100/';
import{execSync,spawn}from'node:child_process';
import fs from'node:fs';

const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const dbgPort=9222;
const edge=spawn(EDGE,['--headless=new','--disable-gpu','--no-sandbox',
  `--remote-debugging-port=${dbgPort}`,'--user-data-dir=%TEMP%/edge-cdp-probe','--window-size=1600,900','about:blank'],{stdio:'ignore'});

async function jget(p){const r=await fetch('http://127.0.0.1:'+dbgPort+p);return r.json()}
// tunggu devtools aktif
let targets=null;
for(let i=0;i<30;i++){try{targets=await jget('/json');break}catch(e){await new Promise(r=>setTimeout(r,500))}}
if(!targets)throw new Error('devtools tidak aktif');

// buka tab baru
const tab=await (await fetch(`http://127.0.0.1:${dbgPort}/json/new?${URL}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.webSocketDebuggerUrl);
let id=0;const pending=new Map();
const send=(m,p={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
const events=[];
ws.onmessage=ev=>{const m=JSON.parse(ev.data);
  if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id)}
  else if(m.method)events.push(m)};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');
await send('Runtime.enable');
// tunggu load
const t0=Date.now();
while(Date.now()-t0<15000){
  const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});
  if(rs.result&&rs.result.value==='complete')break;
  await new Promise(r=>setTimeout(r,300));
}
await new Promise(r=>setTimeout(r,1500)); // biarkan webfont/animasi settle

const probe=fs.readFileSync(new URL('./probe-core.js',import.meta.url),'utf8');
const out=await send('Runtime.evaluate',{expression:probe,returnByValue:true,awaitPromise:true});
if(out.exceptionDetails)console.log('EXC:',JSON.stringify(out.exceptionDetails).slice(0,800));
console.log(out.result&&out.result.value);

// screenshot full page
try{
  const met=await send('Page.getLayoutMetrics');
  const w=Math.ceil(met.cssContentSize?.width||1600),h=Math.ceil(met.cssContentSize?.height||900);
  const shot=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:w,height:h,scale:1}});
  const p='C:/Users/M S I/AppData/Local/Temp/lv-full.png';
  fs.writeFileSync(p,Buffer.from(shot.data,'base64'));
  console.log('SCREENSHOT_SAVED:',p,'('+w+'x'+h+')');
}catch(e){console.log('screenshot gagal:',e.message)}

ws.close();edge.kill();
process.exit(0);
