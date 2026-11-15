import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
// Test fixtures contain exactly one fixed <script> block. Parse its literal
// delimiters, not arbitrary HTML, to avoid CodeQL's bad-tag-filter warning.
function fixtureScript(source,filename){
 const start=source.indexOf('<script>');
 const end=start<0?-1:source.indexOf('</script>',start+8);
 const code=end>start?source.slice(start+8,end):'';
 assert.ok(code,filename+' must contain a playable script');
 return code;
}
function runGame(filename,fps){
 const source=readFileSync(new URL('../examples/'+filename,import.meta.url),'utf8');
 const code=fixtureScript(source,filename);
 const pen={clearRect(){},fillRect(){},fillText(){}};
 const canvas={clientWidth:300,getContext:()=>pen};
 const context={c:canvas,s:{innerText:''},Math,requestAnimationFrame(fn){context.next=fn}};
 vm.runInNewContext(code,context,{timeout:1000});
 if(filename.includes('breakout'))context.onclick();
 const frames=Math.round(fps);
 for(let frame=1;frame<=frames;frame++)context.next(frame*1000/fps);
 return filename.includes('breakout')?{x:context.x,y:context.y}:{o:context.o,score:context.s,dead:context.dead,speed:context.a};
}
test('Brick Rush travels similar distances at 30 and 60 FPS',()=>{
 const a=runGame('breakout-pdf417.html',30),b=runGame('breakout-pdf417.html',60);
 assert.ok(Math.abs(a.x-b.x)<18,JSON.stringify({a,b}));
 assert.ok(Math.abs(a.y-b.y)<18,JSON.stringify({a,b}));
});
test('Neon Dodge scrolls at the same speed at 30 and 60 FPS',()=>{
 const a=runGame('neon-dodge-dotcode.html',30),b=runGame('neon-dodge-dotcode.html',60);
 assert.ok(Math.abs(a.o-b.o)<8,JSON.stringify({a,b}));
});

test('Neon Dodge continuously accelerates before any obstacle is passed',()=>{
 const html=readFileSync(new URL('../examples/neon-dodge-dotcode.html',import.meta.url),'utf8');
 const src=fixtureScript(html,'neon-dodge-dotcode.html');
 const g={fillRect(){},fillText(){},set fillStyle(x){},set font(x){}};
 const c={getContext:()=>g};
 const state={c,Math,requestAnimationFrame(fn){state.next=fn}};
 vm.runInNewContext(src,state,{timeout:500});
 const start=state.a;state.next(16.667);
 const second=state.a;state.next(33.334);
 assert.ok(second>start&&state.a>start,'Speed must grow during active play');
 assert.equal(state.s,0,'Acceleration cannot depend only on points');
 state.z=1;c.onclick();
 assert.equal(state.a,3.6,'Retry must reset acceleration to the start speed');
});

test('compact DotCode game still moves, accelerates and resets on retry',()=>{
 const js=readFileSync(new URL('../examples/neon-dodge-dotcode.js',import.meta.url),'utf8').trim();
 function play(fps){
   const c={onclick:null},state={c,Math};
   vm.runInNewContext(js,state,{timeout:500});
   let previous=0;
   for(let k=1;k<=fps;k++){
     const elapsed=k*1000/fps;
     state.tick(Math.min(3,(elapsed-previous)/17||1));
     previous=elapsed;
   }
   return state;
 }
 const slow=play(30),fast=play(60);
 assert.ok(Math.abs(slow.y-fast.y)<14,'Obstacle movement follows elapsed time');
 assert.ok(slow.a>4&&fast.a>4,'Obstacle speed increases');
 slow.z=1;slow.c.onclick();
 assert.equal(slow.a,4,'Retry resets speed');
 assert.equal(slow.s,0,'Retry resets score');
 assert.equal(slow.z,0,'Retry starts a new round');
});
