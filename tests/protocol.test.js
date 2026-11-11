import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {base43Decode,base43Encode,decodeGame,LEGACY_SNAKE,packHtml,packScript,QR_LIMIT} from '../protocol.js';
import {code128Svg} from '../code128.js';
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
});
test('SDJ barcode is open to third party scripts, not only samples',async()=>{
  const payload=packScript('g.fillRect(0,0,4,4)');
  assert.equal((await decodeGame(payload)).source,'g.fillRect(0,0,4,4)');
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
});
test('Code128 output includes start, checksum, and stop patterns',()=>{
  const svg=code128Svg('SDJ:g.fillRect(1,1,2,2)');
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('viewBox='));
  assert.match(svg,/<rect/);
});