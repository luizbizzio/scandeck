import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {readBarcodes} from 'zxing-wasm';
import {splitChromaPayload,joinChromaPayload,decodeChromaPixels} from '../src/chroma.js';

function pngPixels(filename){
  const bytes=readFileSync(new URL('../assets/'+filename,import.meta.url));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  let offset=8,width=0,height=0;
  const compressed=[];
  while(offset<bytes.length){
    const len=bytes.readUInt32BE(offset),tag=bytes.toString('ascii',offset+4,offset+8);
    const piece=bytes.subarray(offset+8,offset+8+len);
    offset+=len+12;
    if(tag==='IHDR'){
      width=piece.readUInt32BE(0);height=piece.readUInt32BE(4);
      assert.equal(piece[8],8);assert.equal(piece[9],2);
    }
    if(tag==='IDAT')compressed.push(piece);
    if(tag==='IEND')break;
  }
  assert.ok(width>0&&height>0);
  const scan=inflateSync(Buffer.concat(compressed)),stride=width*3;
  assert.equal(scan.length,(stride+1)*height);
  const data=new Uint8Array(width*height*3);
  for(let y=0;y<height;y++){
    assert.equal(scan[y*(stride+1)],0);
    data.set(scan.subarray(y*(stride+1)+1,(y+1)*(stride+1)),y*stride);
  }
  return {width,height,data};
}

test('ChromaQR splits and reassembles the full game with checksum',()=>{
  const original='SDS:document.body.textContent="A real game";onclick=()=>0';
  const channels=splitChromaPayload(original);
  assert.equal(channels.length,3);
  assert.equal(joinChromaPayload(channels),original);
  const damaged=[...channels];
  damaged[2]=damaged[2].slice(0,-1)+'x';
  assert.equal(joinChromaPayload(damaged),null);
});

test('Chroma Rush ChromaQR PNG independently decodes all three color channels',async()=>{
  const expected=readFileSync(new URL('../assets/chromaqr-chroma.txt',import.meta.url),'utf8');
  assert.ok(expected.startsWith('SD1:'));
  const actual=await decodeChromaPixels(pngPixels('chromaqr-chroma.png'),readBarcodes);
  assert.equal(actual,expected);
});

test('ChromaQR camera tries a fast pass before expensive QR recovery',()=>{
 const source=readFileSync(new URL('../src/chroma.js',import.meta.url),'utf8');
 assert.match(source,/tryHarder:pivot!==thresholds\[0\]/);
 const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
 assert.match(app,/mode==='chroma'\?6800/);
});

test('camera-style ChromaQR white card can be isolated from the dark page',async()=>{
 const {findLightCard,cropRgba}=await import('../src/specialty-candidates.js');
 const image=pngPixels('chromaqr-chroma.png');
 const width=image.width+220,height=image.height+220,data=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<data.length;i+=4){data[i]=17;data[i+1]=24;data[i+2]=22;data[i+3]=255}
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
  const from=(y*image.width+x)*3,to=((y+110)*width+(x+110))*4;
  data[to]=image.data[from];data[to+1]=image.data[from+1];data[to+2]=image.data[from+2];
 }
 const card=findLightCard({width,height,data});
 assert.ok(card,'The scanner needs to find the pale ChromaQR card on a dark page');
 const cropped=cropRgba({width,height,data},card);
 const expected=readFileSync(new URL('../assets/chromaqr-chroma.txt',import.meta.url),'utf8');
 assert.equal(await decodeChromaPixels(cropped,readBarcodes),expected);
});
