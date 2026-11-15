import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {readBarcodes} from 'zxing-wasm';

test('published EAN-13 and rMQR PNGs decode as RGBA pixel frames with the requested formats',async()=>{
 for(const [name,format] of [['timing-ean13','EAN13'],['math-rmqr','RMQRCode']]){
  const png=PNG.sync.read(readFileSync(new URL('../assets/'+name+'.png',import.meta.url)));
  const input={width:png.width,height:png.height,data:new Uint8ClampedArray(png.data)};
  const hits=await readBarcodes(input,{formats:[format],tryHarder:true,
    tryDownscale:false,tryRotate:true,isPure:false,
    maxNumberOfSymbols:1});
  const expected=readFileSync(new URL('../assets/'+name+'.txt',import.meta.url),'utf8');
  assert.ok(hits.some(x=>x.text===expected),
    name+' must decode from raw camera-style RGBA pixels, not only from its PNG Blob');
 }
});

test('MicroPDF417 Dice Streak decodes from camera-style RGBA pixels without a custom decoder',async()=>{
 const name='dice-streak-micropdf417';
 const png=PNG.sync.read(readFileSync(new URL('../assets/'+name+'.png',import.meta.url)));
 const input={width:png.width,height:png.height,data:new Uint8ClampedArray(png.data)};
 const payload=readFileSync(new URL('../assets/'+name+'.txt',import.meta.url),'utf8');
 const hits=await readBarcodes(input,{
  formats:['MicroPDF417'],tryHarder:true,tryRotate:true,tryDownscale:false,maxNumberOfSymbols:1
 });
 assert.ok(hits.some(hit=>hit.text===payload),'MicroPDF417 reader must recover every game byte');
 assert.ok(payload.startsWith('SDM:<button'),'The complete HTML game must be in the code, not a URL');
 assert.ok(payload.length<=150,'Keep bars readable by limiting MicroPDF417 payload size');
});

test('PDF417 Auto reader options decode the published Brick Rush pixel image',async()=>{
 const png=PNG.sync.read(readFileSync(new URL('../assets/breakout-pdf417.png',import.meta.url)));
 const image={width:png.width,height:png.height,data:new Uint8ClampedArray(png.data)};
 const payload=readFileSync(new URL('../assets/breakout-pdf417.txt',import.meta.url),'utf8');
 const results=await readBarcodes(image,{
   formats:['PDF417'],maxNumberOfSymbols:1,tryHarder:true,tryRotate:true,
   tryInvert:true,binarizer:'LocalAverage',minLineCount:2,tryDownscale:false,tryDenoise:false
 });
 assert.ok(results.some(r=>r.text===payload),'Auto focused pass must decode the complete PDF417 game');
});

test('rMQR PNG, saved payload and original game source agree',async()=>{
 const png=PNG.sync.read(readFileSync(new URL('../assets/math-rmqr.png',import.meta.url)));
 const payload=readFileSync(new URL('../assets/math-rmqr.txt',import.meta.url),'utf8').trim();
 const original=readFileSync(new URL('../examples/math-rmqr.js',import.meta.url),'utf8').trim();
 const {decodeGame}=await import('../src/protocol.js');
 const hits=await readBarcodes({width:png.width,height:png.height,data:new Uint8ClampedArray(png.data)},{
  formats:['RMQRCode'],maxNumberOfSymbols:1,tryRotate:true,tryDownscale:false
 });
 assert.ok(hits.some(hit=>hit.text===payload),'Decoded PNG differs from published rMQR payload');
 const decoded=await decodeGame(payload);
 assert.equal(decoded.source.trim(),original,'Published rMQR payload differs from its original game source');
});
