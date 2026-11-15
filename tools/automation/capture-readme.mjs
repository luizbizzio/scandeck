// Capture the real ScanDeck UI in Chrome for the repository README.
// Run against a local build. No mocked screen or generated marketing artwork.
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.argv[2]||'http://127.0.0.1:8765/';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let target=null;
for(let i=0;i<80;i++){
 try{
  const response=await fetch('http://127.0.0.1:9222/json');
  if(response.ok){
   const tabs=await response.json();
   target=tabs.find(tab=>tab.type==='page'&&tab.webSocketDebuggerUrl);
   if(target)break;
  }
 }catch{}
 await delay(250);
}
if(!target)throw Error('Chrome remote debugger is unavailable.');
const socket=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{
 socket.addEventListener('open',resolve,{once:true});
 socket.addEventListener('error',reject,{once:true});
});
const pending=new Map();
let id=0;
socket.addEventListener('message',event=>{
 let message;
 try{message=JSON.parse(event.data)}catch{return}
 if(!message.id)return;
 const item=pending.get(message.id);
 if(!item)return;
 pending.delete(message.id);
 if(message.error)item.reject(Error(JSON.stringify(message.error)));
 else item.resolve(message.result);
});
async function call(method,params={}){
 const current=++id;
 const promise=new Promise((resolve,reject)=>pending.set(current,{resolve,reject}));
 socket.send(JSON.stringify({id:current,method,params}));
 return await promise;
}
await mkdir('docs/screenshots',{recursive:true});
try{
 await call('Page.enable');
 await call('Runtime.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 for(const [tab,filename] of [['scan','scan.png']]){
  await call('Page.navigate',{url:new URL('#'+tab,base).href});
  let ready=false;
  for(let i=0;i<80;i++){
   const r=await call('Runtime.evaluate',{expression:`document.readyState==='complete' && document.querySelector('#${tab}')?.classList.contains('active') && !document.querySelector('#${tab}')?.hidden`,returnByValue:true});
   if(r?.result?.value===true){ready=true;break}
   await delay(250);
  }
  if(!ready)throw Error('ScanDeck '+tab+' view was not ready for capture.');
  // Let the actual site finish image decoding and font rendering.
  await call('Runtime.evaluate',{expression:"document.fonts.ready.then(()=>true)",awaitPromise:true,returnByValue:true});
  await delay(750);
  const capture=await call('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
  if(!capture.data)throw Error('Chrome did not return a PNG screenshot.');
  const png=Buffer.from(capture.data,'base64');
  if(png.length<12000)throw Error('Unexpectedly small screenshot for '+tab);
  await writeFile('docs/screenshots/'+filename,png);
  console.log('Captured real '+tab+' screenshot: '+png.length+' bytes');
 }
}finally{
 socket.close();
}
