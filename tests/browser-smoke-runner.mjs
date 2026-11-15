// Run a real Chrome tab with CDP. Do not use --virtual-time-budget:
// virtual timers can kill the image worker before real WebAssembly work ends.
const targetUrl=process.argv[2];
if(!targetUrl)throw Error('Missing smoke-test URL');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let target=null;
for(let i=0;i<60;i++){
 try{
  const response=await fetch('http://127.0.0.1:9222/json');
  if(response.ok){
   const pages=await response.json();
   target=pages.find(page=>page.type==='page'&&page.webSocketDebuggerUrl);
   if(target)break;
  }
 }catch{}
 await pause(250);
}
if(!target)throw Error('Chrome remote debugging did not open.');
const socket=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{
 socket.addEventListener('open',resolve,{once:true});
 socket.addEventListener('error',reject,{once:true});
});
const pending=new Map();let sequence=0,exception='';
socket.addEventListener('message',event=>{
 let data;try{data=JSON.parse(event.data)}catch{return}
 if(data.method==='Runtime.exceptionThrown')exception=JSON.stringify(data.params.exceptionDetails).slice(0,1000);
 if(!data.id)return;
 const task=pending.get(data.id);
 if(!task)return;
 pending.delete(data.id);
 if(data.error)task.reject(Error(JSON.stringify(data.error)));else task.resolve(data.result);
});
const call=(method,params={})=>new Promise((resolve,reject)=>{
 const id=++sequence;
 pending.set(id,{resolve,reject});
 socket.send(JSON.stringify({id,method,params}));
});
try{
 await call('Runtime.enable');
 await call('Page.enable');
 await call('Page.navigate',{url:targetUrl});
 let status='',last='';
 for(let i=0;i<120;i++){
  const evalResult=await call('Runtime.evaluate',{
   expression:"document.querySelector('#result')?.outerHTML || document.readyState",
   returnByValue:true
  });
  const value=String(evalResult?.result?.value||'');
  if(value!==last){last=value;console.log('Browser scan:',value.slice(0,900))}
  if(value.includes('data-status="passed"')){status='passed';break}
  if(value.includes('data-status="failed"')){status='failed';break}
  await pause(1000);
 }
 if(status!=='passed')throw Error('Upload worker smoke test '+(status||'timed out')+': '+last+' '+exception);
 console.log('Browser upload smoke test passed in real time.');
}finally{socket.close()}
