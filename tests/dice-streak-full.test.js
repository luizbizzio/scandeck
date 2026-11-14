import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {packMicroHtml,decodeGame} from '../src/protocol.js';
import {gameDocument} from '../src/runtime.js';
const source=readFileSync(new URL('../examples/dice-streak-micropdf417.html',import.meta.url),'utf8').trim();

test('Dice Streak is executable self-contained HTML fitting a smaller MicroPDF417',async()=>{
 assert.equal(source.length,126);
 const payload=packMicroHtml(source);
 assert.equal(payload.length,130);
 const decoded=await decodeGame(payload);
 assert.equal(decoded.title,'Dice Streak');
 assert.equal(decoded.kind,'html');
 assert.equal(decoded.source,source);
 const document=gameDocument(decoded);
 assert.ok(document.includes(source));
 assert.ok(document.includes("connect-src 'none'"));
 assert.ok(!source.includes('http://')&&!source.includes('https://'));
 assert.ok(!source.includes('document.write'));
 assert.throws(()=>packMicroHtml(source+' '.repeat(30)+'<div>x</div>'),/150 encoded bytes/);
});

test('Dice Streak initialises score, accumulates dice rolls and resets on a one',()=>{
 const script=source.match(/<script>([^<]+)<\/script>/)?.[1];
 const onclick=source.match(/<button onclick="([^"]+)"/)?.[1];
 assert.ok(script&&onclick);
 const p={textContent:'0'},rolls=[.3,.7,0,.5];let index=0;
 const ctx={p,Math:{random:()=>rolls[index++]}};
 vm.runInNewContext(script,ctx,{timeout:500});
 assert.equal(ctx.s,0);
 vm.runInNewContext(onclick,ctx,{timeout:500});
 assert.equal(p.textContent,'SCORE 2');
 vm.runInNewContext(onclick,ctx,{timeout:500});
 assert.equal(p.textContent,'SCORE 7');
 vm.runInNewContext(onclick,ctx,{timeout:500});
 assert.equal(p.textContent,'BUST');
 assert.equal(ctx.s,0);
 vm.runInNewContext(onclick,ctx,{timeout:500});
 assert.equal(p.textContent,'SCORE 4');
});
