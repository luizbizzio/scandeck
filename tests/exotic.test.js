import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encodeCodablockF,encodeDotCode,toImageData,decode} from '@sythos/js_barcode_universal';
import {decodeGame} from '../protocol.js';

const games=[
  {asset:'snake-codablockf',format:'codablockf',encode:encodeCodablockF,source:'snake-standalone.js',kind:'standalone'},
  {asset:'neon-dodge-dotcode',format:'dotcode',encode:encodeDotCode,source:'neon-dodge-dotcode.html',kind:'html'},
];
for(const g of games){
  test(g.format+' PNG contains a complete standalone game, no external URL',async()=>{
    const payload=readFileSync(new URL('../assets/'+g.asset+'.txt',import.meta.url),'utf8');
    const source=readFileSync(new URL('../examples/'+g.source,import.meta.url),'utf8').trim();
    const game=await decodeGame(payload);
    assert.equal(game.kind,g.kind);
    assert.equal(game.source.trim(),source);
    assert.ok(!/^https?:\/\//.test(payload));
    const png=readFileSync(new URL('../assets/'+g.asset+'.png',import.meta.url));
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    const matrix=g.encode(payload);
    const raster=toImageData(matrix,{scale:g.format==='codablockf'?4:5,margin:g.format==='codablockf'?12:10});
    assert.ok(decode(raster,{formats:[g.format],profile:'camera'}).some(item=>item.text===payload));
  });
}
