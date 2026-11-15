import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {decodeGame} from '../src/formats/protocol.js';
import {compactGameHtml} from '../tools/build/optimize-encoding.mjs';
import {inlineScriptRanges} from '../tools/build/html-source.mjs';

const root=new URL('../',import.meta.url);
const original=readFileSync(new URL('examples/ironpass-micro-v3.html',root),'utf8').trim();
const rawScript=html=>inlineScriptRanges(html)[0]?.source;
function simulate(script){
 const trace=[];
 const pen={
  fillRect(...args){trace.push(['rect',...args])},
  fillText(...args){trace.push(['text',...args])},
  beginPath(){},lineTo(){},moveTo(){},stroke(){},
  set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set font(v){}
 };
 const c={getContext:()=>pen,getBoundingClientRect:()=>({left:0,top:0,right:320,bottom:180,width:320,height:180})};
 const frames=[],math=Object.create(Math);math.random=()=>.342;
 const browser=vm.createContext({c,Math:math,innerWidth:640,innerHeight:360,requestAnimationFrame(fn){frames.push(fn)}});
 vm.runInContext(script,browser,{timeout:1500});
 const step=t=>{const next=frames.shift();assert.equal(typeof next,'function');next(t)};
 step(16);
 c.onpointerdown({clientX:40,clientY:90}); // Start
 step(32);
 c.onpointerdown({clientX:270,clientY:60}); // Select bow tower
 step(48);
 c.onpointerdown({clientX:91,clientY:166}); // Attempt to place
 step(64);
 c.onpointerdown({clientX:285,clientY:150}); // Next wave
 for(const t of [96,128,160,192,224,256])step(t);
 return trace;
}
test('Ironpass minification preserves visual frames and every touch interaction',async()=>{
 const payload=readFileSync(new URL('assets/ironpass-micro-v3.txt',root),'utf8').trim();
 const packed=(await decodeGame(payload)).source;
 assert.equal(packed,await compactGameHtml(original,{minifyGlobals:true}));
 const before=simulate(rawScript(original)),after=simulate(rawScript(packed));
 assert.deepEqual(after,before,'Minified game must draw the same frames and react to the same touches');
 assert.ok(after.some(x=>x[0]==='text'&&x[1]==='IRONPASS'));
 assert.ok(after.some(x=>x[0]==='text'&&String(x[1]).startsWith('HP ')));
 assert.ok(after.some(x=>x[0]==='text'&&String(x[1]).includes('W1/20')));
});
test('all Full HTML matrix games preserve the complete source after compression',async()=>{
 for(const [id,sourcePath] of [
   ['catch-datamatrix','examples/catch-datamatrix.html'],
   ['memory-aztec','examples/memory-aztec.html'],
   ['breakout-pdf417','examples/breakout-pdf417.html'],
   ['chromaqr-chroma','examples/colorpath-chromaqr.html']
 ]){
  const html=readFileSync(new URL(sourcePath,root),'utf8').trim();
  const encoded=readFileSync(new URL('assets/'+id+'.txt',root),'utf8');
  const decoded=await decodeGame(encoded);
  assert.equal(decoded.kind,'html',id+' must remain a full HTML game');
  assert.equal(decoded.source,await compactGameHtml(html),id+' must preserve the transformed program exactly');
 }
});

// A clean checkout contains source code and the favicon, never committed game symbols.
test('Ironpass PNG and payload are generated during build, not tracked by Git',()=>{
 const ignore=readFileSync(new URL('.gitignore',root),'utf8');
 assert.match(ignore,/^\\/assets\\/\\*$/m);
 assert.match(ignore,/^!\\/assets\\/favicon\\.svg$/m);
 const build=readFileSync(new URL('tools/build/build-matrix.mjs',root),'utf8');
 assert.match(build,/writeFileSync\\(asset\\('ironpass-micro-v3-qr\\.png'\\)/);
 assert.match(build,/writeFileSync\\(asset\\('ironpass-micro-v3\\.txt'\\)/);
 for(const name of ['ironpass-micro-v3-qr.png','ironpass-micro-v3.txt']){
  assert.ok(existsSync(new URL('assets/'+name,root)),'Missing generated asset '+name);
 }
 // Git metadata is not present in some source-archive downloads.
 if(existsSync(new URL('.git',root))){
  const tracked=execFileSync('git',['ls-files','--','assets'],{cwd:fileURLToPath(root),encoding:'utf8'})
    .trim().split('\\n').filter(Boolean);
  assert.deepEqual(tracked,['assets/favicon.svg']);
 }
});
