import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {packMicroVm,decodeGame} from '../protocol.js';
import {parseMicroProgram,executeMicroProgram,microVmHtml} from '../microvm.js';
import {gameDocument} from '../runtime.js';

const CODE='V1R4T3DIC+L5X';

test('Micro QR contains every game operation in 13 characters',async()=>{
  const source=readFileSync(new URL('../examples/reflex-microqr.txt',import.meta.url),'utf8').trim();
  assert.equal(source,CODE);
  assert.equal(source.length,13);
  assert.equal(packMicroVm(source),source);
  const game=await decodeGame(source);
  assert.equal(game.kind,'microvm');
  assert.equal(game.title,'Pocket Reflex');
  assert.equal(game.source,source);
  assert.deepEqual(parseMicroProgram(source).map(([op,n])=>op+(n||'')),
    ['R4','T3','D','I','C','+','L5','X']);
  const html=gameDocument(game);
  assert.match(html,/POCKET REFLEX/);
  assert.match(html,/FIND THIS NUMBER/);
  assert.match(html,/default-src 'none'/);
  assert.match(html,/executeMicroProgram/);
  assert.ok(!/^https?:/.test(source));
});

test('Micro VM runs five random rounds with a per-round three-second deadline and scoring',async()=>{
  const shown=[],seconds=[],out=[];
  let i=0;
  const input=[1,2,-1,3,4]; // correct, correct, timed out, wrong, correct
  const actual=await executeMicroProgram(parseMicroProgram(CODE),{
    random(max){assert.equal(max,4);return i++%4},
    display(state){shown.push({...state})},
    input(ms){seconds.push(ms);return input.shift()},
    finish(result){out.push(result)}
  });
  assert.equal(shown.length,5);
  assert.deepEqual(shown.map(x=>x.round),[1,2,3,4,5]);
  assert.deepEqual(shown.map(x=>x.target),[1,2,3,4,1]);
  assert.deepEqual(seconds,[3,3,3,3,3]);
  assert.equal(actual.score,2); // rounds one and two only
  assert.equal(actual.rounds,5);
  assert.deepEqual(out,[actual]);
});
test('Micro VM cannot silently substitute other programs or execute arbitrary JavaScript',()=>{
  for(const invalid of ['M36509','V1R4DT3IC+L5Xmore','V1R4T3DIC+L8','V1R4T3DIC+L5<script>','V1R4T3DIC+L5Q','V1R4T3DIC+L5']){
    assert.throws(()=>packMicroVm(invalid));
  }
  assert.match(microVmHtml(CODE),/pointer-events:none|TAP THE MATCHING NUMBER/);
});
