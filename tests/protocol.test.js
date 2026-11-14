import test from 'node:test';
import vm from 'node:vm';
import {snakePayload} from '../tools/generate-snake.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {base43Decode,base43Encode,decodeGame,LEGACY_SNAKE,packHtml,packScript,packCompactHtml,packCompactScript,packMicroQuiz,QR_LIMIT} from '../src/protocol.js';
import {code128Svg,decodeCode128Svg} from '../src/code128.js';
import {gameDocument} from '../src/runtime.js';
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
  assert.equal(game.title,'Ironpass');
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
test('full independent Snake program is kept in a QR image rather than a giant Code 128',async()=>{
  const payload=readFileSync(new URL('../assets/snake-qr.txt',import.meta.url),'utf8');
  assert.equal(payload,snakePayload());
  const game=await decodeGame(payload);
  assert.equal(game.kind,'standalone');
  assert.equal(game.source,readFileSync(new URL('../examples/snake-standalone.js',import.meta.url),'utf8').trim());
  assert.ok(gameDocument(game).includes(game.source));
  const png=readFileSync(new URL('../assets/snake-qr.png',import.meta.url));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});
test('Code 128 contains the compact Tap Rush JavaScript tap counter',async()=>{
  const payload=readFileSync(new URL('../assets/taprush-code128.txt',import.meta.url),'utf8');
  const source=readFileSync(new URL('../examples/tap-rush-code128.js',import.meta.url),'utf8').trim();
  assert.equal(payload,'SDS:'+source);
  assert.equal(payload.length,22,'The encoded tap counter must remain compact');
  const game=await decodeGame(payload);
  assert.equal(game.kind,'standalone');
  assert.equal(game.source,source);
  assert.match(game.source,/onclick/);
  assert.doesNotMatch(game.source,/setTimeout/);
  assert.equal(game.source,'n=0;onclick=_=>n++');
  assert.match(gameDocument(game),/setTimeout/);
  const png=readFileSync(new URL('../assets/taprush-code128.png',import.meta.url));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});
