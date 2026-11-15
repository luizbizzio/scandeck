import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readBarcodes} from 'zxing-wasm';
import {PNG} from 'pngjs';
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
 assert.ok(found.some(hit=>hit.format==='DataBarExpStk'&&decodeCodebreakerDataBar(hit.text)?.payload===payload),
  'ZXing failed to recognize the published DataBar PNG and its GS1 bytecode');
});

test('front-facing DataBar on a simulated phone-camera frame is readable',async()=>{
 const png=PNG.sync.read(readFileSync(new URL('../assets/codebreaker-databar.png',import.meta.url)));
 const width=1100,height=720,rgba=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<rgba.length;i+=4){
  rgba[i]=20;rgba[i+1]=26;rgba[i+2]=23;rgba[i+3]=255;
 }
 const maxW=width*.82,maxH=height*.7;
 const scale=Math.min(maxW/png.width,maxH/png.height,1.5);
 const w=Math.max(1,Math.floor(png.width*scale));
 const h=Math.max(1,Math.floor(png.height*scale));
 const x0=Math.floor((width-w)/2),y0=Math.floor((height-h)/2);
 const pad=24;
 for(let y=Math.max(0,y0-pad);y<Math.min(height,y0+h+pad);y++)
  for(let x=Math.max(0,x0-pad);x<Math.min(width,x0+w+pad);x++){
   const p=(y*width+x)*4;rgba[p]=rgba[p+1]=rgba[p+2]=255;
  }
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const sx=Math.min(png.width-1,Math.floor((x+.5)*png.width/w));
  const sy=Math.min(png.height-1,Math.floor((y+.5)*png.height/h));
  const from=(sy*png.width+sx)*4,to=((y0+y)*width+x0+x)*4;
  rgba[to]=png.data[from];rgba[to+1]=png.data[from+1];
  rgba[to+2]=png.data[from+2];rgba[to+3]=255;
 }
 const found=await readBarcodes({width,height,data:rgba},{
  formats:['DataBarExpStk','DataBarExp'],tryHarder:true,tryRotate:true,
  tryDownscale:false,tryDenoise:false,maxNumberOfSymbols:1
 });
 assert.ok(found.some(hit=>decodeCodebreakerDataBar(hit.text)?.payload==='91SDCB7'),
  'ZXing could not read the DataBar on a centered camera-like image');
});
