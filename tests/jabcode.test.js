import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import * as jab from '../vendor/jabcode.js';
import {decodeJabPixels} from '../src/jab-camera.js';
import {decodeGame} from '../src/protocol.js';

const source=readFileSync(new URL('../examples/math-rmqr.js',import.meta.url),'utf8').trim();
const payload=readFileSync(new URL('../assets/codebreaker-jab.txt',import.meta.url),'utf8').trim();
const png=PNG.sync.read(readFileSync(new URL('../assets/codebreaker-jab.png',import.meta.url)));

function image(){return {width:png.width,height:png.height,data:new Uint8ClampedArray(png.data)}}
test('JAB Codebreaker contains all of its original executable JavaScript',async()=>{
 const game=await decodeGame(payload);
 assert.equal(game.source,source);
 assert.equal(game.kind,'standalone');
 assert.ok(payload.startsWith('SDS:'));
});

test('the published JAB PNG decodes as actual image pixels, not a catalog shortcut',()=>{
 assert.equal(decodeJabPixels(jab,image(),{phase:0}),payload);
});

test('JAB photo-like white card on dark camera background can be located',()=>{
 const width=900,height=700;
 const data=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<data.length;i+=4){data[i]=17;data[i+1]=20;data[i+2]=19;data[i+3]=255}
 const ratio=Math.min(1,500/png.width);
 const side=Math.round(png.width*ratio);
 const ox=Math.floor((width-side)/2),oy=Math.floor((height-side)/2);
 for(let y=0;y<side;y++)for(let x=0;x<side;x++){
  const sx=Math.min(png.width-1,Math.floor((x+.5)*png.width/side));
  const sy=Math.min(png.height-1,Math.floor((y+.5)*png.height/side));
  const from=(sy*png.width+sx)*4,to=((oy+y)*width+ox+x)*4;
  data[to]=png.data[from];data[to+1]=png.data[from+1];
  data[to+2]=png.data[from+2];data[to+3]=255;
 }
 const result=decodeJabPixels(jab,{width,height,data},{phase:0});
 assert.equal(result,payload);
 // A colored app UI can surround the scan target without being part of it.
 for(let y=10;y<55;y++)for(let x=18;x<145;x++){
  const i=(y*width+x)*4;data[i]=245;data[i+1]=35;data[i+2]=98;
 }
 assert.equal(decodeJabPixels(jab,{width,height,data},{phase:0}),payload,
  'Colored UI outside the white code card must not block JAB detection');
});

test('unrelated dark frames are not misidentified as JAB',()=>{
 const width=320,height=240,data=new Uint8ClampedArray(width*height*4).fill(30);
 for(let i=3;i<data.length;i+=4)data[i]=255;
 assert.equal(decodeJabPixels(jab,{width,height,data}),'');
});
