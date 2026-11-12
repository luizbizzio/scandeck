import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const loadGame=name=>{
  const html=readFileSync(new URL('../examples/'+name,import.meta.url),'utf8');
  assert.ok(html.includes('background') || html.includes('bgcolor=black'));
  const script=html.match(/<script>([\s\S]+)<\/script>/)?.[1];
  assert.ok(script,'All game JavaScript must be inside the HTML');
  assert.doesNotMatch(html,/<script[^>]*src=|https?:\/\//);
  return script;
};

const newCatch=()=>{
  const intervals=new Map();
  const b={style:{},removed:false,remove(){this.removed=true}};
  const s={innerText:''},t={innerText:'20s'};
  const context={b,s,t,Math:{random:()=>.5},setInterval(fn,delay){
    assert.equal(delay,1000);
    const id=intervals.size+1;
    intervals.set(id,{fn,active:true});
    return id;
  },clearInterval(id){intervals.get(id).active=false}};
  vm.runInNewContext(loadGame('catch-datamatrix.html'),context,{timeout:500});
  return {context,b,s,t,intervals,tick(){for(const v of intervals.values())if(v.active)v.fn()}};
};

test('Catch 10 timer starts at the first hit, not at page load',()=>{
  const game=newCatch();
  assert.equal(game.t.innerText,'20s');
  assert.equal(game.intervals.size,0);
  assert.equal(game.b.style.left,'37.5%');
  game.b.onclick();
  assert.equal(game.s.innerText,'1/10');
  assert.equal(game.intervals.size,1);
  game.tick();
  assert.equal(game.t.innerText,'19s');
});

test('Catch 10 wins with ten taps and stops the countdown',()=>{
  const {b,s,intervals,tick}=newCatch();
  for(let n=1;n<=10;n++){
    b.onclick();
    assert.equal(s.innerText,n===10?'YOU WIN':n+'/10');
  }
  assert.equal(b.removed,true);
  assert.equal(intervals.get(1).active,false);
  tick();
  assert.equal(s.innerText,'YOU WIN');
});

test('Catch 10 loses when the twenty second timer reaches zero',()=>{
  const {b,s,t,tick,intervals}=newCatch();
  b.onclick();
  for(let sec=19;sec>=0;sec--){
    tick();
    assert.equal(t.innerText,sec+'s');
  }
  assert.equal(s.innerText,'TIME UP');
  assert.equal(b.removed,true);
  assert.equal(intervals.get(1).active,false);
  tick();
  assert.equal(t.innerText,'0s');
});

const newMemory=({audio=true,random=()=>0}={})=>{
  const notes=[],queue=[],tiles=Array.from({length:4},()=>({tagName:'BUTTON',style:{}}));
  const g={children:tiles,hidden:true},s={innerText:'Tap START for sound'};
  const start={removed:false,remove(){this.removed=true}};
  const clock=function(){return {
    currentTime:0,destination:{},resume(){this.resumed=true;return Promise.resolve()},
    createOscillator(){
      const node={frequency:{value:0},connect(gain){return gain},start(){notes.push(node.frequency.value)},stop(t){assert.ok(t>0)}};
      return node;
    },
    createGain(){return {gain:{value:0},connect(){return this}}}
  }}
  const context={g,s,start,window:audio?{AudioContext:clock}:{},Math:{random},
    setTimeout(fn){queue.push(fn);return queue.length}};
  vm.runInNewContext(loadGame('memory-aztec.html'),context,{timeout:500});
  const flush=()=>{
    let guard=100;
    while(s.innerText!=='REPEAT'&&guard--){
      assert.ok(queue.length,'Sequence callback must be scheduled');
      queue.shift()();
    }
    assert.ok(guard>0,'Sequence must become playable');
  };
  return {context,g,s,start,notes,queue,flush};
};

test('Pattern Memory uses a Start tap to unlock the sound and show the board',()=>{
  const game=newMemory();
  assert.equal(game.notes.length,0);
  assert.equal(game.g.hidden,true);
  assert.equal(game.s.innerText,'Tap START for sound');
  game.start.onclick();
  assert.equal(game.start.removed,true);
  assert.equal(game.g.hidden,false);
  game.flush();
  assert.equal(game.s.innerText,'REPEAT');
  assert.ok(game.notes.includes(262),'The first color must make its tone');
  game.g.onclick({target:game.g.children[0]});
  assert.equal(game.s.innerText,'NICE');
});

test('Pattern Memory has a distinct note for each of its four colors',()=>{
  const game=newMemory({random:()=>.01});
  game.start.onclick();
  game.flush();
  for(let color=0;color<4;color++)game.context.h(color);
  for(const hz of [262,330,392,523])assert.ok(game.notes.includes(hz),hz+' Hz tone is missing');
  assert.ok(game.notes.length>=5);
});

test('Pattern Memory completes five growing rounds with audio',()=>{
  const game=newMemory();
  game.start.onclick();
  for(let round=1;round<=5;round++){
    game.flush();
    for(let n=0;n<round;n++)game.g.onclick({target:game.g.children[0]});
    assert.equal(game.s.innerText,round===5?'WIN':'NICE');
  }
});

test('Pattern Memory restarts after a wrong answer',()=>{
  const game=newMemory();
  game.start.onclick();
  game.flush();
  game.g.onclick({target:game.g.children[1]});
  assert.equal(game.s.innerText,'LOSE');
  assert.equal(game.context.p.length,0);
  game.flush();
  assert.equal(game.context.p.length,1);
});

test('Pattern Memory still works with sound unavailable',()=>{
  const game=newMemory({audio:false});
  game.start.onclick();
  game.flush();
  assert.equal(game.s.innerText,'REPEAT');
  game.g.onclick({target:game.g.children[0]});
  assert.equal(game.s.innerText,'NICE');
});
