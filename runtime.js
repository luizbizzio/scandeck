/* Every game is rendered in an opaque-origin, scripts-only sandbox.
   Strict CSP stops outgoing requests; malicious game code may still waste CPU.
*/
const CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; form-action 'none'; base-uri 'none'; object-src 'none'">`;
const shell = (body) => '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + CSP + '</head><body>' + body + '</body></html>';
export function gameDocument(game) {
  if (game.kind === 'html') {
    // The meta policy must appear before game content, including authored <script> tags.
    return CSP + game.source;
  }
  if (game.kind === 'standalone') return shell('<script>' + game.source + '</script>');
  if(game.kind==='maze') {
    const m=/^M([0-9A-F]{4})([1-9])$/.exec(game.source);
    if(!m)throw Error('Invalid maze program.');
    const wall=parseInt(m[1],16),limit=Number(m[2]);
    if(wall&32769)throw Error('The maze entrance or exit is blocked.');
    return shell('<style>body{background:#080d0a;color:#c6ffa1;text-align:center;font:20px system-ui}#board{width:240px;margin:18px auto;display:grid;grid-template-columns:repeat(4,56px);gap:5px}#board i{height:56px;border-radius:8px;background:#21352b;display:grid;place-items:center;font-style:normal}button{font-size:24px;margin:4px;padding:8px 17px;background:#bddf9c;border:0;border-radius:7px}</style><h2>POCKET MAZE</h2><p id=s></p><div id=board></div><div><button data-d=-4>↑</button></div><div><button data-d=-1>←</button><button data-d=4>↓</button><button data-d=1>→</button></div><button id=again>Restart</button><script>w='+wall+';max='+limit+';p=0;n=0;done=0;draw=()=>{board.innerHTML=Array.from({length:16},(_,i)=>"<i style=background:"+(w>>i&1?"#526454":i==p?"#a3e97e":i==15?"#f1b26a":"#21352b")+">"+(i==p?"●":i==15?"★":"")+"</i>").join("");s.textContent=p==15?"YOU WIN":done?"OUT OF MOVES":n+"/"+max+" MOVES"};move=d=>{if(!d||done||d==1&&p%4==3||d==-1&&p%4==0||p+d<0||p+d>15||w>>(p+d)&1)return;p+=d;done=p==15||++n>=max;draw()};onclick=e=>{if(e.target.dataset.d)move(+e.target.dataset.d)};onkeydown=e=>move(({ArrowUp:-4,ArrowDown:4,ArrowLeft:-1,ArrowRight:1,w:-4,s:4,a:-1,d:1})[e.key]||0);onmessage=e=>move(({U:-4,D:4,L:-1,R:1})[e.data]||0);again.onclick=()=>{p=n=done=0;draw()};draw()</script>');
  }
  if(game.kind==='bytecode') {
    // The entire arithmetic instruction lives in the code. The player UI and
    // instruction decoder are reusable virtual-machine services, not game data.
    if(!/^Q[0-9][+*-][0-9]=[0-9]{1,2}$/.test(game.source))throw Error('Invalid micro-game instruction.');
    const [left,operation,right,answer]=game.source.slice(1).match(/^([0-9])([+*-])([0-9])=([0-9]{1,2})$/).slice(1);
    const question=left+' '+operation+' '+right+' = ?';
    return shell('<main style="background:#080c0b;color:#b9ef79;text-align:center;font:24px system-ui;min-height:100vh;padding:20px"><h2>MICRO MATH</h2><p>'+question+'</p><input id="a" inputmode="numeric" style="font-size:25px;width:90px"><button id="b" style="font-size:25px;margin:12px">Check</button><p id="r"></p></main><script>b.onclick=()=>r.textContent=a.value=='+Number(answer)+'?"WIN":"TRY AGAIN"</script>');
  }

  const prelude = `<style>html,body{margin:0;width:100%;height:100%;background:#0d1612;overflow:hidden}canvas{display:block;width:min(96vw,96vh);height:min(96vw,96vh);margin:auto;image-rendering:pixelated;touch-action:none}</style><canvas id="c" width="320" height="320"></canvas><script>
const c=document.getElementById('c'),g=c.getContext('2d');
const report=(type,value)=>parent.postMessage({scandeck:type,value},'*');
let d=1;
addEventListener('keydown',e=>{let v={ArrowUp:'U',ArrowDown:'D',ArrowLeft:'L',ArrowRight:'R',w:'U',a:'L',s:'D',d:'R'}[e.key];if(v){e.preventDefault();move(v)}});
addEventListener('message',e=>{if(typeof e.data==='string')move(e.data)});
function move(v){if(v==='U')d=-8;else if(v==='D')d=8;else if(v==='L')d=-1;else if(v==='R')d=1;if(typeof onDirection==='function')onDirection(v)}
let onDirection=null;
const gameAPI={canvas:c,ctx:g,score:(n)=>report('score',n),end:(message)=>report('end',message),onDirection:(fn)=>{onDirection=fn}};
`;
  if (game.kind === 'micro') return shell(prelude + game.source + '\n<\/script>');
  if (game.kind !== 'snake') throw new Error('Unknown game type.');
  const snakeHelpers = `
let started=false,ended=false,timer;
const A=s=>{let free=[];for(let j=0;j<64;j++)if(!s.includes(j))free.push(j);return free.length?free[Math.random()*free.length|0]:-1};
const O=()=>{ended=true;clearInterval(timer);report('end','Game over')};
const R=(body,food)=>{
 g.fillStyle='#0d1911';g.fillRect(0,0,320,320);
 g.strokeStyle='#203126';g.lineWidth=1;
 for(let j=0;j<=8;j++){let p=j*40+.5;g.beginPath();g.moveTo(p,0);g.lineTo(p,320);g.moveTo(0,p);g.lineTo(320,p);g.stroke()}
 if(food>=0){let x=food%8*40+20,y=(food>>3)*40+20;g.fillStyle='#fc807e';g.beginPath();g.arc(x,y,12,0,Math.PI*2);g.fill()}
 for(let i=body.length-1;i>=0;i--){let p=body[i],x=(p&7)*40,y=(p>>3)*40;g.fillStyle=i===0?'#d6ff8e':'#9fe367';g.fillRect(x+4,y+4,32,32);g.fillStyle=i===0?'#395626':'#79b44f';g.fillRect(x+8,y+8,24,24)}
 report('score',Math.max(0,body.length-3));
 if(food<0&&!ended){ended=true;clearInterval(timer);report('end','You win!')}
};
const oldMove=move;move=v=>{const next={U:-8,D:8,L:-1,R:1}[v];if(next&&next!==-d&&!ended){d=next;if(!started){started=true;report('started',true)}}};
`;
  const suffix = `R(s,f);timer=setInterval(()=>{if(started&&!ended)T()},I);`;
  return shell(prelude + snakeHelpers + game.source + '\n' + suffix + '</script>');
}
