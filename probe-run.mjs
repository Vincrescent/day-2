// probe-run.mjs — klian CDP: buka tab, load halaman, jalankan probe, screenshot.
import fs from'node:fs';
import path from'node:path';
const PORT=9333;
const URL=process.argv[2]||'http://localhost:4100/';
const probe=fs.readFileSync(path.join(process.cwd(),'probe-core.js'),'utf8');

const ver=await (await fetch('http://127.0.0.1:'+PORT+'/json/version')).json();
const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL)}`,{method:'PUT'})).json();
const ws=new WebSocket(tab.id?'ws://127.0.0.1:'+PORT+'/devtools/page/'+tab.id:(tab.webSocketDebuggerUrl||'ws://127.0.0.1:'+PORT+'/devtools/page/'+tab.id));
let id=0;const pending=new Map();
const send=(m,p={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m.result||{});pending.delete(m.id)}};
await new Promise(r=>ws.onopen=r);
await send('Page.enable');await send('Runtime.enable');
const t0=Date.now();
while(Date.now()-t0<20000){
  const rs=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});
  if(rs.result&&rs.result.value==='complete')break;
  await new Promise(r=>setTimeout(r,300));
}
await new Promise(r=>setTimeout(r,1800));
const out=await send('Runtime.evaluate',{expression:probe,returnByValue:true,awaitPromise:true});
if(out.exceptionDetails)console.log('EXC:',JSON.stringify(out.exceptionDetails).slice(0,1000));
console.log(out.result?String(out.result.value):'(no output)');
try{
  const met=await send('Page.getLayoutMetrics');
  const w=Math.min(1600,Math.ceil(met.cssContentSize?.width||1600)),h=Math.ceil(met.cssContentSize?.height||1000);
  // full page
  const s1=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:w,height:Math.min(h,3000),scale:1}});
  fs.writeFileSync('C:/Users/M S I/AppData/Local/Temp/lv-top.png',Buffer.from(s1.data,'base64'));
  console.log('SHOT_TOP: temp/lv-top.png '+w+'x'+Math.min(h,3000));
  // strip bawah halaman
  const bottom=Math.max(0,h-1200);
  const s2=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:bottom,width:w,height:Math.min(1200,h-bottom),scale:1}});
  fs.writeFileSync('C:/Users/M S I/AppData/Local/Temp/lv-bottom.png',Buffer.from(s2.data,'base64'));
  console.log('SHOT_BOTTOM: temp/lv-bottom.png (y='+bottom+')');
}catch(e){console.log('screenshot gagal:',e.message)}
ws.close();process.exit(0);
