import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {packMicroVm,decodeGame} from '../src/protocol.js';
import {parseMicroProgram,executeMicroProgram,microVmHtml} from '../src/microvm.js';
import {gameDocument} from '../src/runtime.js';

const CODE='V1R4T3DIC+L0X';
test('Pocket Reflex holds an endless 13-byte Micro QR program',async()=>{
 const source=readFileSync(new URL('../examples/reflex-microqr.txt',import.meta.url),'utf8').trim();
 assert.equal(source,CODE);assert.equal(source.length,13);
 assert.equal(packMicroVm(source),source);
 const game=await decodeGame(source);
 assert.equal(game.kind,'microvm');assert.equal(game.title,'Pocket Reflex');
 assert.deepEqual(parseMicroProgram(source).map(([op,n])=>op+('RTL'.includes(op)?n:'')),['R4','T3','D','I','C','+','L0','X']);
 const html=gameDocument(game);
 assert.match(html,/POCKET REFLEX/);assert.match(html,/FIND THIS NUMBER/);
 assert.match(html,/default-src 'none'/);assert.match(html,/executeMicroProgram/);
 assert.match(html,/\[4,1,3,2\]/);
 assert.doesNotMatch(html,/ROUND 1 \/ 5/);
});
test('Each successful answer reduces the time limit, and the first miss ends the game',async()=>{
 const shown=[],seconds=[],finished=[],answers=[1,2,3,4,-1];let i=0;
 const result=await executeMicroProgram(parseMicroProgram(CODE),{
  random(max){assert.equal(max,4);return i++%4},
  display(state){shown.push({...state})},
  input(duration){seconds.push(duration);return answers.shift()},
  finish(summary){finished.push(summary)}
 });
 assert.equal(result.score,4);assert.equal(result.rounds,5);
 assert.deepEqual(shown.map(s=>s.round),[1,2,3,4,5]);
 assert.deepEqual(shown.map(s=>s.target),[1,2,3,4,1]);
 assert.equal(seconds[0],3);
 for(let j=1;j<seconds.length;j++)assert.ok(seconds[j]<seconds[j-1]);
 assert.deepEqual(finished,[result]);
});
test('Existing five-round codes still run unchanged',async()=>{
 let i=0;const shown=[];
 const result=await executeMicroProgram(parseMicroProgram('V1R4T3DIC+L5X'),{
  random:()=>i++%4,display:s=>shown.push(s.round),input:async()=>-1,finish:async()=>{}
 });
 assert.deepEqual(shown,[1,2,3,4,5]);assert.equal(result.score,0);
});
test('Micro VM rejects invalid and incomplete bytecode',()=>{
 for(const invalid of ['M36509','V1R4DT3IC+L0Xmore','V1R4T3DIC+L8','V1R4T3DIC+L0<script>','V1R4T3DIC+L0Q','V1R4T3DIC+L0'])assert.throws(()=>packMicroVm(invalid));
 assert.match(microVmHtml(CODE),/pointer-events:none|TAP THE MATCHING NUMBER/);
});
