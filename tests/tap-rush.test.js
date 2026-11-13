import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('Tap Rush uses a shorter complete five-second program',()=>{
 const source=readFileSync(new URL('../examples/tap-rush-code128.js',import.meta.url),'utf8').trim();
 assert.ok(source.length<=59);
 let callback=null,score=null;
 const context={setTimeout(fn,delay){assert.equal(delay,5000);callback=fn},alert(value){score=value}};
 vm.runInNewContext(source,context,{timeout:500});
 for(let i=0;i<9;i++)context.onclick();
 assert.ok(callback,'The first tap must start the timer');
 callback();
 assert.equal(score,9);
 assert.equal(context.onclick,0,'Taps must stop after the result');
});
