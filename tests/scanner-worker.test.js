import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const app=readFileSync(new URL('src/app.js',root),'utf8');
const worker=readFileSync(new URL('src/barcode-worker.js',root),'utf8');
const html=readFileSync(new URL('index.html',root),'utf8');
const sw=readFileSync(new URL('sw.js',root),'utf8');
const flow=readFileSync(new URL('.github/workflows/pages.yml',root),'utf8');
test('source tree keeps application files out of repository root',()=>{
 for(const file of ['app.js','runtime.js','protocol.js','microvm.js','chroma.js','maze.js','code128.js','exotic-worker.js','iris-worker.js','scanner-geometry.js','barcode-worker.js','style.css']){
   assert.match(flow,/cp src\/\*\.js src\/style\.css dist\/src\//);
   assert.ok(sw.includes('"src/'+file+'"')||file==='style.css'&&sw.includes('"src/style.css"'),file);
 }
 assert.match(html,/href="src\/style\.css\?v=39"/);
 assert.match(html,/src="src\/app\.js\?v=39"/);
});
test('camera performs decoding away from main UI and frees worker on stop',()=>{
 assert.match(app,/new Worker\(new URL\('\.\/barcode-worker\.js'/);
 assert.match(app,/requestBarcodeWorker\(pixels,'standard'/);
 assert.match(app,/readCameraChroma\(pixels\)/);
 assert.match(app,/stopBarcodeWorker\(\);failIrisWorker\(\);resetExoticWorker\(\)/);
 assert.match(app,/\[data.buffer\]/);
 assert.match(worker,/importScripts\('\.\.\/vendor\/zxing-wasm\/index\.js'\)/);
 assert.match(worker,/await import\('\.\/chroma\.js'\)/);
 assert.match(worker,/self\.postMessage\(\{id,result\}\)/);
 assert.match(worker,/rotatePixels\(pixels,clockwise\)/);
 assert.match(worker,/retryBinarizer/);
 assert.match(app,/retryRotated:mode==='code128'/);
 assert.doesNotMatch(worker,/window\.|document\./);
});
