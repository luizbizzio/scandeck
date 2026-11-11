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
