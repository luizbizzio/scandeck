import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readBarcodes} from 'zxing-wasm';
import {decodeCodebreakerDataBar,packCodebreakerDataBar} from '../src/databar.js';
import {decodeGame} from '../src/protocol.js';
import {gameDocument} from '../src/runtime.js';

test('GS1 AI 91 Codebreaker data is compact and has strict validation',()=>{
 assert.equal(packCodebreakerDataBar('SDCB7'),'91SDCB7');
 assert.equal(packCodebreakerDataBar('(91)SDCB7'),'91SDCB7');
 for(const input of ['91SDCB7','(91)SDCB7','[91]SDCB7',']e091SDCB7'])
  assert.deepEqual(decodeCodebreakerDataBar(input),{payload:'91SDCB7',source:'SDCB7',tries:7});
 for(const invalid of ['','91SDCB0','91SDCB10','(01)12345','91CODEBREAKER','https://example.com'])
  assert.equal(decodeCodebreakerDataBar(invalid),null);
});

test('GS1 DataBar Codebreaker keeps the random number, guesses and UP/DOWN',async()=>{
 const game=await decodeGame('91SDCB7');
 assert.equal(game.kind,'codebreaker');
 assert.equal(game.title,'Codebreaker');
 assert.equal(game.source,'SDCB7');
 const doc=gameDocument(game);
 assert.match(doc,/n=new Date%99;t=7;/);
 assert.match(doc,/\?'WIN':--t\?t\+/);
 assert.match(doc,/UP/);
 assert.match(doc,/DOWN/);
 assert.match(doc,/THE CODE WAS/);
 assert.match(doc,/t\+' GUESSES LEFT/);
});

test('published GS1 DataBar PNG decodes its real pixels with ZXing',async()=>{
 const payload=readFileSync(new URL('../assets/codebreaker-databar.txt',import.meta.url),'utf8').trim();
 const png=readFileSync(new URL('../assets/codebreaker-databar.png',import.meta.url));
 assert.equal(payload,'91SDCB7');
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 const found=await readBarcodes(new Blob([png],{type:'image/png'}),{
  formats:['DataBarExpStk','DataBarExp'],tryHarder:true,tryRotate:true,
  tryDownscale:false,maxNumberOfSymbols:1
 });
 assert.ok(found.some(hit=>decodeCodebreakerDataBar(hit.text)?.payload===payload),
  'ZXing failed to recognize the published DataBar PNG and its GS1 bytecode');
});
