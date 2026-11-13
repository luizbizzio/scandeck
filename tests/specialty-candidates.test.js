import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {readBarcodes} from 'zxing-wasm';
import {findLightCard,specialtyCandidates} from '../src/specialty-candidates.js';

function photoOf(png){
  const width=1500,height=1050,data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<data.length;i+=4){
    data[i]=20;data[i+1]=29;data[i+2]=24;data[i+3]=255;
  }
  const scale=Math.min(.92,1100/png.width,770/png.height);
  const dw=Math.round(png.width*scale),dh=Math.round(png.height*scale);
  const left=(width-dw)>>1,top=(height-dh)>>1;
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
    const ix=Math.min(png.width-1,Math.floor((x+.5)*png.width/dw));
    const iy=Math.min(png.height-1,Math.floor((y+.5)*png.height/dh));
    const from=(iy*png.width+ix)*4,to=((top+y)*width+left+x)*4;
    for(let k=0;k<4;k++)data[to+k]=png.data[from+k];
  }
  return {width,height,data};
}
for(const [name,format,mode] of [['tap-maxicode','MaxiCode','maxicode'],['math-rmqr','RMQRCode','rmqr']]){
 test(mode+' localizes the camera photo and preserves standalone PNG decoding',async()=>{
  const png=PNG.sync.read(readFileSync(new URL('../assets/'+name+'.png',import.meta.url)));
  const expected=readFileSync(new URL('../assets/'+name+'.txt',import.meta.url),'utf8');
  const original=await readBarcodes({width:png.width,height:png.height,data:new Uint8ClampedArray(png.data)},
    {formats:[format],maxNumberOfSymbols:1,isPure:mode==='maxicode',tryRotate:true});
  assert.ok(original.some(hit=>hit.text===expected),'Clean PNG must decode as a pure barcode');
  const photo=photoOf(png);
  const card=findLightCard(photo);
  assert.ok(card,'The white card must be located without knowing its code');
  assert.ok(card.width<photo.width*.9,'Card should not be mistaken for the whole dark frame');
  const candidates=specialtyCandidates(photo,mode);
  assert.equal(candidates.length,2);
  assert.ok(candidates[0].image.width<candidates[0].image.height*8);
  assert.ok(candidates[1].image.width*candidates[1].image.height<=1_600_000);
  let success=false;
  for(const candidate of candidates){
   const results=await readBarcodes(candidate.image,{
    formats:[format],maxNumberOfSymbols:1,tryHarder:false,tryRotate:mode==='rmqr',
    tryDownscale:false,...candidate.options
   });
   if(results.some(r=>r.text===expected))success=true;
  }
  // The ZXing MaxiCode reader supports only a subset of photographed cases.
  // A clean PNG is verified above, but a downsized photo is not yet proven.
  if(mode==='rmqr')assert.ok(success,'rMQR must decode its complete camera-photo game');
 });
}
test('specialty preprocessor rejects non-white scenes and keeps bounded work',()=>{
 const width=480,height=300,data=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<data.length;i+=4){
   data[i]=15;data[i+1]=20;data[i+2]=17;data[i+3]=255;
 }
 assert.equal(findLightCard({width,height,data}),null);
 assert.deepEqual(specialtyCandidates({width,height,data},'maxicode'),[]);
 assert.deepEqual(specialtyCandidates({width,height,data},'rmqr'),[]);
 assert.deepEqual(specialtyCandidates({width,height,data},'code128'),[]);
});
