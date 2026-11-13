import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function runGame(filename,fps){
 const source=readFileSync(new URL('../examples/'+filename,import.meta.url),'utf8');
 const code=source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(code,filename+' must contain a playable script');
 const pen={clearRect(){},fillRect(){},fillText(){}};
 const canvas={clientWidth:300,getContext:()=>pen};
 const context={c:canvas,s:{innerText:''},Math,requestAnimationFrame(fn){context.next=fn}};
 vm.runInNewContext(code,context,{timeout:1000});
 if(filename.includes('breakout'))context.onclick();
 const frames=Math.round(fps);
 for(let frame=1;frame<=frames;frame++)context.next(frame*1000/fps);
 return filename.includes('breakout')?{x:context.x,y:context.y}:{o:context.o,score:context.s,dead:context.dead};
}
test('Brick Rush travels similar distances at 30 and 60 FPS',()=>{
 const a=runGame('breakout-pdf417.html',30),b=runGame('breakout-pdf417.html',60);
 assert.ok(Math.abs(a.x-b.x)<6,JSON.stringify({a,b}));
 assert.ok(Math.abs(a.y-b.y)<7,JSON.stringify({a,b}));
});
test('Neon Dodge scrolls at the same speed at 30 and 60 FPS',()=>{
 const a=runGame('neon-dodge-dotcode.html',30),b=runGame('neon-dodge-dotcode.html',60);
 assert.ok(Math.abs(a.o-b.o)<8,JSON.stringify({a,b}));
});
