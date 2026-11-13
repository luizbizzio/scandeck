import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {BitMatrix,decodeDotCode,decodeCodablockF} from '@sythos/js_barcode_universal';
import {EXOTIC_SHAPES} from '../src/exotic-shapes.js';
import {sampleKnownGrid} from '../src/exotic-grid.js';

// Simulate a camera that sees a white barcode sheet against a dark background.
function cameraImage(png,scale){
 const w=1300,h=940,data=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<data.length;i+=4)data[i]=19,data[i+1]=27,data[i+2]=23,data[i+3]=255;
 const sw=Math.round(png.width*scale),sh=Math.round(png.height*scale);
 assert.ok(sw<w-40&&sh<h-40,'Simulated barcode must fit');
 const left=Math.floor((w-sw)/2),top=Math.floor((h-sh)/2);
 for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
   const px=Math.min(png.width-1,Math.floor((x+.5)*png.width/sw));
   const py=Math.min(png.height-1,Math.floor((y+.5)*png.height/sh));
   const from=(py*png.width+px)*4,to=((top+y)*w+left+x)*4;
   for(let i=0;i<4;i++)data[to+i]=png.data[from+i];
 }
 return {width:w,height:h,data};
}
for(const [name,format,scale] of [
 ['snake-codablockf','codablockf',.72],
 ['neon-dodge-dotcode','dotcode',.76]
]){
 test(format+' first-party PNG decodes after camera-size scaling and framing',()=>{
  const png=PNG.sync.read(readFileSync(new URL('../assets/'+name+'.png',import.meta.url)));
  const image=cameraImage(png,scale),decode=format==='dotcode'?decodeDotCode:decodeCodablockF;
  const text=sampleKnownGrid(image,EXOTIC_SHAPES[format],BitMatrix,decode);
  const expected=readFileSync(new URL('../assets/'+name+'.txt',import.meta.url),'utf8');
  assert.equal(text,expected,'Raw photographed modules must decode, not just the encoded payload');
 });
}
