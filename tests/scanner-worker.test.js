import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const app=readFileSync(new URL('src/app.js',root),'utf8');
const worker=readFileSync(new URL('src/scanner/barcode-worker.js',root),'utf8');
const html=readFileSync(new URL('index.html',root),'utf8');
const sw=readFileSync(new URL('sw.js',root),'utf8');
const flow=readFileSync(new URL('.github/workflows/pages.yml',root),'utf8');
test('source tree keeps modules in organized folders and publishes them',()=>{
 const files=['src/app.js','src/style.css','src/games/runtime.js','src/games/microvm.js','src/games/maze.js',
   'src/formats/protocol.js','src/formats/chroma.js','src/formats/code128.js',
   'src/scanner/exotic-worker.js','src/scanner/iris-worker.js','src/scanner/scanner-geometry.js',
   'src/scanner/barcode-worker.js','src/scanner/upload-worker.js'];
 assert.match(flow,/npm run build:cloudflare/);
 for(const file of files)assert.ok(sw.includes('"'+file+'"'),file);
 assert.ok(html.includes('href="src/style.css?v=83"'));
 assert.ok(html.includes('src="src/app.js?v=84"'));
});
test('camera performs decoding away from main UI and frees worker on stop',()=>{
 assert.match(app,/new Worker\(new URL\('\.\/scanner\/barcode-worker\.js'/);
 assert.match(app,/requestBarcodeWorker\(pixels,'standard'/);
 assert.match(app,/readCameraChroma\(pixels\)/);
 assert.match(app,/stopBarcodeWorker\(\);failIrisWorker\(\);resetExoticWorker\(\)/);
 assert.match(app,/\[data.buffer\]/);
 assert.match(worker,/importScripts\('\.\.\/\.\.\/vendor\/zxing-wasm\/index\.js'\)/);
 assert.match(worker,/await import\('\.\.\/formats\/chroma\.js'\)/);
  assert.match(worker,/if\(!result\)result=await decodeChromaPixels\(pixels,readQr\)/);
 assert.match(worker,/self\.postMessage\(\{id,result\}\)/);
 assert.match(worker,/rotatePixels\(pixels,clockwise\)/);
 assert.match(worker,/retryBinarizer/);
 assert.match(app,/retryRotated:mode==='code128'/);
 assert.doesNotMatch(worker,/window\.|document\./);
});

test('legacy Codablock F and current DotCode payloads reach the experimental reader',()=>{
 const exotic=readFileSync(new URL('src/scanner/exotic-worker.js',root),'utf8');
 assert.match(exotic,/SDH:/);
 assert.match(exotic,/SDZ:/);
 assert.match(app,/SDH:/);
 assert.match(app,/SDZ:/);
});

test('continuous scanner recycles worker memory without affecting camera streams',()=>{
  assert.match(app,/\+\+barcodeReads>=90/);
  assert.match(app,/\+\+irisReads>=32/);
  assert.match(app,/mode==='chroma'\?7800:barcodeReads===0\?6500:options\.formats\?\.length===1\?4200:3200/);
 assert.match(app,/const dedicated=mode==='auto'&&\(autoChroma\|\|autoPdf\|\|autoDot\)/);
 assert.match(app,/autoQuickFormats\(quickPass\+\+\)/);
});

test('MaxiCode and rMQR have camera-card normalization before a pure/regular second decode',()=>{
 const specialty=readFileSync(new URL('src/scanner/specialty-candidates.js',root),'utf8');
 assert.match(app,/specialty:mode==='rmqr'\|\|mode==='maxicode'/);
 assert.match(worker,/getSpecialtyPreprocessor/);
 assert.match(worker,/specialtyCandidates\(pixels,specialty,specialtyPhase\)/);
 assert.match(specialty,/export function findLightCard/);
 assert.match(specialty,/export function thresholdRgba/);
 assert.match(specialty,/export function withWhiteBorder/);
 assert.match(app,/specialtyCandidates\(specialtyPixels,specialtyFormat\)/);
});

test('IRIS tries isolated RGB card and markers in a separate worker',()=>{
 const worker=readFileSync(new URL('src/scanner/iris-worker.js',root),'utf8');
 assert.match(worker,/cropIrisCard\(grid\)/);
  assert.match(worker,/cropIrisDisk\(grid\)/);
 assert.match(worker,/decodeColorMarkers\(card\)/);
   assert.ok(worker.indexOf('decodeColorMarkers(card)')<worker.indexOf('decodeColorMarkers(grid)'));
   assert.match(worker,/decodeColorRobust\(card,\{budgetMs:650\}\)/);
 assert.match(sw,/"src\/scanner\/iris-camera\.js"/);
});

test('rMQR camera preprocessing offers both true pure-code and finder-based reads',()=>{
 const script=readFileSync(new URL('../src/scanner/specialty-candidates.js',import.meta.url),'utf8');
 assert.match(script,/if\(format==='rmqr'\)\{/);
 assert.match(script,/image:isolated,options:\{isPure:true/);
 assert.match(script,/image:crop,options:\{isPure:false/);
 const worker=readFileSync(new URL('../src/scanner/barcode-worker.js',import.meta.url),'utf8');
 assert.match(worker,/tryHarder:specialty==='rmqr'&&!candidate\.options\.isPure/);
 assert.match(worker,/candidates.slice\(start,start\+2\)/);
 assert.match(app,/specialtyPhase:frame/);
});

test('camera DotCode transfers a disposable frame and limits blocking time',()=>{
 assert.match(app,/readExoticPixels\(pixels,exoticFormat,false,phase,true,autoDot\?2200:0\)/);
 assert.match(app,/const phase=autoDot\?autoDotPass\+\+%5:frame%5/);
 assert.match(app,/const cropFrame=autoDot\?\(phase===2\?0:phase\):frame/);
 assert.match(app,/const exoticFormat=autoDot\?'dotcode':mode/);
 assert.match(app,/autoDot=plan==='dotcode'/);
 assert.match(app,/transferPixels\?data:new Uint8ClampedArray\(data\)/);
 assert.match(app,/setTimeout\(resetExoticWorker,deadlineMs\|\|\(exact\?9000:4000\)\)/);
});

test('rMQR switches to an independent local WASM detector before falling back to ZXing',()=>{
 assert.match(worker,/const phase=options\.specialtyPhase\|\|0/);
 assert.match(worker,/readAnyDRMQRFrame\(pixels,phase\)/);
 assert.match(worker,/readRxingRMQRFrame\(pixels,phase\)/);
 assert.match(worker,/phase%3===1/);
 assert.ok(worker.indexOf('readAnyDRMQRFrame(pixels')<worker.indexOf('const zxing=await getDecoder()'));
 assert.match(app,/options\.specialty==='rmqr'\?7500/);
 assert.match(flow,/npm run build:cloudflare/);
 assert.ok(sw.includes('"src/scanner/rmqr-anyd.js"')&&sw.includes('"vendor/anyd.wasm"'));
});

test('lossless optimization rewrites scripts, not game behavior or UI structure',()=>{
 const optimizer=readFileSync(new URL('tools/build/optimize-encoding.mjs',root),'utf8');
 assert.match(optimizer,/compactGameHtml/);
 assert.match(optimizer,/unsafe:false/);
 assert.match(optimizer,/mangle:\{toplevel:minifyGlobals\}/);
 assert.match(optimizer,/inflateRawSync\(best\)\.equals\(bytes\)/);
});

test('continuous sessions recycle exotic workers and share heavy WASM initialization',()=>{
 assert.match(app,/if\(\+\+exoticReads>=48&&exoticWaiting\.size===0\)/);
 assert.match(app,/let matrixEnginePromise=null/);
 assert.match(app,/if\(!matrixEnginePromise\)matrixEnginePromise=/);
 assert.match(app,/matrixEnginePromise=null;throw error/);
 assert.match(app,/new BarcodeDetector\(\{formats:autoFormats\}\)/);
 assert.match(app,/track\.addEventListener\('ended'/);
 assert.match(app,/mode===scanFocus\(\)/);
});


test('Chroma and IRIS Auto skip clearly grayscale scenes without affecting focused modes',()=>{
 assert.match(app,/colorSkipped=autoIris&&!hasColorSignal\(irisPixels\)/);
 assert.match(app,/colorSkipped=autoChroma&&!hasColorSignal\(pixels\)/);
 assert.match(app,/autoIris\?autoIrisPass\+\+%3===2:frame%3===2/);
 assert.match(app,/scheduler\.report\(plan,performance\.now\(\),elapsed,colorSkipped\)/);
});