test('Tap Rush counts every click and its runtime enforces five seconds',()=>{
  const source=readFileSync(new URL('../examples/tap-rush-code128.js',import.meta.url),'utf8').trim();
  const context={};
  vm.runInNewContext(source,context,{timeout:500});
  for(let click=1;click<=37;click++)context.onclick();
  assert.equal(context.n,37);
  assert.doesNotMatch(source,/setTimeout|alert/);
  const doc=gameDocument({kind:'standalone',title:'Tap Rush',source});
  assert.ok(doc.includes('setTimeout(()=>{if(!window.__sdRushDone)window.alert(Number(window.n)||0)},5000)'));
  assert.ok(doc.includes('window.__sdRushDone=true;window.onclick=0;'));
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

test('both RGB color formats store complete embedded game payloads as PNG',async()=>{
  for(const name of ['iris-wire','chromaqr-chroma']){
    const raw=readFileSync(new URL('../assets/'+name+'.txt',import.meta.url),'utf8');
    const result=await decodeGame(raw);
    assert.ok(result.source.length>40);
    const png=readFileSync(new URL('../assets/'+name+'.png',import.meta.url));
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.ok(!/^https?:\/\//.test(raw));
    assert.ok(['SD1:','SDS:','SDB:'].some(prefix=>raw.startsWith(prefix)));
  }
});

test('Micro QR controls randomly generated, solvable 6x6 mazes',async()=>{
 const {generateMaze}=await import('../src/maze.js');
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

test('compressed full HTML and standalone JavaScript preserve source bytes and reject invalid frames',async()=>{
  const html='<!doctype html><canvas id=c></canvas><script>c.width=100;onclick=()=>c.width++</script>';
  const script="document.body.textContent='Snake';onkeydown=e=>document.title=e.key";
  const denseHtml=await packCompactHtml(html),denseScript=await packCompactScript(script);
  assert.match(denseHtml,/^SDH:[A-Za-z0-9+/=]+$/);
  assert.match(denseScript,/^SDZ:~[0-3][0-9A-Za-z!#$%&()*+\-;<=>?@^_`{|}~.\/:[\]\\]+$/);
  const [a,b]=await Promise.all([decodeGame(denseHtml),decodeGame(denseScript)]);
  assert.equal(a.kind,'html');assert.equal(a.source,html);assert.equal(a.payload,denseHtml);
  assert.equal(b.kind,'standalone');assert.equal(b.source,script);assert.equal(b.payload,denseScript);
  await assert.rejects(()=>decodeGame('SDH:NOT-VALID'),/Invalid compressed game encoding/);
  await assert.rejects(()=>decodeGame('SDZ:AAAA'),/Invalid|decompress|format|stream|deflate|TypeError|unexpected end/i);
});

test('SDY alphanumeric compressed JavaScript remains a full standalone game',async()=>{
 const source=readFileSync(new URL('../examples/math-rmqr.js',import.meta.url),'utf8').trim();
 const {deflateRawSync}=await import('node:zlib');
 const {base43Encode}=await import('../src/protocol.js');
 const payload='SDY:'+base43Encode(deflateRawSync(Buffer.from(source)));
 const game=await decodeGame(payload);
 assert.equal(game.kind,'standalone');
 assert.equal(game.source,source);
 assert.equal(game.payload,payload);
 assert.match(payload,/^[A-Z0-9$*+\-./:]+$/);
});

test('Z85 game transport round-trips bytes and both source types',async()=>{
  const {base85Encode,base85Decode,packDenseHtml,packDenseScript}=await import('../src/protocol.js');
  for(const n of [0,1,2,3,4,5,13,257,1024]){
    const bytes=Uint8Array.from({length:n},(_,i)=>(i*73+19)%256);
    assert.deepEqual(base85Decode(base85Encode(bytes)),bytes);
  }
  const html='<body><canvas id=c></canvas><script>onload=()=>c.width++</script>';
  const js="document.body.textContent='OK';onclick=()=>alert(1)";
  const compressedHtml=await packDenseHtml(html),compressedJs=await packDenseScript(js);
  const h=await decodeGame(compressedHtml),s=await decodeGame(compressedJs);
  assert.equal(h.source,html);assert.equal(h.kind,'html');
  assert.equal(s.source,js);assert.equal(s.kind,'standalone');
  for(const bad of ['SDB:0abcde!','SDC:4abcde','SDB:0zzzzz'])
    await assert.rejects(()=>decodeGame(bad),/Invalid|TypeError|decompress/i);
});

test('DotCode accepts new Z85 payloads and legacy Base64 symbols',async()=>{
 const src=readFileSync(new URL('../examples/neon-dodge-dotcode.js',import.meta.url),'utf8').trim();
 const newCode=await packCompactScript(src);
 assert.ok(newCode.startsWith('SDZ:~'));
 assert.equal((await decodeGame(newCode)).source,src);
 const legacy='SDZ:'+Buffer.from((await import('node:zlib')).deflateRawSync(Buffer.from(src))).toString('base64');
 assert.equal((await decodeGame(legacy)).source,src);
});

test('older DotCode and rMQR programs still use their original game markup',async()=>{
 const {gameDocument}=await import('../src/runtime.js');
 const oldDot='g=c.getContext("2d");requestAnimationFrame(()=>0)';
 const newDot='p=s=z=0;y=-32;v=0;a=4;c.onclick=()=>p^=1;tick=d=>{}';
 const legacy=gameDocument({kind:'standalone',title:'Neon Dodge',source:oldDot});
 const modern=gameDocument({kind:'standalone',title:'Neon Dodge',source:newDot});
 assert.ok(legacy.includes(oldDot));
 assert.ok(!legacy.includes('tick(d)'),'Old DotCode supplies its own animation loop');
 assert.ok(modern.includes('tick(d)'),'New DotCode uses shared rendering');
 const oldRMQR=gameDocument({kind:'standalone',title:'Codebreaker',source:"document.write('<input id=a><button id=b>GO');n=2"});
 assert.equal((oldRMQR.match(/<input id=a>/g)||[]).length,1,'Legacy rMQR must not duplicate input');
 const newer=gameDocument({kind:'standalone',title:'Codebreaker',source:'n=2;b.onclick=()=>0'});
 assert.ok(newer.includes('<input id=a><button id=b>GO</button>'));
});

test('Ironpass preserves its tower-defense mechanics without opening filler text',async()=>{
 const html=readFileSync(new URL('../examples/ironpass-micro-v3.html',import.meta.url),'utf8').trim();
 const {compactGameHtml}=await import('../tools/optimize-encoding.mjs');
 const compacted=await compactGameHtml(html);
 const payload=readFileSync(new URL('../assets/ironpass-micro-v3.txt',import.meta.url),'utf8').trim();
 const game=await decodeGame(payload);
 assert.equal(game.source,compacted);
 assert.equal(game.title,'Ironpass');
 assert.ok(!html.includes('TAP TO PLAY')&&!html.includes('IRONPASS MICRO'));
 for(const rule of ['function map()','function hit(t,e)','function step(dt)','function draw()','c.onpointerdown','requestAnimationFrame(frame)'])
  assert.ok(html.includes(rule),'Game mechanic missing: '+rule);
 assert.ok(html.includes("'IRONPASS'"));
 assert.ok(compacted.length<=html.length,'Script minification must not add source bytes');
});
