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
