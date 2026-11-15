import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {gameDocument} from '../src/runtime.js';

test('Tap Rush embeds a compact executable tap counter, with its duration supplied by ScanDeck',()=>{
 const source=readFileSync(new URL('../examples/tap-rush-code128.js',import.meta.url),'utf8').trim();
 assert.equal(source,'n=0;onclick=_=>n++');
 assert.equal(source.length,18);
 const context={};
 vm.runInNewContext(source,context,{timeout:500});
 for(let i=0;i<9;i++)context.onclick();
 assert.equal(context.n,9);
 const doc=gameDocument({kind:'standalone',title:'Tap Rush',source});
 assert.ok(doc.includes('window.onclick=e=>'));
 assert.ok(doc.includes('start===null'));
 assert.ok(doc.includes('setTimeout(()=>{if(!window.__sdRushDone)window.alert(Number(window.n)||0)},5000)'));
 assert.ok(doc.includes('window.__sdRushDone=true;window.onclick=0;'));
});
