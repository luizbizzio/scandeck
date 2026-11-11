import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {code128Svg} from '../code128.js';
import {packScript} from '../protocol.js';
export function snakePayload() {
  const source=readFileSync(new URL('../examples/snake-standalone.js',import.meta.url),'utf8').trim();
  return packScript(source);
}
export function snakeSvg() {
  const payload=snakePayload();
  const escaped=payload.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return code128Svg(payload).replace('</svg>', '<metadata id="scandeck-payload">'+escaped+'</metadata></svg>');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  writeFileSync(new URL('../assets/snake-code128.svg',import.meta.url),snakeSvg());
  console.log('Standalone Snake barcode generated.');
}
