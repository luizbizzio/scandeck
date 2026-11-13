import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {BitMatrix,encodeCodablockF,encodeDotCode,decodeCodablockF,decodeDotCode} from '@sythos/js_barcode_universal';
import {decodeGame} from '../src/protocol.js';
import {PNG} from 'pngjs';

// Read the actual 1-bit indexed PNG bytes and reconstruct the exact modules.
// This verifies the downloaded artwork itself, not an in-memory source string.
function pngGrid(asset,scale,margin){
  const bytes=readFileSync(new URL('../assets/'+asset+'.png',import.meta.url));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  let pos=8,width=0,height=0;
  const compressed=[];
  while(pos<bytes.length){
    const len=bytes.readUInt32BE(pos),tag=bytes.toString('ascii',pos+4,pos+8);
    const part=bytes.subarray(pos+8,pos+8+len);
    if(tag==='IHDR'){
      width=part.readUInt32BE(0);height=part.readUInt32BE(4);
      assert.equal(part[8],1,'PNG must contain one bit per pixel');
      assert.equal(part[9],3,'PNG must use its two-color palette');
    }
    if(tag==='IDAT')compressed.push(part);
    pos+=12+len;
    if(tag==='IEND')break;
  }
  assert.ok(width>0&&height>0&&width%scale===0&&height%scale===0);
  const rowBytes=(width+7)>>3;
  const raw=inflateSync(Buffer.concat(compressed));
  assert.equal(raw.length,(rowBytes+1)*height);
  const matrix=new BitMatrix(width/scale-2*margin,height/scale-2*margin);
  for(let y=0;y<matrix.height;y++)for(let x=0;x<matrix.width;x++){
    const py=(y+margin)*scale+(scale>>1),px=(x+margin)*scale+(scale>>1);
    const line=py*(rowBytes+1);
    assert.equal(raw[line],0,'PNG scanline filter must be none');
    if(raw[line+1+(px>>3)]&(0x80>>(px&7)))matrix.set(x,y);
  }
  return matrix;
}

const games=[
  {asset:'snake-codablockf',format:'codablockf',encode:encodeCodablockF,source:'snake-standalone.js',kind:'standalone'},
  {asset:'neon-dodge-dotcode',format:'dotcode',encode:encodeDotCode,source:'neon-dodge-dotcode.html',kind:'html'},
];
for(const g of games){
  test(g.format+' PNG and strict matrix carry a complete standalone game, no external URL',async()=>{
    const payload=readFileSync(new URL('../assets/'+g.asset+'.txt',import.meta.url),'utf8');
    const source=readFileSync(new URL('../examples/'+g.source,import.meta.url),'utf8').trim();
    assert.ok(payload.length<(g.format==='codablockf'?615:685),'Optimized code should be smaller than previous build');
    const game=await decodeGame(payload);
    assert.equal(game.kind,g.kind);
    assert.equal(game.source.trim(),source);
    assert.ok(!/^https?:\/\//.test(payload));
    const png=readFileSync(new URL('../assets/'+g.asset+'.png',import.meta.url));
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    if(g.format==='codablockf'){
      const matrix=pngGrid(g.asset,4,12);
      assert.equal(decodeCodablockF(matrix)?.text,payload);
    }else{
      const grid=pngGrid(g.asset,5,10);
      assert.equal(decodeDotCode(grid)?.text,payload,'Exact DotCode PNG must decode in the deployed reader');
      const decoded=PNG.sync.read(png);
      assert.ok(decoded.width*decoded.height<1_000_000,'The DotCode PNG should fit a normal camera frame');
    }
  });
}
