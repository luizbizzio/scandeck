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
 assert.ok(payload.startsWith('SDS:'),'The entire JavaScript game must be in the code, not a URL');
 assert.ok(payload.length<=150,'Keep bars readable by limiting MicroPDF417 payload size');
});
