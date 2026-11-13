// Cross-check our Codablock F sample against an independent BWIPP encoder.
// This diagnostic never alters the published PNG or game.
import {readFileSync} from 'node:fs';
import bwipjs from 'bwip-js';
import {PNG} from 'pngjs';
import {decode} from '@sythos/js_barcode_universal';
const payload=readFileSync(new URL('../assets/snake-codablockf.txt',import.meta.url),'utf8').trim();
for(const value of ['SDB:HELLO-CODABLOCKF',payload]){
 try{
  const bytes=await bwipjs.toBuffer({bcid:'codablockf',text:value,scale:3,paddingwidth:12,paddingheight:12,showhrt:false});
  const png=PNG.sync.read(bytes);
  console.log('Codablock BWIPP reference:',value.length,'characters',png.width+'x'+png.height,'pixels',bytes.length,'PNG bytes');
  if(value.length<60){
   const hits=decode({width:png.width,height:png.height,data:new Uint8ClampedArray(png.data)},{formats:['codablockf'],tryHarder:false});
   console.log('BWIPP reference decoded by Sythos:',hits.map(x=>x.text).join(' | ')||'(no read)');
  }
 }catch(error){console.log('BWIPP reference error:',value.length,error?.message||String(error))}
}
