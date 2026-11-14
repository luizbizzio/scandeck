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
 const calls={rects:0,draws:0};
 const pen={
  fillRect(){calls.rects++},fillText(){calls.draws++},beginPath(){},lineTo(){},moveTo(){},stroke(){},
  set fillStyle(_){},set strokeStyle(_){},set lineWidth(_){},set font(_){}
 };
 const canvas={getContext:()=>pen,getBoundingClientRect:()=>({left:0,top:0,right:320,bottom:180,width:320,height:180})};
 const math=Object.create(Math);math.random=()=>.342;
 const context=vm.createContext({c:canvas,Math:math,innerWidth:640,innerHeight:360,requestAnimationFrame(){}});
 vm.runInContext(script,context,{timeout:1500});
 vm.runInContext('start();draw()',context,{timeout:1500});
 const initial=vm.runInContext('[m,h,w,z,T.length,E.length,S.length,P.length]',context);
 vm.runInContext('w=1;n=5;d=0;a=1;step(.025);draw()',context,{timeout:1500});
 const combat=vm.runInContext('[m,h,w,z,T.length,E.length,S.length,n,Number(d.toFixed(2)),P.length]',context);
 canvas.onpointerdown({clientX:290,clientY:169});
 const afterClick=vm.runInContext('[m,h,w,z,T.length,E.length,S.length,v]',context);
 return {initial:[...initial],combat:[...combat],afterClick:[...afterClick],calls};
}
test('Ironpass minification preserves its tower-defense mechanics and rendering',async()=>{
 const payload=readFileSync(new URL('assets/ironpass-micro-v3.txt',root),'utf8').trim();
 const packed=(await decodeGame(payload)).source;
 assert.equal(packed,await compactGameHtml(original),'Build must ship only a compacted equivalent of the original');
 const unoptimized=simulate(rawScript(original));
 const optimized=simulate(rawScript(packed));
 assert.deepEqual(optimized,unoptimized);
 assert.equal(optimized.initial[0],320,'Original starting money stays unchanged');
 assert.equal(optimized.initial[1],20,'Original health stays unchanged');
 assert.equal(optimized.initial[7],10,'Original map still has ten path vertices');
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
