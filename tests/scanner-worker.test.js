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
 assert.match(html,/href="src\/style\.css\?v=69"/);
 assert.match(html,/src="src\/app\.js\?v=69"/);
});
test('camera performs decoding away from main UI and frees worker on stop',()=>{
 assert.match(app,/new Worker\(new URL\('\.\/barcode-worker\.js'/);
 assert.match(app,/requestBarcodeWorker\(pixels,'standard'/);
 assert.match(app,/readCameraChroma\(pixels\)/);
 assert.match(app,/stopBarcodeWorker\(\);failIrisWorker\(\);resetExoticWorker\(\)/);
 assert.match(app,/\[data.buffer\]/);
 assert.match(worker,/importScripts\('\.\.\/vendor\/zxing-wasm\/index\.js'\)/);
 assert.match(worker,/await import\('\.\/chroma\.js'\)/);
  assert.match(worker,/if\(!result\)result=await decodeChromaPixels\(pixels,readQr\)/);
 assert.match(worker,/self\.postMessage\(\{id,result\}\)/);
 assert.match(worker,/rotatePixels\(pixels,clockwise\)/);
 assert.match(worker,/retryBinarizer/);
 assert.match(app,/retryRotated:mode==='code128'/);
 assert.doesNotMatch(worker,/window\.|document\./);
});

test('legacy Codablock F and current DotCode payloads reach the experimental reader',()=>{
 const exotic=readFileSync(new URL('src/exotic-worker.js',root),'utf8');
 assert.match(exotic,/SDH:/);
 assert.match(exotic,/SDZ:/);
 assert.match(app,/SDH:/);
 assert.match(app,/SDZ:/);
});

test('continuous scanner recycles worker memory without affecting camera streams',()=>{
  assert.match(app,/\+\+barcodeReads>=90/);
  assert.match(app,/\+\+irisReads>=32/);
  assert.match(app,/mode==='chroma'\?6800:options\.formats\?\.length===1\?3000:2200/);
});

test('MaxiCode and rMQR have camera-card normalization before a pure/regular second decode',()=>{
 const specialty=readFileSync(new URL('src/specialty-candidates.js',root),'utf8');
 assert.match(app,/specialty:mode==='rmqr'\|\|mode==='maxicode'/);
 assert.match(worker,/getSpecialtyPreprocessor/);
 assert.match(worker,/specialtyCandidates\(pixels,specialty,specialtyPhase\)/);
 assert.match(specialty,/export function findLightCard/);
 assert.match(specialty,/export function thresholdRgba/);
 assert.match(specialty,/export function withWhiteBorder/);
 assert.match(app,/specialtyCandidates\(specialtyPixels,specialtyFormat\)/);
});

test('IRIS tries isolated RGB card and markers in a separate worker',()=>{
 const worker=readFileSync(new URL('src/iris-worker.js',root),'utf8');
 assert.match(worker,/cropIrisCard\(grid\)/);
  assert.match(worker,/cropIrisDisk\(grid\)/);
 assert.match(worker,/decodeColorMarkers\(card\)/);
   assert.ok(worker.indexOf('decodeColorMarkers(card)')<worker.indexOf('decodeColorMarkers(grid)'));
   assert.match(worker,/decodeColorRobust\(card,\{budgetMs:650\}\)/);
 assert.match(sw,/"src\/iris-camera\.js"/);
});

test('rMQR camera preprocessing offers both true pure-code and finder-based reads',()=>{
 const script=readFileSync(new URL('../src/specialty-candidates.js',import.meta.url),'utf8');
 assert.match(script,/if\(format==='rmqr'\)\{/);
 assert.match(script,/image:isolated,options:\{isPure:true/);
 assert.match(script,/image:crop,options:\{isPure:false/);
 const worker=readFileSync(new URL('../src/barcode-worker.js',import.meta.url),'utf8');
 assert.match(worker,/tryHarder:specialty==='rmqr'&&!candidate\.options\.isPure/);
 assert.match(worker,/candidates.slice\(start,start\+2\)/);
 assert.match(app,/specialtyPhase:frame/);
});

test('camera DotCode transfers a disposable frame and limits blocking time',()=>{
 assert.match(app,/readExoticPixels\(pixels,mode,false,frame%5,true\)/);
 assert.match(app,/transferPixels\?data:new Uint8ClampedArray\(data\)/);
 assert.match(app,/setTimeout\(resetExoticWorker,exact\?9000:4000\)/);
});
