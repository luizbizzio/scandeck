/* Independent Rxing (Rust, Apache-2.0) rMQR fallback.
   Loaded lazily inside barcode-worker: it never blocks the camera UI thread. */
let readerPromise=null;
async function getRxing(){
 if(!readerPromise)readerPromise=(async()=>{
  const rx=await import('../vendor/rxing-wasm/rxing_wasm.js');
  if(typeof rx.default!=='function'||typeof rx.decode_barcode!=='function')
   throw Error('Invalid Rxing WASM bindings');
  await rx.default(new URL('../vendor/rxing-wasm/rxing_wasm_bg.wasm',import.meta.url));
  return rx;
 })().catch(error=>{readerPromise=null;throw error});
 return readerPromise;
}
export function decodeRxingRMQRImage(rx,image){
 const {width,height,data}=image||{};
 if(!width||!height||width*height>1_700_000||data?.length!==width*height*4)return [];
 const luma=new Uint8Array(width*height);
 for(let i=0,j=0;i<luma.length;i++,j+=4)
  luma[i]=data[j+3]===0?255:(data[j]*299+data[j+1]*587+data[j+2]*114)/1000|0;
 let decoded;
 try{
  decoded=rx.decode_barcode(luma,width,height,true,false);
  if(decoded?.format()!==rx.BarcodeFormat.RectangularMicroQR)return [];
  const text=decoded.text();
  return typeof text==='string'&&text.length?[{text,format:'RMQRCode'}]:[];
 }catch{return []}
 finally{decoded?.free?.()}
}
export async function readRxingRMQRFrame(image,phase=0){
 const rx=await getRxing();
 let frame=image;
 if(phase%2===1){
  const {findLightCard,cropRgba}=await import('./specialty-candidates.js');
  const card=findLightCard(image);
  if(card&&card.width>85&&card.height>35&&card.width*card.height<image.width*image.height*.95)
   frame=cropRgba(image,card);
 }
 return decodeRxingRMQRImage(rx,frame);
}
