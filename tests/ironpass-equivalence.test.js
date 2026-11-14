import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {decodeGame} from '../src/protocol.js';
import {compactGameHtml} from '../tools/optimize-encoding.mjs';

const root=new URL('../',import.meta.url);
const original=readFileSync(new URL('examples/ironpass-micro-v3.html',root),'utf8').trim();
const rawScript=html=>html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
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
   ['chromaqr-chroma','examples/colorpath-jab.html']
 ]){
  const html=readFileSync(new URL(sourcePath,root),'utf8').trim();
  const encoded=readFileSync(new URL('assets/'+id+'.txt',root),'utf8');
  const decoded=await decodeGame(encoded);
  assert.equal(decoded.kind,'html',id+' must remain a full HTML game');
  assert.equal(decoded.source,await compactGameHtml(html),id+' must preserve the transformed program exactly');
 }
});
