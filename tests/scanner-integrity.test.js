import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {readBarcodes} from 'zxing-wasm';

test('published MaxiCode and rMQR PNGs decode as RGBA pixel frames with the requested formats',async()=>{
 for(const [name,format] of [['tap-maxicode','MaxiCode'],['math-rmqr','RMQRCode']]){
  const png=PNG.sync.read(readFileSync(new URL('../assets/'+name+'.png',import.meta.url)));
  const input={width:png.width,height:png.height,data:new Uint8ClampedArray(png.data)};
  const hits=await readBarcodes(input,{formats:[format],tryHarder:true,
    tryDownscale:false,tryRotate:true,isPure:format==='MaxiCode',
    maxNumberOfSymbols:1});
  const expected=readFileSync(new URL('../assets/'+name+'.txt',import.meta.url),'utf8');
  assert.ok(hits.some(x=>x.text===expected),
    name+' must decode from raw camera-style RGBA pixels, not only from its PNG Blob');
 }
});
