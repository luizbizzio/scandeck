/* Shared interpreter for tiny Micro QR maze bytecode. The symbol stores seed + difficulty, not a standalone game. */
export function generateMaze(seed=0x3650, level=1, nonce=0) {
  const N=6, count=N*N, walls=Array(count).fill(15), seen=Array(count).fill(false);
  const moves=[[0,-1,1,4],[1,0,2,8],[0,1,4,1],[-1,0,8,2]];
  let state=(seed^nonce^0x9e3779b9)>>>0||1;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296};
  const stack=[0];seen[0]=true;
  while(stack.length) {
    const p=stack[stack.length-1],x=p%N,y=p/N|0;
    const options=moves.filter(([dx,dy,,],i)=>{
      const a=x+dx,b=y+dy;
      return a>=0&&a<N&&b>=0&&b<N&&!seen[b*N+a];
    });
    if(!options.length){stack.pop();continue}
    const [dx,dy,bit,opposite]=options[random()*options.length|0];
    const next=(y+dy)*N+x+dx;
    walls[p]&=~bit;walls[next]&=~opposite;seen[next]=true;stack.push(next);
  }
  const distances=Array(count).fill(-1),queue=[0];distances[0]=0;
  for(let q=0;q<queue.length;q++){
    const p=queue[q],x=p%N,y=p/N|0;
    for(const [dx,dy,bit] of moves){
      if(walls[p]&bit)continue;
      const next=p+dy*N+dx;
      if(distances[next]<0){distances[next]=distances[p]+1;queue.push(next)}
    }
  }
  const shortest=distances[count-1];
  if(shortest<0)throw Error('Maze generation failed');
  return {walls,shortest,limit:Math.min(35,shortest+Math.max(2,7-level)),side:N};
}
export function mazeDocument(game,csp) {
  const match=/^M([0-9A-F]{4})([1-9])$/.exec(game.source);
  if(!match)throw Error('Invalid Micro QR maze bytecode');
  const seed=parseInt(match[1],16), difficulty=Number(match[2]);
  if(seed&32769)throw Error('Blocked maze start or exit');
  const css='<style>html,body{margin:0;min-height:100%;background:#0b1410;color:#e0f5e2;font:16px/1.45 system-ui}body{min-height:100dvh;display:grid;place-content:center;box-sizing:border-box;padding:14px;text-align:center}.panel{width:min(380px,94vw);display:grid;justify-items:center;gap:8px}h2{font-size:24px;margin:0;color:#c9f99e}.hint{color:#b7ccba;font-size:13px}.stats{width:100%;display:flex;justify-content:space-between;color:#c8ecbb;font-weight:700;font-size:13px}#board{width:min(300px,68vh,83vw);aspect-ratio:1;display:grid;grid-template-columns:repeat(6,1fr);background:#14251b;border:4px solid #234431;border-radius:12px;overflow:hidden;touch-action:none}.cell{box-sizing:border-box;display:grid;place-items:center;color:#bdfb94;font-size:20px;border:2px solid transparent}.player{color:#c4fa98;font-size:25px}.goal{color:#f7d17b}.controls{display:grid;grid-template-columns:repeat(3,64px);gap:8px;justify-content:center}button{border:1px solid #487756;border-radius:12px;background:#213a2a;color:#c9ffa5;font-size:24px;font-weight:750;min-height:48px;touch-action:manipulation}button:active{background:#487e4c}.muted{visibility:hidden}#next{font-size:14px;padding:8px 16px;min-height:42px;width:min(280px,100%)}#result{font-size:14px;min-height:23px;color:#d4f4c3}</style>';
  const body='<main class=panel><h2>POCKET MAZE</h2><div class=hint>Find the star. A new maze every round.</div><div class=stats><span id=stage>MAZE 1</span><span id=counter>0 MOVES</span></div><div id=board aria-label="Maze grid"></div><div id=result aria-live=polite></div><div class=controls><i></i><button data-d=-6>↑</button><i></i><button data-d=-1>←</button><button data-d=6>↓</button><button data-d=1>→</button></div><button id=next>NEW MAZE</button></main>';
  const js='const generateMaze='+generateMaze.toString()+';const seed='+seed+',difficulty='+difficulty+';'
    +'let level=1,maze,position=0,steps=0,ended=0,last="";'
    +'const board=document.getElementById("board"),result=document.getElementById("result"),counter=document.getElementById("counter"),stage=document.getElementById("stage"),next=document.getElementById("next");'
    +'function render(){board.innerHTML="";for(let i=0;i<36;i++){const tile=document.createElement("div"),w=maze.walls[i];tile.className="cell";tile.style.borderTopColor=w&1?"#365a45":"transparent";tile.style.borderRightColor=w&2?"#365a45":"transparent";tile.style.borderBottomColor=w&4?"#365a45":"transparent";tile.style.borderLeftColor=w&8?"#365a45":"transparent";tile.textContent=i==position?"●":i==35?"★":"";if(i==position)tile.classList.add("player");if(i==35)tile.classList.add("goal");board.append(tile)}counter.textContent=steps+" / "+maze.limit+" MOVES";stage.textContent="MAZE "+level}'
    +'function newMaze(){let nextMap,fingerprint;for(let tries=0;tries<12;tries++){nextMap=generateMaze(seed,difficulty,Math.random()*4294967296|0);fingerprint=nextMap.walls.join(",");if(fingerprint!==last)break}last=fingerprint;maze=nextMap;position=steps=ended=0;result.textContent="Swipe or use the arrows";next.textContent="NEW MAZE";render()}'
    +'function move(delta){if(!delta||ended)return;const bit=delta==-6?1:delta==1?2:delta==6?4:8;if(maze.walls[position]&bit)return;position+=delta;steps++;if(position==35){ended=1;result.textContent="SOLVED!";next.textContent="NEXT MAZE"}else if(steps>=maze.limit){ended=1;result.textContent="OUT OF MOVES";next.textContent="TRY ANOTHER"}render()}'
    +'document.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>move(+b.dataset.d));'
    +'onkeydown=e=>{const d=({ArrowUp:-6,ArrowRight:1,ArrowDown:6,ArrowLeft:-1,w:-6,d:1,s:6,a:-1})[e.key];if(d){e.preventDefault();move(d)}};onmessage=e=>{const d=({U:-6,R:1,D:6,L:-1})[e.data];if(d)move(d)};'
    +'let x,y;board.onpointerdown=e=>{x=e.clientX;y=e.clientY};board.onpointerup=e=>{const dx=e.clientX-x,dy=e.clientY-y;if(Math.max(Math.abs(dx),Math.abs(dy))>16)move(Math.abs(dx)>Math.abs(dy)?dx>0?1:-1:dy>0?6:-6)};'
    +'next.onclick=()=>{level++;newMaze()};newMaze();';
  return '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">'+csp+css+'</head><body>'+body+'<script>'+js+'</script></body></html>';
}
