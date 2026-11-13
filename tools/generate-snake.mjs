import {readFileSync} from 'node:fs';
import {packScript} from '../protocol.js';

// The entire independent Snake program is packed into a scannable QR image
// by tools/build-matrix.mjs, not a physically unscannable linear barcode.
export function snakePayload(){
  const source=readFileSync(new URL('../examples/snake-standalone.js',import.meta.url),'utf8').trim();
  return packScript(source);
}
