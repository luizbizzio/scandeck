/* Independent rMQR image detector (AnyDCode, MIT); ZXing remains a fallback.
   This module runs inside the existing barcode worker, never on the UI thread. */
let readerPromise=null;
export async function instantiateAnyD(bytes){
 const input=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 const {instance}=await WebAssembly.instantiate(input,{});
 const api=instance.exports;
 if(!api.memory||!api.alloc||!api.dealloc||!(api.decode_image||api.decode))
  throw Error('Invalid AnyDCode rMQR WASM API');
 return api;
}
async function getAnyD(){
 if(!readerPromise)readerPromise=(async()=>{
   const response=await fetch(new URL('../vendor/anyd.wasm',import.meta.url),{cache:'force-cache'});
   if(!response.ok)throw Error('rMQR detector unavailable');
   return instantiateAnyD(await response.arrayBuffer());
 })().catch(error=>{readerPromise=null;throw error});
 return readerPromise;
}
export function decodeAnyDImage(api,image){
 const {width,height,data}=image;
 if(!width||!height||width*height>3_000_000||data?.length!==width*height*4)return [];
 const gray=new Uint8Array(width*height);
 for(let i=0,j=0;i<gray.length;i++,j+=4)
  gray[i]=(data[j]*299+data[j+1]*587+data[j+2]*114)/1000|0;
 const ptr=api.alloc(gray.length);
 if(!ptr)throw Error('AnyDCode could not allocate frame');
 new Uint8Array(api.memory.buffer).set(gray,ptr);
 let packed;
 try{packed=(api.decode_image||api.decode)(width,height,ptr)}
 finally{api.dealloc(ptr,gray.length)}
 const outPtr=Number(packed>>32n),len=Number(packed&0xffffffffn);
 if(!len){if(outPtr)api.dealloc(outPtr,0);return []}
 if(len>262144)throw Error('AnyDCode result too large');
 const output=new Uint8Array(api.memory.buffer).slice(outPtr,outPtr+len);
 api.dealloc(outPtr,len);
 const hits=JSON.parse(new TextDecoder().decode(output));
 if(!Array.isArray(hits))return [];
 return hits.filter(h=>/r.?mqr|rectangular.?micro/i.test(String(h.symbology||''))&&typeof h.text==='string')
   .map(h=>({text:h.text,format:'RMQRCode'})).slice(0,2);
}
export async function readAnyDRMQRFrame(image,phase=0){
 const api=await getAnyD();
 // The independent detector handles finder patterns and skew on camera frames.
 // Alternate full-frame and cropped white-card views; one decode per camera frame.
 let frame=image;
 if(phase%2===1){
  const {findLightCard,cropRgba}=await import('./specialty-candidates.js');
  const card=findLightCard(image);
  if(card&&card.width>100&&card.height>40&&card.width*card.height<image.width*image.height*.95)
   frame=cropRgba(image,card);
 }
 return decodeAnyDImage(api,frame);
}
