// MIT-licensed Sythos Barcode Universal 1.6.8.
// Strict Codablock-F and DotCode decoding, isolated from the camera UI thread.
import {BitMatrix,decode,decodeCodablockF,decodeDotCode} from '../vendor/sythos-barcode.esm.js';
self.onmessage=({data:task})=>{
  const {id,format,width,height,buffer,exact=false,phase=0}=task||{};
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
      const tryDecode=input=>decode(input,{formats:[format],profile:'camera'})
        .find(r=>typeof r.text==='string'&&/^(?:SD1:|SDS:)/.test(r.text))?.text||'';
      text=tryDecode(image);
      if(!text&&phase===1){
        // High-contrast pass for slightly washed-out display captures.
        let min=255,max=0;
        for(let i=0;i<data.length;i+=64){const v=(data[i]*77+data[i+1]*150+data[i+2]*29)>>8;min=Math.min(min,v);max=Math.max(max,v)}
        if(max-min>35){
          const threshold=(min+max)/2,contrast=new Uint8ClampedArray(data.length);
          for(let i=0;i<data.length;i+=4){const v=((data[i]*77+data[i+1]*150+data[i+2]*29)>>8)>threshold?255:0;
            contrast[i]=contrast[i+1]=contrast[i+2]=v;contrast[i+3]=255}
          text=tryDecode({width,height,data:contrast});
        }
      }
      if(!text&&(phase===2||phase===3)){
        // Experimental readers need axis-aligned matrices; rotate portrait captures.
        const rotated=new Uint8ClampedArray(data.length),cw=phase===2;
        for(let y=0;y<height;y++)for(let x=0;x<width;x++){
          const from=(y*width+x)*4,to=(cw?(x*height+height-1-y):((width-1-x)*height+y))*4;
          for(let k=0;k<4;k++)rotated[to+k]=data[from+k];
        }
        text=tryDecode({width:height,height:width,data:rotated});
      }
    }
    if(!/^(?:SD1:|SDS:)/.test(text))text='';
  }catch{/* A failed strict barcode check must not accept unrelated data. */}
  self.postMessage({id,format,text});
};
