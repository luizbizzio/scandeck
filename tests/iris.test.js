import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {encodeColor,renderColorRaster,decodeColor} from '../vendor/iris/color.js';
import {decodeColorMarkers} from '../vendor/iris/markers.js';

function readRgbPng(name){
  const file=readFileSync(new URL('../assets/'+name+'.png',import.meta.url));
  assert.equal(file.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  let pos=8,width=0,height=0;
  const compressed=[];
  while(pos<file.length){
    const len=file.readUInt32BE(pos),kind=file.toString('ascii',pos+4,pos+8);
    const chunk=file.subarray(pos+8,pos+8+len);pos+=12+len;
    if(kind==='IHDR'){width=chunk.readUInt32BE(0);height=chunk.readUInt32BE(4);assert.equal(chunk[8],8);assert.equal(chunk[9],2)}
    if(kind==='IDAT')compressed.push(chunk);
    if(kind==='IEND')break;
  }
  assert.ok(width>0&&height>0&&width*height<20_000_000);
  const data=inflateSync(Buffer.concat(compressed));
  const rowSize=width*3,rgb=new Uint8Array(width*height*3);
  assert.equal(data.length,(rowSize+1)*height);
  for(let y=0;y<height;y++){
    assert.equal(data[y*(rowSize+1)],0,'PNG rows must be unfiltered');
    rgb.set(data.subarray(y*(rowSize+1)+1,(y+1)*(rowSize+1)),y*rowSize);
  }
  return {width,height,data:rgb};
}

test('IRIS clean RGB markers can be decoded independently',()=>{
  const text='SDS:document.body.textContent="IRIS"';
  const sym=encodeColor(text,{markers:true});
  assert.equal(decodeColor(renderColorRaster(sym)).text,text);
  const viaMarkers=decodeColorMarkers(renderColorRaster(sym));
  assert.equal(viaMarkers?.text,text);
});
for(const name of ['iris-chroma','iris-wire']){
  test(name+' contains an entire independently decodable game in its PNG pixels',()=>{
    const expected=readFileSync(new URL('../assets/'+name+'.txt',import.meta.url),'utf8');
    const png=readRgbPng(name);
    assert.equal(decodeColor(png).text,expected);
    assert.ok(expected.startsWith('SD1:')||expected.startsWith('SDS:'));
  });
}
