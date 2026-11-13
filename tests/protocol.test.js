import test from 'node:test';
import vm from 'node:vm';
import {snakePayload,snakeSvg} from '../tools/generate-snake.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {base43Decode,base43Encode,decodeGame,LEGACY_SNAKE,packHtml,packScript,packMicroQuiz,QR_LIMIT} from '../protocol.js';
import {code128Svg,decodeCode128Svg} from '../code128.js';
import {gameDocument} from '../runtime.js';
test('base43 binary round trips',()=>{
  for(const n of [0,1,2,3,43,100,255,512,2779]){
    const bytes=Uint8Array.from({length:n},(_,i)=>(i*91+13)%256);
    assert.deepEqual(base43Decode(base43Encode(bytes)),bytes);
  }
});
test('legacy Snake is recognized but unknown JS is rejected', async()=>{
  const game=await decodeGame(LEGACY_SNAKE);
  assert.equal(game.kind,'snake');
  assert.equal(game.size,126);
  await assert.rejects(()=>decodeGame('alert(1)'),/compatible ScanDeck game/);
});
test('original Ironpass V3 decodes into the real game', async()=>{
  const payload=readFileSync(new URL('../assets/ironpass-micro-v3.txt',import.meta.url),'utf8');
  assert.ok(payload.length<=QR_LIMIT);
  const game=await decodeGame(payload);
  assert.equal(game.title,'Ironpass Micro');
  assert.equal(game.kind,'html');
  assert.ok(game.source.includes('IRONPASS'));
  assert.ok(game.source.includes('requestAnimationFrame'));
});
test('SD1 QR format creates and restores an HTML game',async()=>{
  const html='<canvas id="c"></canvas><script>console.log("OK")</script>';
  const payload=await packHtml(html);
  const game=await decodeGame(payload);
  assert.equal(game.kind,'html');
  assert.equal(game.source,html);
  assert.equal(game.title,'Custom game');
});
test('SDJ barcode is open to third party scripts, not only samples',async()=>{
  const payload=packScript("document.body.textContent='OK'");
  assert.equal((await decodeGame(payload)).kind,'standalone');
  assert.equal((await decodeGame(payload)).source,"document.body.textContent='OK'");
  assert.throws(()=>packScript('bad\nnew line'),/single line/);
});
test('sandbox policy is included in every runtime and scripts close',async()=>{
  const snake=await decodeGame(LEGACY_SNAKE);
  const doc=gameDocument(snake);
  assert.ok(doc.includes("connect-src 'none'"));
  assert.ok(doc.endsWith('</body></html>'));
  assert.ok(doc.includes('</script>'));
  const micro=await decodeGame('SDJ:g.fillRect(1,1,2,2)');
  const doc2=gameDocument(micro);
  assert.ok(doc2.includes('</script>'));
  assert.ok(doc2.includes('gameAPI'));
  const standalone=await decodeGame(packScript("document.body.textContent='OK'"));
  const doc3=gameDocument(standalone);
  assert.ok(doc3.includes("document.body.textContent='OK'"));
  assert.doesNotMatch(doc3, /gameAPI|snakeHelpers|const c=document/);
});
test('Code128 output includes start, checksum, and stop patterns',()=>{
  const svg=code128Svg('SDJ:g.fillRect(1,1,2,2)');
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('viewBox='));
  assert.match(svg,/<rect/);
});
test('the SVG encodes the entire independent Snake program',async()=>{
  const file=readFileSync(new URL('../assets/snake-code128.svg',import.meta.url),'utf8');
  assert.equal(file,snakeSvg());
  const game=await decodeGame(snakePayload());
  assert.equal(game.kind,'standalone');
  assert.equal(game.source,readFileSync(new URL('../examples/snake-standalone.js',import.meta.url),'utf8').trim());
  assert.doesNotMatch(file,/<metadata/);
  assert.equal(decodeCode128Svg(file),snakePayload());
  assert.ok(gameDocument(game).includes(game.source));
});
test('Snake runs alone with keyboard and mobile swipe controls',()=>{
  const source=readFileSync(new URL('../examples/snake-standalone.js',import.meta.url),'utf8');
  const body={textContent:'',style:''};
  const context={document:{body},setInterval:(fn,delay)=>{context.tick=fn;context.delay=delay}};
  vm.runInNewContext(source,context,{timeout:500});
  assert.equal(context.delay,250,'The interval moves the Snake; it is not a visible timer');
  assert.match(body.style,/background:#000;color:#afa/);
  assert.match(body.style,/white-space:pre/);
  assert.equal(context.b,body);
  assert.match(context.document.body.style,/touch-action:none/);
  assert.doesNotMatch(source,/<button/);
  assert.doesNotMatch(source,/gameAPI/);
  assert.equal(context.s.length,3);
  context.onkeydown({key:'ArrowDown'});
  context.tick();
  assert.equal(context.s[0],35);
  assert.match(body.textContent,/^0\n/);
  context.onmessage({data:'U'});
  context.tick();
  assert.equal(context.s[0],43,'Reverse direction is blocked');
  context.onpointerdown({x:20,y:30});
  context.onpointerup({x:80,y:30});
  context.tick();
  assert.equal(context.s[0],44,'Swipe right turns the Snake');
  context.onpointerdown({x:20,y:30});
  context.onpointerup({x:21,y:31});
  assert.equal(context.d,1,'Tiny touches do not change direction');
  context.s=[27,26,25];context.f=28;context.d=1;
  context.tick();
  assert.equal(context.s.length,4,'Eating food grows the Snake');
  assert.ok(!context.s.includes(context.f));
  context.s=[27,28,29];context.f=45;context.d=1;
  context.tick();
  assert.equal(context.d,0);
  assert.equal(body.textContent,'LOSE');
  context.tick();
  assert.equal(body.textContent,'LOSE','Game over persists');
  context.onpointerdown({x:20,y:80});
  context.onpointerup({x:20,y:20});
  context.tick();
  assert.equal(context.s[0],19,'Swipe up restarts after loss');
  context.s=[27,...Array.from({length:64},(_,i)=>i).filter(i=>i!==27&&i!==28)];
  context.f=28;context.d=1;
  context.tick();
  assert.equal(context.s.length,64);
  assert.equal(context.d,0);
  assert.equal(body.textContent,'WIN');
  context.tick();
  assert.equal(body.textContent,'WIN','Win state persists');
});

test('untrusted legacy scripts cannot terminate the sandbox script tag',async()=>{
  await assert.rejects(()=>decodeGame("SDJ:1;</script><script>parent.alert(1)</script>"),/Invalid microgame characters/);
});
test('generated matrix games contain complete HTML, not links',async()=>{
  for(const [stem,title] of [['catch-datamatrix','CATCH 10'],['memory-aztec','PATTERN MEMORY']]){
    const raw=readFileSync(new URL('../assets/'+stem+'.txt',import.meta.url),'utf8');
    const game=await decodeGame(raw);
    assert.equal(game.kind,'html');
    assert.equal(game.title,title);
    assert.ok(game.source.includes('<script>') && game.source.includes('</script>'));
    assert.doesNotMatch(game.source, /<script[^>]+src=|fetch\(|https?:\/\//);
    assert.ok(raw.length<1400);
    const svg=readFileSync(new URL('../assets/'+stem+'.svg',import.meta.url),'utf8');
    assert.match(svg,/<svg\b/);
    const png=readFileSync(new URL('../assets/'+stem+'.png',import.meta.url));
    assert.ok(png.length>100);
    assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  }
});

test('Micro QR carries a complete arithmetic instruction in at most 15 bytes',async()=>{
  const payload=packMicroQuiz('Q2+2=4');
  assert.equal(payload,'MQ:Q2+2=4');
  assert.ok(payload.length<=15);
  const game=await decodeGame(payload);
  assert.equal(game.kind,'bytecode');
  assert.equal(game.source,'Q2+2=4');
  assert.ok(gameDocument(game).includes('WIN'));
  assert.throws(()=>packMicroQuiz('Q100+400=500'),/Micro QR/);
});

test('both RGB color formats store complete embedded game payloads',async()=>{
  for(const name of ['iris-chroma','chromaqr-wire']){
    const raw=readFileSync(new URL('../assets/'+name+'.txt',import.meta.url),'utf8');
    const result=await decodeGame(raw);
    assert.ok(result.source.length>40);
    assert.match(readFileSync(new URL('../assets/'+name+'.svg',import.meta.url),'utf8'),/<svg/);
    assert.ok(!/^https?:\/\//.test(raw));
    assert.ok(raw.startsWith('SD1:')||raw.startsWith('SDS:'));
  }
});

test('Micro QR controls randomly generated, solvable 6x6 mazes',async()=>{
 const {generateMaze}=await import('../maze.js');
 const raw=packMicroQuiz('M36509');
 assert.equal(raw,'MQ:M36509');
 const game=await decodeGame(raw);
 assert.equal(game.kind,'maze');
 assert.equal(game.source,'M36509');
 const first=generateMaze(0x3650,1,123),second=generateMaze(0x3650,2,321);
 assert.equal(first.walls.length,36);assert.equal(second.walls.length,36);
 assert.notDeepEqual(first.walls,second.walls,'Different seeds must create new patterns');
 for(const maze of [first,second]){
   assert.ok(maze.shortest>0);
   assert.ok(maze.limit>=maze.shortest,'Every maze must be solvable within the move limit');
   const visited=new Set([0]),queue=[0];
   for(const p of queue)for(const [diff,bit] of [[-6,1],[1,2],[6,4],[-1,8]]){
     if(maze.walls[p]&bit)continue;
     const next=p+diff;
     if(!visited.has(next)){visited.add(next);queue.push(next)}
   }
   assert.equal(visited.size,36,'The maze generator must connect every cell');
 }
 assert.match(gameDocument(game),/POCKET MAZE/);
 assert.match(gameDocument(game),/NEW MAZE/);
 assert.throws(()=>packMicroQuiz('MFFFF9'),/entrance and exit/);
});
