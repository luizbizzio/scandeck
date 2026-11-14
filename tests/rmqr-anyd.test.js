import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {instantiateAnyD,decodeAnyDImage} from '../src/rmqr-anyd.js';

test('independent AnyDCode WASM reader decodes the exact rMQR game PNG',async()=>{
 const wasm=readFileSync(new URL('../vendor/anyd.wasm',import.meta.url));
 assert.ok(wasm.subarray(0,4).equals(Buffer.from([0,97,115,109])));
 const api=await instantiateAnyD(wasm);
 const image=PNG.sync.read(readFileSync(new URL('../assets/math-rmqr.png',import.meta.url)));
 const payload=readFileSync(new URL('../assets/math-rmqr.txt',import.meta.url),'utf8');
 const hits=decodeAnyDImage(api,{width:image.width,height:image.height,data:new Uint8ClampedArray(image.data)});
 assert.ok(hits.some(r=>r.text===payload&&r.format==='RMQRCode'),'Independent decoder must recover the full rMQR payload');
});

test('independent rMQR detector handles a mildly rotated camera-like image',async()=>{
 const api=await instantiateAnyD(readFileSync(new URL('../vendor/anyd.wasm',import.meta.url)));
 const png=PNG.sync.read(readFileSync(new URL('../assets/math-rmqr.png',import.meta.url)));
 const payload=readFileSync(new URL('../assets/math-rmqr.txt',import.meta.url),'utf8');
 const angle=.09,co=Math.cos(angle),si=Math.sin(angle);
 const width=Math.ceil(png.width+png.height*si+100),height=Math.ceil(png.height+png.width*si+100);
 const data=new Uint8ClampedArray(width*height*4).fill(255);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const dx=x-width/2,dy=y-height/2;
  const sx=Math.round(png.width/2+dx*co+dy*si);
  const sy=Math.round(png.height/2-dx*si+dy*co);
  if(sx<0||sy<0||sx>=png.width||sy>=png.height)continue;
  const from=(sy*png.width+sx)*4,to=(y*width+x)*4;
  data[to]=png.data[from];data[to+1]=png.data[from+1];data[to+2]=png.data[from+2];
 }
 const hits=decodeAnyDImage(api,{width,height,data});
 assert.ok(Array.isArray(hits),'Rotated camera frames must never break the independent decoder');
 // Some tilted frames need the ZXing geometric fallback even with AnyDCode.
});
