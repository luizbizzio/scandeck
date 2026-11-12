import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function extractScript(html){
  const opening='<script>',closing='</script>';
  const begin=html.indexOf(opening),end=html.indexOf(closing,begin+opening.length);
  assert.ok(begin>=0&&end>begin,'Game must include a complete inline script');
  assert.equal(html.indexOf('<script',begin+opening.length),-1,'Game should have exactly one script');
  return html.slice(begin+opening.length,end);
}
function loadGame(name){
  const html=readFileSync(new URL('../examples/'+name,import.meta.url),'utf8');
  assert.ok(!html.includes('http://')&&!html.includes('https://'),'The game must have no remote dependency');
  assert.ok(!html.includes('<script src=')&&!html.includes('<script type='),'The game must use an inline script');
  return {html,script:extractScript(html)};
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

test('Perfect Timing sets a randomized millisecond target and starts on the first tap',()=>{
 const src=readFileSync(new URL('../examples/tap-maxicode.js',import.meta.url),'utf8').trim();
 const alerts=[];let now=100000;
 const DateMock=function(){return {valueOf:()=>now}};
 const context={Date:DateMock,alert:x=>alerts.push(x)};
 vm.runInNewContext(src,context,{timeout:500});
 const target=999+100000%999;
 assert.equal(context.n,target);
 assert.equal(context.t,0);
 context.onclick();assert.equal(context.t,100000);
 now+=target-55;context.onclick();assert.equal(alerts.at(-1),-55);
 now+=100;context.onclick();assert.equal(alerts.at(-1),45);
 assert.ok(src.length<=80,'The full program must fit MaxiCode');
 now+=317;
 const other={Date:DateMock,alert(){}};
 vm.runInNewContext(src,other,{timeout:500});
 assert.notEqual(context.n,other.n,'A new launch uses a new millisecond-derived target');
});
test('Codebreaker checks only GO and spells both directions completely',()=>{
 const src=readFileSync(new URL('../examples/math-rmqr.js',import.meta.url),'utf8').trim();
 const a={value:'10'},b={innerText:'GO'},DateMock=function(){return {valueOf:()=>37}};
 const context={a,b,Date:DateMock,document:{write(){}}};
 vm.runInNewContext(src,context,{timeout:500});
 assert.equal(context.n,37);assert.equal(context.t,7);
 assert.equal(context.onclick,undefined,'Focusing the input must not use a guess');
 b.onclick();assert.equal(b.innerText,'6UP');
 a.value='90';b.onclick();assert.equal(b.innerText,'5DOWN');
 a.value='37';b.onclick();assert.equal(b.innerText,'WIN');
 const fail={a:{value:'0'},b:{innerText:'GO'},Date:function(){return {valueOf:()=>80}},document:{write(){}}};
 vm.runInNewContext(src,fail,{timeout:500});for(let i=0;i<7;i++)fail.b.onclick();
 assert.equal(fail.b.innerText,'LOSE');
 assert.ok(src.length<=145,'rMQR budget is extremely limited');
});
test('Brick Rush retains slower ball, three lives and pointer/keyboard control',()=>{
 const html=readFileSync(new URL('../examples/breakout-pdf417.html',import.meta.url),'utf8');
 const src=extractScript(html);
 const pen={clearRect(){},fillRect(){},beginPath(){},arc(){},fill(){},fillText(){}};
 const c={clientWidth:300,getContext(){return pen}},s={innerText:''},ctx={c,s,Math,requestAnimationFrame(fn){ctx.tick=fn}};
 vm.runInNewContext(src,ctx,{timeout:500});
 assert.equal(ctx.u,1.2);assert.equal(ctx.l,3);ctx.onclick();ctx.tick();assert.equal(ctx.z,1);
 ctx.onmessage({data:'R'});assert.equal(ctx.p,170);
 assert.match(html,/BRICK RUSH/);
});
test('Chroma Rush separates its scoreboard and has longer rounds',()=>{
 const html=readFileSync(new URL('../examples/colorpath-jab.html',import.meta.url),'utf8');
 const src=extractScript(html);
 const t={textContent:'',style:{}},s={textContent:''},l={textContent:''},start={hidden:false,textContent:'START'},g={},fill={style:{},offsetWidth:50};
 let timerId=0;
 const timers=new Map();
 const ctx={t,s,l,start,g,fill,Math:{random:()=>0},setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id},clearTimeout(id){timers.delete(id)}};
 vm.runInNewContext(src,ctx,{timeout:500});
 start.onclick();
 assert.equal(ctx.k,0);assert.equal(ctx.w,1,'The word must differ from the ink color');
 assert.equal(t.textContent,'GREEN');assert.equal(t.style.color,'#ed7776');
 assert.equal([...timers.values()].at(-1).ms,3000,'The player must have enough time');
 g.onclick({target:{dataset:{k:'0'}}});assert.equal(ctx.n,1);
 assert.equal([...timers.values()].at(-1).ms,2900);
 for(let i=0;i<9;i++)g.onclick({target:{dataset:{k:'0'}}});
 assert.equal(t.textContent,'YOU WIN');
 start.onclick();
 for(let i=0;i<3;i++)g.onclick({target:{dataset:{k:'1'}}});
 assert.equal(t.textContent,'GAME OVER');
 assert.match(html,/class=stats/);assert.match(html,/class=prompt/);
 assert.doesNotMatch(html,/Example: RED in blue letters/);
});
test('Wire Crisis memorization increases from 3 to 7 colors over 5 rounds',()=>{
 const src=readFileSync(new URL('../examples/colormatch-ultra.js',import.meta.url),'utf8').trim();
 assert.ok(src.length<=248,'Entire program must still fit Ultracode');
 const t={innerHTML:''},ctx={t,document:{write(){}},Math:{random:()=>0}};
 vm.runInNewContext(src,ctx,{timeout:500});
 assert.equal(t.innerHTML,'RRR');
 for(let round=0;round<5;round++){
   for(let cut=0;cut<round+3;cut++){
     ctx.onclick({target:{innerHTML:'R'}});
     assert.equal(t.innerHTML,cut===round+2?(round===4?'WIN':'R'.repeat(round+4)):'?');
   }
 }
 ctx.onclick({target:{innerHTML:'G'}});assert.equal(t.innerHTML,'WIN','Finished game stays closed');
 const wrong={t:{innerHTML:''},document:{write(){}},Math:{random:()=>0}};
 vm.runInNewContext(src,wrong,{timeout:500});
 wrong.onclick({target:{innerHTML:'G'}});assert.equal(wrong.t.innerHTML,'BOOM');
 wrong.onclick({target:{innerHTML:'R'}});assert.equal(wrong.t.innerHTML,'BOOM','Loss is final');
});

