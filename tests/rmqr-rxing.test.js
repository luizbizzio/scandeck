import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import * as rxing from 'rxing-wasm';
import {decodeRxingRMQRImage} from '../src/rmqr-rxing.js';

test('Rxing independently decodes the published rMQR pixels',()=>{
 const png=PNG.sync.read(readFileSync(new URL('../assets/math-rmqr.png',import.meta.url)));
 const expected=readFileSync(new URL('../assets/math-rmqr.txt',import.meta.url),'utf8').trim();
 const pixels={width:png.width,height:png.height,data:new Uint8ClampedArray(png.data)};
 const hits=decodeRxingRMQRImage(rxing,pixels);
 assert.ok(hits.some(hit=>hit.text===expected&&hit.format==='RMQRCode'),
  'Independent Rust decoder must recover exactly the PNG payload');
});
