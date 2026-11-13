// MIT-licensed Sythos Barcode Universal 1.6.8.
// Strict Codablock-F and DotCode decoding, isolated from the camera UI thread.
import {decode} from './vendor/sythos-barcode.esm.js';
self.onmessage=({data:task})=>{
  const {id,format,width,height,buffer}=task||{};
  let text='';
  try{
    if(!['codablockf','dotcode'].includes(format)||
       !Number.isInteger(width)||!Number.isInteger(height)||
       width<30||height<30||width*height>2_000_000)
      throw Error('Unsupported barcode image');
    const data=new Uint8ClampedArray(buffer);
    if(data.length!==width*height*4)throw Error('Invalid RGBA buffer');
    const image={width,height,data};
    const results=decode(image,{formats:[format],profile:'camera'});
    const hit=results.find(r=>typeof r.text==='string'&&/^(?:SD1:|SDS:)/.test(r.text));
    if(hit)text=hit.text;
  }catch{/* A failed strict barcode check must not accept unrelated data. */}
  self.postMessage({id,format,text});
};
