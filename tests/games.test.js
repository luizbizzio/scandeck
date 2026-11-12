import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function loadGame(name){
  const html=readFileSync(new URL('../examples/'+name,import.meta.url),'utf8');
  assert.match(html,/<script>[\s\S]*<\/script>/);
  assert.doesNotMatch(html,/<script[^>]*src=|https?:\/\//);
  return {html,script:html.match(/<script>([\s\S]+)<\/script>/)[1]};
}

function catchHarness(){
  const {html,script}=loadGame('catch-datamatrix.html');
  const s={textContent:'0 / 10'},t={textContent:'0s'};
  const b={style:{},removed:false,remove(){this.removed=true}};
  const intervals=[];
  const context={s,t,b,Math:{random:()=>.5},
    setInterval(fn,ms){assert.equal(ms,1000);intervals.push({fn,active:true});return intervals.length},
    clearInterval(id){intervals[id-1].active=false}};
  vm.runInNewContext(script,context,{timeout:500});
  return {html,s,t,b,intervals,tick(){for(const item of intervals)if(item.active)item.fn()}};
}

test('Catch 10 restores its original circular green target',()=>{
  const game=catchHarness();
  assert.match(game.html,/border-radius:50%/);
  assert.match(game.html,/background:#b9ff6a/);
  assert.match(game.html,/width:70px;height:70px/);
  assert.equal(game.b.style.left,'42.5%');
});

test('Catch 10 starts at zero, counts upward, and has no time limit',()=>{
  const game=catchHarness();
  assert.equal(game.t.textContent,'0s');
  assert.equal(game.intervals.length,1);
  for(let i=1;i<=41;i++)game.tick();
  assert.equal(game.t.textContent,'41s');
  assert.equal(game.b.removed,false);
  assert.equal(game.s.textContent,'0 / 10');
});

test('Catch 10 wins at ten taps and stops the elapsed timer',()=>{
  const game=catchHarness();
  for(let i=1;i<=10;i++){
    game.b.onclick();
    assert.equal(game.s.textContent,i===10?'YOU WIN':i+'/10');
  }
  assert.equal(game.b.removed,true);
  assert.equal(game.intervals[0].active,false);
  game.tick();
  assert.equal(game.t.textContent,'0s');
  assert.equal(game.s.textContent,'YOU WIN');
});

function memoryHarness(audio=true){
  const {html,script}=loadGame('memory-aztec.html');
  const tiles=Array.from({length:4},()=>({tagName:'BUTTON',style:{}}));
  const g={children:tiles},s={textContent:'Tap a color to start'};
  const queue=[],notes=[];
  const audioContext=function(){return {
    currentTime:0,destination:{},resume(){return Promise.resolve()},
    createOscillator(){return {frequency:{value:0},connect(v){return v},
      start(){notes.push(this.frequency.value)},stop(){}}},
    createGain(){return {gain:{value:0},connect(){return this}}}
  }};
  const context={g,s,window:audio?{AudioContext:audioContext}:{},Math:{random:()=>0},
    setTimeout(fn){queue.push(fn);return queue.length}};
  vm.runInNewContext(script,context,{timeout:500});
  return {html,context,g,s,tiles,notes,queue,
    flush(){
      let guard=100;
      while(s.textContent!=='REPEAT'&&guard-->0){
        assert.ok(queue.length,'The next sequence must be scheduled');
        queue.shift()();
      }
      assert.ok(guard>0,'The pattern must become playable');
    }};
}

test('Pattern Memory restores its original four rounded color tiles',()=>{
  const game=memoryHarness();
  assert.match(game.html,/grid-template-columns:repeat\(2,100px\)/);
  assert.match(game.html,/border-radius:14px/);
  assert.match(game.html,/background:#ee6659/);
  assert.match(game.html,/background:#69c778/);
  assert.match(game.html,/background:#669ce2/);
  assert.match(game.html,/background:#e8c15e/);
  assert.equal((game.html.match(/<button\b/g)||[]).length,4);
  assert.equal(game.s.textContent,'Tap a color to start');
});

test('Pattern Memory starts with a color tap and plays a sequence note',()=>{
  const game=memoryHarness();
  assert.equal(game.notes.length,0);
  game.g.onclick({target:game.tiles[2]});
  assert.equal(game.s.textContent,'WATCH');
  game.flush();
  assert.equal(game.s.textContent,'REPEAT');
  assert.ok(game.notes.includes(262));
});

test('Pattern Memory uses four distinct synthesized notes',()=>{
  const game=memoryHarness();
  game.g.onclick({target:game.tiles[0]});
  game.flush();
  for(let i=0;i<4;i++)game.context.note(i);
  assert.deepEqual(game.notes.slice(-4),[262,330,392,523]);
});

test('Pattern Memory plays five growing rounds and shows victory',()=>{
  const game=memoryHarness();
  game.g.onclick({target:game.tiles[0]});
  for(let round=1;round<=5;round++){
    game.flush();
    for(let n=0;n<round;n++)game.g.onclick({target:game.tiles[0]});
    assert.equal(game.s.textContent,round===5?'YOU WIN':'NICE');
  }
});

test('Pattern Memory resets on a wrong answer',()=>{
  const game=memoryHarness();
  game.g.onclick({target:game.tiles[0]});
  game.flush();
  game.g.onclick({target:game.tiles[1]});
  assert.equal(game.s.textContent,'TRY AGAIN');
  assert.equal(game.context.p.length,0);
  game.flush();
  assert.equal(game.context.p.length,1);
});

test('Pattern Memory also works without an audio device',()=>{
  const game=memoryHarness(false);
  game.g.onclick({target:game.tiles[0]});
  game.flush();
  game.g.onclick({target:game.tiles[0]});
  assert.equal(game.notes.length,0);
  assert.equal(game.s.textContent,'NICE');
});

test('Perfect Timing cycles the number and rewards clicking at seven',()=>{
  const source=readFileSync(new URL('../examples/tap-maxicode.js',import.meta.url),'utf8').trim();
  const body={innerHTML:''},alerts=[];
  const context={document:{body},setInterval(fn,delay){assert.equal(delay,400);context.tick=fn},alert:value=>alerts.push(value)};
  vm.runInNewContext(source,context,{timeout:500});
  for(let step=1;step<=7;step++){context.tick();assert.equal(body.innerHTML,step)}
  context.onclick();assert.equal(alerts.at(-1),true);
  context.tick();context.onclick();assert.equal(alerts.at(-1),false);
  context.tick();assert.equal(body.innerHTML,9,'Counter remains a one-shot timing challenge');
  assert.ok(source.length<=85,'MaxiCode source must remain compact');
});
test('Codebreaker only checks a guess when the GO button is clicked',()=>{
  const source=readFileSync(new URL('../examples/math-rmqr.js',import.meta.url),'utf8').trim();
  const a={value:'10'},b={innerText:'GO'},context={a,b,Date:{now:()=>37},document:{write(){}}};
  vm.runInNewContext(source,context,{timeout:500});
  assert.equal(context.n,37);
  assert.equal(context.t,7,'Focusing the input must not spend a guess');
  assert.equal(context.onclick,undefined,'Clicking outside the button must not spend a guess');
  b.onclick();assert.match(b.innerText,/UP/);
  a.value='90';b.onclick();assert.match(b.innerText,/DN/);
  a.value='37';b.onclick();assert.equal(b.innerText,'WIN');
  const a2={value:'0'},b2={innerText:'GO'},other={a:a2,b:b2,Date:{now:()=>80},document:{write(){}}};
  vm.runInNewContext(source,other,{timeout:500});
  for(let n=0;n<7;n++)b2.onclick();
  assert.equal(b2.innerText,'LOSE');
});
test('Brick Rush has slower ball, three lives and responsive paddle',()=>{
  const html=readFileSync(new URL('../examples/breakout-pdf417.html',import.meta.url),'utf8');
  const script=html.match(/<script>([\s\S]+)<\/script>/)[1];
  const ctx2d={clearRect(){},fillRect(){},beginPath(){},arc(){},fill(){},fillText(){}};
  const c={clientWidth:300,getContext(){return ctx2d}},s={innerText:''};
  const context={c,s,Math,requestAnimationFrame(fn){context.tick=fn}};
  vm.runInNewContext(script,context,{timeout:500});
  assert.equal(context.u,1.2);assert.equal(context.v,-1.4);assert.equal(context.l,3);assert.equal(context.z,0);
  context.onclick();context.tick();assert.equal(context.z,1);assert.ok(context.y<260);
  context.onmessage({data:'R'});assert.equal(context.p,170);
  context.y=330;context.tick();assert.equal(context.l,2);assert.equal(context.z,0);
  assert.equal(context.a.length,12);
});
test('Chroma Rush rewards the ink color and not the word',()=>{
  const html=readFileSync(new URL('../examples/colorpath-jab.html',import.meta.url),'utf8');
  assert.match(html,/TEXT COLOR/);
  assert.match(html,/id=track/);
  const code=html.match(/<script>([\s\S]+)<\/script>/)[1];
  let randomIndex=0,nextTimer=0;
  const timers=new Map();
  const t={textContent:'',style:{}},s={textContent:''},fill={style:{},offsetWidth:100},
    start={textContent:'START',hidden:false},g={};
  const context={t,s,fill,start,g,Math:{random:()=>randomIndex++%2?.3:0},
    setTimeout(fn,ms){let id=++nextTimer;timers.set(id,{fn,ms});return id},
    clearTimeout(id){timers.delete(id)}};
  vm.runInNewContext(code,context,{timeout:500});
  start.onclick();
  assert.equal(t.textContent,'RED','Word must differ from ink');
  assert.equal(t.style.color,'#6e8','Ink must be green');
  assert.equal(context.k,1);
  g.onclick({target:{dataset:{k:'0'}}});
  assert.equal(context.l,2,'Tapping the word instead of its color loses a life');
  g.onclick({target:{dataset:{k:'1'}}});
  assert.equal(context.n,1);
  assert.equal([...timers.values()].at(-1).ms,1640);
  for(let n=0;n<9;n++)g.onclick({target:{dataset:{k:'1'}}});
  assert.equal(t.textContent,'YOU WIN');
  assert.equal(start.hidden,false);
  start.onclick();
  for(let n=0;n<3;n++)g.onclick({target:{dataset:{k:'0'}}});
  assert.equal(t.textContent,'GAME OVER');
});
test('Wire Crisis shows the requested wire and the current round',()=>{
  const source=readFileSync(new URL('../examples/colormatch-ultra.js',import.meta.url),'utf8').trim();
  assert.match(source,/class=r/);assert.match(source,/class=g/);assert.match(source,/class=b/);
  const t={innerHTML:''},context={document:{write(){}},t,Math:{random:()=>0}};
  vm.runInNewContext(source,context,{timeout:500});
  context.onload();
  assert.equal(t.innerHTML,'CUT R 1/3');
  for(let n=2;n<=3;n++){
    context.onclick({target:{tagName:'BUTTON',innerHTML:'R'}});
    assert.equal(t.innerHTML,'CUT R '+n+'/3');
  }
  context.onclick({target:{tagName:'BUTTON',innerHTML:'R'}});
  assert.equal(t.innerHTML,'SAFE');
  const t2={innerHTML:''},other={document:{write(){}},t:t2,Math:{random:()=>0}};
  vm.runInNewContext(source,other,{timeout:500});
  other.onload();
  other.onclick({target:{tagName:'BUTTON',innerHTML:'G'}});
  assert.equal(t2.innerHTML,'BOOM');
});
