import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function runGame(filename,fps){
 const source=readFileSync(new URL('../examples/'+filename,import.meta.url),'utf8');
 // These are our own fixed, one-script HTML fixtures, not arbitrary HTML.
 // Use exact delimiters instead of treating a regex as an HTML parser.
 const start=source.indexOf('<script>'),end=source.indexOf('</script>',start+8);
 const code=start>=0&&end>start?source.slice(start+8,end):null;
 assert.ok(code,filename+' must contain a playable script');
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
 const src=html.match(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/i)?.[1];
 const g={fillRect(){},fillText(){},set fillStyle(x){},set font(x){}};
 const c={getContext:()=>g};
 const state={c,Math,requestAnimationFrame(fn){state.next=fn}};
 vm.runInNewContext(src,state,{timeout:500});
 const start=state.a;state.next(16.667);
 const second=state.a;state.next(33.334);
 assert.ok(second>start&&state.a>start,'Speed must grow during active play');
 assert.equal(state.s,0,'Acceleration cannot depend only on points');
 state.dead=1;c.onclick();
 assert.equal(state.a,3.6,'Retry must reset acceleration to the start speed');
});
