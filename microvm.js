/* ScanDeck Micro VM: all rules are bytecode; this module provides generic opcodes and UI. */
export function parseMicroProgram(source){
  if(typeof source!=='string'||source.length>15||!source.startsWith('V1'))
    throw Error('Micro VM requires a V1 program no longer than 15 bytes.');
  const result=[];
  for(let pc=2;pc<source.length;pc++){
    const op=source[pc];let argument=0;
    if('RTL'.includes(op)){
      if(pc+1>=source.length||!/^[1-9]$/.test(source[pc+1]))
        throw Error('Missing Micro VM instruction parameter.');
      argument=Number(source[++pc]);
      if(op==='R'&&argument<2)throw Error('Random-choice range must be 2 to 9.');
    }else if(!'DITC+X'.includes(op))throw Error('Unsupported Micro VM opcode.');
    result.push([op,argument]);
  }
  if(!result.length||result.at(-1)[0]!=='X'||result.length>12||
    !result.some(x=>x[0]==='I')||!result.some(x=>x[0]==='R')||
    !result.some(x=>x[0]==='D')||!result.some(x=>x[0]==='L'))
    throw Error('Micro VM needs a complete, bounded interactive program.');
  return result;
}

export async function executeMicroProgram(instructions,io){
  if(!Array.isArray(instructions)||instructions.length>12)throw Error('Invalid VM instructions.');
  let pc=0,round=1,score=0,target=1,choices=4,seconds=3,selected=-1,correct=false;
  for(let step=0;step<180;step++){
    if(pc<0||pc>=instructions.length)throw Error('Micro VM program did not terminate.');
    const [opcode,arg]=instructions[pc++];
    if(opcode==='R'){
      choices=arg;
      const value=io.random(choices);
      if(!Number.isInteger(value)||value<0||value>=choices)throw Error('Invalid VM random value.');
      target=value+1;
    }else if(opcode==='D'){
      await io.display({target,choices,round,score,seconds});
    }else if(opcode==='T'){
      seconds=arg;
    }else if(opcode==='I'){
      selected=await io.input(seconds);
    }else if(opcode==='C'){
      correct=selected===target;
    }else if(opcode==='+'){
      if(correct)score++;
    }else if(opcode==='L'){
      if(round<arg){round++;pc=0;}
    }else if(opcode==='X'){
      const result={score,rounds:round};
      await io.finish(result);
      return result;
    }else throw Error('Invalid VM opcode.');
  }
  throw Error('Micro VM execution limit exceeded.');
}

export function microVmHtml(source){
  const instructions=parseMicroProgram(source);
  const program=JSON.stringify(instructions);
  const execute='('+executeMicroProgram.toString()+')';
  return `<style>
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;min-height:100dvh;background:#0b1410;color:#ecf8e9;font:16px system-ui;display:grid;place-items:center;padding:20px}
main{width:min(450px,100%);text-align:center}
h1{font:800 clamp(32px,9vw,46px)/1.1 system-ui;letter-spacing:-.06em;margin:0 0 11px;color:#c9fa9b}
.intro{color:#a4b9a8;font:14px/1.5 system-ui;margin:0 0 24px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px;color:#b7d3b9;font:700 12px system-ui;letter-spacing:.08em}
.goal{border:1px solid #3c6042;background:#17271c;border-radius:18px;padding:25px 10px;margin:0 0 18px}
.goal small{display:block;color:#b3ccb5;font:650 12px system-ui;letter-spacing:2px;margin:0 0 9px}
#target{display:block;color:#d3ff9e;font:800 clamp(60px,18vw,95px)/1 system-ui}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(66px,1fr));gap:10px}
.tiles button{border:1px solid #476847;background:#243c2b;color:#e1f7dc;border-radius:13px;min-height:90px;font:800 34px system-ui;cursor:pointer;touch-action:manipulation}
.tiles button:active{transform:scale(.96);background:#a4ed77;color:#0a170f}
.tiles button:focus-visible{outline:3px solid #c8f9a2;outline-offset:2px}
.tiles button:disabled{opacity:.5}
.clock{color:#d1fbb2;font:800 32px system-ui;margin:20px 0 5px;font-variant-numeric:tabular-nums}
.progress{height:7px;border-radius:8px;background:#2a3a2d;overflow:hidden}
#bar{width:100%;height:100%;background:#bdf28d;transform-origin:left}
#message{color:#bbd5c0;font:700 14px system-ui;min-height:22px;margin-top:16px}
</style>
<main><h1>POCKET REFLEX</h1><p class=intro>Tap the matching number before time runs out. Play each round before time runs out.</p>
<div class=top><span id=round>ROUND 1 / 5</span><span id=score>0 POINTS</span></div>
<div class=goal><small>FIND THIS NUMBER</small><strong id=target>?</strong></div>
<div id=tiles class=tiles role=group aria-label="Choose a number"></div>
<div id=clock class=clock>3.0s</div><div class=progress><div id=bar></div></div>
<p id=message aria-live=polite>Get ready</p></main>
<script>
const instructions=${program};
const totalRounds=instructions.find(([op])=>op==='L')?.[1]||1;
const $=id=>document.getElementById(id);
const tiles=$('tiles'),round=$('round'),score=$('score'),target=$('target'),
 clock=$('clock'),bar=$('bar'),message=$('message');
const io={
 random(max){return Math.floor(Math.random()*max)},
 display(state){
  target.textContent=state.target;
  round.textContent='ROUND '+state.round+' / '+totalRounds;
  score.textContent=state.score+' POINTS';
  clock.textContent=state.seconds.toFixed(1)+'s';
  bar.style.width='100%';
  message.textContent='TAP THE MATCHING NUMBER';
  tiles.replaceChildren();
  for(let n=1;n<=state.choices;n++){
   const button=document.createElement('button');
   button.type='button';button.dataset.value=String(n);button.textContent=n;
   button.setAttribute('aria-label','Select number '+n);
   tiles.append(button);
  }
 },
 input(seconds){
  return new Promise(resolve=>{
   let done=false,interval;
   const deadline=performance.now()+seconds*1000;
   const finish=value=>{
    if(done)return;
    done=true;clearInterval(interval);tiles.onclick=null;
    for(const button of tiles.children)button.disabled=true;
    resolve(value);
   };
   tiles.onclick=event=>{
    const button=event.target.closest('button[data-value]');
    if(button)finish(Number(button.dataset.value));
   };
   const tick=()=>{
    const left=Math.max(0,(deadline-performance.now())/1000);
    clock.textContent=left.toFixed(1)+'s';
    bar.style.width=(left/seconds*100)+'%';
    if(left===0){message.textContent='TIME UP';finish(-1)}
   };
   interval=setInterval(tick,60);
   tick();
  });
 },
 finish(result){
  tiles.onclick=null;tiles.replaceChildren();
  target.textContent=result.score+'/'+result.rounds;
  round.textContent='COMPLETE';score.textContent=result.score+' POINTS';
  clock.textContent='FINISHED';bar.style.width='0%';
  message.textContent=result.score===result.rounds?'PERFECT RUN!':'PRESS RETRY TO PLAY AGAIN';
 }
};
${execute}(instructions,io).catch(()=>{message.textContent='PROGRAM ERROR'});
</script>`;
}
