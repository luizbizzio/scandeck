// MIT-licensed Sythos Barcode Universal 1.6.8.
// Strict Codablock-F and DotCode decoding, isolated from the camera UI thread.
import {BitMatrix,decode,decodeCodablockF,decodeDotCode} from './vendor/sythos-barcode.esm.js';
self.onmessage=({data:task})=>{
  const {id,format,width,height,buffer,exact=false}=task||{};
  let text='';
  try{
    if(!['codablockf','dotcode'].includes(format)||
       !Number.isInteger(width)||!Number.isInteger(height)||
       width<30||height<30||width*height>2_000_000)
      throw Error('Unsupported barcode image');
    const data=new Uint8ClampedArray(buffer);
    if(data.length!==width*height*4)throw Error('Invalid RGBA buffer');
    if(exact){
      const scale=format==='codablockf'?4:5;
      const margin=format==='codablockf'?12:10;
      if(width%scale||height%scale)throw Error('Unexpected symbol resolution');
      const cols=width/scale-margin*2,rows=height/scale-margin*2;
      if(cols<1||rows<1)throw Error('Unexpected symbol margin');
      const matrix=new BitMatrix(cols,rows);
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        const px=((y+margin)*scale+(scale>>1))*width+(x+margin)*scale+(scale>>1);
        if(data[px*4]<128)matrix.set(x,y);
      }
      const result=format==='codablockf'?decodeCodablockF(matrix):decodeDotCode(matrix);
      if(result?.text)text=result.text;
    }else{
      const image={width,height,data};
      const results=decode(image,{formats:[format],profile:'camera'});
      const hit=results.find(r=>typeof r.text==='string'&&/^(?:SD1:|SDS:)/.test(r.text));
      if(hit)text=hit.text;
    }
    if(!/^(?:SD1:|SDS:)/.test(text))text='';
  }catch{/* A failed strict barcode check must not accept unrelated data. */}
  self.postMessage({id,format,text});
};
