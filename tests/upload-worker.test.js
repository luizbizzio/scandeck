import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const app=readFileSync(new URL('src/app.js',root),'utf8');
const worker=readFileSync(new URL('src/upload-worker.js',root),'utf8');
const sw=readFileSync(new URL('sw.js',root),'utf8');
const pages=readFileSync(new URL('.github/workflows/pages.yml',root),'utf8');
const pkg=JSON.parse(readFileSync(new URL('package.json',root),'utf8'));
const lock=JSON.parse(readFileSync(new URL('package-lock.json',root),'utf8'));

test('uploaded images are decoded in a disposable off-thread worker',()=>{
 assert.match(app,/new Worker\(new URL\('\.\/upload-worker\.js',import\.meta\.url\)\)/);
 assert.match(app,/worker\.terminate\(\)/);
 assert.match(app,/cancelUploadDecode\(\)/);
 assert.match(app,/generation!==uploadGeneration/);
 assert.match(app,/addEventListener\('pagehide',cancelUploadDecode\)/);
 assert.match(app,/async function detectImageLegacy\(file\)/);
 assert.ok(sw.includes('"src/upload-worker.js"'));
 assert.match(worker,/self\.onmessage=async/);
 assert.match(worker,/new OffscreenCanvas\(/);
 assert.match(worker,/MAX_UPLOAD_PIXELS=12_000_000/);
 assert.doesNotMatch(worker,/\bwindow\.|\bdocument\./);
});
test('upload worker retains every published code format and experimental fallbacks',()=>{
 for(const format of ['QRCode','Code128','DataMatrix','Aztec','PDF417','MicroPDF417','EAN13','MicroQRCode','DataBarExpStk','RMQRCode'])
  assert.ok(worker.includes("'"+format+"'"),'Missing '+format);
 for(const module of ['specialty-candidates.js','rmqr-anyd.js','rmqr-rxing.js',
   'exotic-grid.js','chroma.js','iris-camera.js'])
  assert.ok(worker.includes(module),'Missing experimental reader '+module);
 assert.match(worker,/decodeExotic\(image,format,phase/);
 assert.match(worker,/decodeChromaPixels\(pixels/);
 assert.match(worker,/decodeIris\(iris\)/);
 assert.match(worker,/bitmap\.close\(\)/);
 assert.match(worker,/file instanceof Blob/);
});
test('JAB is no longer built, precached or exposed in the live scanner',()=>{
 for(const old of ['src/jab-camera.js','tools/build-jab.mjs','tests/jabcode.test.js','examples/colorpath-jab.html'])
  assert.equal(existsSync(new URL(old,root)),false,'Legacy file still present: '+old);
 assert.doesNotMatch(worker,/JABCode|jabcode/);
 assert.doesNotMatch(sw,/jab-camera|jabcode/);
 assert.doesNotMatch(app,/mode==='jab'/);
 assert.doesNotMatch(pages,/build-jab|jab-camera|vendor\/jabcode/);
 assert.doesNotMatch(pkg.scripts.build,/build-jab/);
 assert.ok(!pkg.dependencies.esbuild);
 assert.ok(!lock.packages[''].dependencies.esbuild);
});
test('production install uses the versioned dependency lockfile',()=>{
 assert.equal(lock.lockfileVersion,3);
 assert.equal(lock.packages[''].name,'scandeck');
 assert.deepEqual(lock.packages[''].dependencies,pkg.dependencies);
 assert.match(pages,/npm ci --no-audit --no-fund/);
 assert.match(readFileSync(new URL('.github/workflows/audit-ci.yml',root),'utf8'),
   /npm ci --no-audit --no-fund/);
});
