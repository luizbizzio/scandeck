import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const loadGame=name=>{
  const html=readFileSync(new URL('../examples/'+name,import.meta.url),'utf8');
  assert.ok(html.includes('background') || html.includes('bgcolor=black'));
  const script=html.match(/<script>([\s\S]+)<\/script>/)?.[1];
  assert.ok(script,'The game JavaScript must be inside the HTML code');
  return script;
};

test('Catch 10 moves a touch target and ends at ten hits',()=>{
  const b={style:{},removed:false,remove(){this.removed=true}};
  const s={innerText:'0'};
  const math={random:()=>.5};
  const context={b,s,Math:math};
  vm.runInNewContext(loadGame('catch-datamatrix.html'),context,{timeout:500});
  assert.equal(b.style.left,'37.5%');
  assert.equal(b.style.top,'52.5%');
  for(let n=1;n<=9;n++){
    b.onclick();
    assert.equal(s.innerText,n);
    assert.equal(b.removed,false);
  }
  b.onclick();
  assert.equal(s.innerText,'YOU WIN');
  assert.equal(b.removed,true);
});

test('Pattern Memory repeats growing sequences and ends on round five',()=>{
  const tiles=Array.from({length:4},()=>({tagName:'BUTTON',style:{}}));
  const g={children:tiles};
  const s={innerText:'WATCH'};
  const queue=[];
  const context={g,s,Math:{random:()=>.01},setTimeout:(fn)=>{queue.push(fn);return queue.length}};
  vm.runInNewContext(loadGame('memory-aztec.html'),context,{timeout:500});
  for(let round=1;round<=5;round++){
    let iterations=0;
    while(s.innerText!=='REPEAT'&&iterations++<100){
      assert.ok(queue.length,'The next pattern must be scheduled');
      queue.shift()();
    }
    assert.equal(s.innerText,'REPEAT');
    for(let n=0;n<round;n++)g.onclick({target:tiles[0]});
    assert.equal(s.innerText,round===5?'WIN':'NICE');
  }
});

test('Pattern Memory rejects a wrong tap and starts over',()=>{
  const tiles=Array.from({length:4},()=>({tagName:'BUTTON',style:{}}));
  const g={children:tiles},s={innerText:'WATCH'},queue=[];
  const context={g,s,Math:{random:()=>0},setTimeout:fn=>queue.push(fn)};
  vm.runInNewContext(loadGame('memory-aztec.html'),context,{timeout:500});
  let limit=100;
  while(s.innerText!=='REPEAT'&&limit--)queue.shift()();
  g.onclick({target:tiles[1]});
  assert.equal(s.innerText,'LOSE');
  assert.equal(context.p.length,0);
  while(s.innerText!=='REPEAT'&&limit--)queue.shift()();
  assert.equal(context.p.length,1);
});
