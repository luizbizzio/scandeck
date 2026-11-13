import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {decodeGame} from '../src/protocol.js';

test('diagnose published exotic PNGs using the actual camera decoder (bounded)',async()=>{
 const script=`
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {decode} from '@sythos/js_barcode_universal';
const file=process.argv[1],format=process.argv[2];
const png=PNG.sync.read(readFileSync(file));
const maxEdge=format==='dotcode'?560:850;
const factor=Math.min(1,maxEdge/Math.max(png.width,png.height));
const w=Math.round(png.width*factor),h=Math.round(png.height*factor);
const data=new Uint8ClampedArray(w*h*4);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const ix=Math.min(png.width-1,Math.floor((x+.5)*png.width/w));
 const iy=Math.min(png.height-1,Math.floor((y+.5)*png.height/h));
 const n=(y*w+x)*4,from=(iy*png.width+ix)*4;
 data[n]=png.data[from];data[n+1]=png.data[from+1];
 data[n+2]=png.data[from+2];data[n+3]=255;
}
const image={width:w,height:h,data};
const start=Date.now();
try{
 const hits=decode(image,{formats:[format]});
 console.log(format,'default',png.width+'x'+png.height,'to',w+'x'+h,hits.length,hits.map(x=>({text:x.text?.slice(0,45),length:x.text?.length})),Date.now()-start);
}catch(error){console.log(format,'default error',error.message,Date.now()-start)}
`;
 for(const [name,format] of [['snake-codablockf','codablockf'],['neon-dodge-dotcode','dotcode']]){
  const file=fileURLToPath(new URL('../assets/'+name+'.png',import.meta.url));
  const result=spawnSync(process.execPath,['--input-type=module','-e',script,file,format],
   {cwd:fileURLToPath(new URL('../',import.meta.url)),timeout:6500,encoding:'utf8',maxBuffer:30000});
  console.log('DIAGNOSTIC',name,'status=',result.status,'signal=',result.signal,'stdout=',result.stdout?.trim(),'stderr=',result.stderr?.slice(0,800),'error=',result.error?.code);
  const payload=readFileSync(new URL('../assets/'+name+'.txt',import.meta.url),'utf8');
  const game=await decodeGame(payload);
  assert.ok(game.source.length>0);
 }
});
