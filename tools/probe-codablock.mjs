// Independent compatibility probe. The published barcode is unchanged.
import {readFileSync} from 'node:fs';
import bwipjs from 'bwip-js';
import {PNG} from 'pngjs';
import {decode,decodeCodablockF,BitMatrix} from '@sythos/js_barcode_universal';
const payload=readFileSync(new URL('../assets/snake-codablockf.txt',import.meta.url),'utf8').trim();
for(const text of ['SDB:HELLO-CODABLOCKF',payload]){
 for(const columns of [10,18,22,26,30]){
  try{
   const bytes=await bwipjs.toBuffer({bcid:'codablockf',text,columns,scale:3,paddingwidth:12,paddingheight:12,showhrt:false});
   const png=PNG.sync.read(bytes);
   console.log('BWIPP:',text.length,'chars',columns,'columns',png.width+'x'+png.height,bytes.length+' bytes');
   if(text.length<60){
    const hits=decode({width:png.width,height:png.height,data:new Uint8ClampedArray(png.data)},{formats:['codablockf'],tryHarder:false});
    console.log('BWIPP auto Sythos',hits.map(x=>x.text).join(' | ')||'no read');
    const scale=3,margin=12,cols=png.width/scale-2*margin,rows=png.height/scale-2*margin;
    if(Number.isInteger(cols)&&Number.isInteger(rows)&&cols>0&&rows>0){
      const grid=new BitMatrix(cols,rows);
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        const px=Math.floor((x+margin+.5)*scale),py=Math.floor((y+margin+.5)*scale);
        const i=(py*png.width+px)*4;
        if(png.data[i]<128)grid.set(x,y);
      }
      console.log('BWIPP strict Sythos:',decodeCodablockF(grid)?.text||'no read');
    }
   }
  }catch(e){console.log('BWIPP error',text.length,'columns',columns,e?.message)}
 }
}
