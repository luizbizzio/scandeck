import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import {bestDeflateRaw,compactGameHtml} from './optimize-encoding.mjs';
import { writeBarcode, readBarcodes } from 'zxing-wasm';
import { base43Encode, packScript, packEanLevel, packMicroHtml, decodeGame } from '../src/protocol.js';

const root=new URL('../',import.meta.url);
const asset=(name)=>new URL('assets/'+name,root);
mkdirSync(new URL('assets/',root),{recursive:true});
mkdirSync(new URL('vendor/zxing-wasm/',root),{recursive:true});

const matrixGames=[
  {input:'examples/dice-streak-micropdf417.html',output:'dice-streak-micropdf417',format:'MicroPDF417',kind:'microhtml',max:150},
  {input:'examples/breakout-pdf417.html',output:'breakout-pdf417',format:'PDF417',kind:'html',max:1700},
  {input:'examples/perfect-timing-ean13.txt',output:'timing-ean13',format:'EAN13',kind:'ean',max:13},
  {input:'examples/reflex-microqr.txt',output:'reflex-microqr',format:'MicroQRCode',kind:'tiny',max:15},
  {input:'examples/math-rmqr.js',output:'math-rmqr',format:'RMQRCode',kind:'script',max:120},
  {input:'examples/catch-datamatrix.html',output:'catch-datamatrix',format:'DataMatrix'},
  {input:'examples/memory-aztec.html',output:'memory-aztec',format:'Aztec'}
];

for (const game of matrixGames) {
  const originalSource=readFileSync(new URL(game.input,root),'utf8').trim();
  const source=game.kind==='html'?await compactGameHtml(originalSource):originalSource;
  const payload=game.kind==='script'?packScript(source):game.kind==='microhtml'?packMicroHtml(source):game.kind==='ean'?packEanLevel(source):game.kind==='tiny'?source:
    'SD1:'+base43Encode(bestDeflateRaw(source));
  const max=game.max??1400;
  if (payload.length>max) throw new Error(game.format+' game is too large ('+payload.length+' > '+max+').');
  const opts={format:game.format,scale:game.format==='PDF417'||game.format==='MicroPDF417'?10:game.format==='RMQRCode'?12:game.format==='EAN13'?12:8};
  let result=await writeBarcode(payload,opts);
  let selectedPayload=payload;
  if(game.format==='RMQRCode'){
    // Prefer a smaller symbol without losing the original JavaScript.
    const packed='SDY:'+base43Encode(bestDeflateRaw(source));
    try{
      const other=await writeBarcode(packed,opts);
      if(other.image&&other.svg){
        const match=(await readBarcodes(other.image,{formats:['RMQRCode'],tryHarder:true,maxNumberOfSymbols:1})).some(x=>x.text===packed);
        const oldPng=Buffer.from(await result.image.arrayBuffer());
        const newPng=Buffer.from(await other.image.arrayBuffer());
        const oldArea=oldPng.readUInt32BE(16)*oldPng.readUInt32BE(20);
        const newArea=newPng.readUInt32BE(16)*newPng.readUInt32BE(20);
        if(match&&newArea<oldArea){selectedPayload=packed;result=other}
      }
    }catch(error){console.log('rMQR compressed option unavailable: '+error.message)}
    // Prefer a shape that is not excessively flat. All variants must
    // independently decode before being eligible for publication.
    const basePng=Buffer.from(await result.image.arrayBuffer());
    const baseArea=basePng.readUInt32BE(16)*basePng.readUInt32BE(20);
    let bestScore=Infinity,bestResult=result,bestVersion='auto';
    for(const version of [null,30,31,32,26,27,21,22]){
      try{
        const candidate=version===null?result:await writeBarcode(selectedPayload,{...opts,options:'version='+version});
        if(!candidate?.image)continue;
        const png=Buffer.from(await candidate.image.arrayBuffer());
        const w=png.readUInt32BE(16),h=png.readUInt32BE(20),area=w*h;
        if(area>baseArea*1.13)continue;
        const hits=await readBarcodes(candidate.image,{formats:['RMQRCode'],tryHarder:true,maxNumberOfSymbols:1});
        if(!hits.some(x=>x.text===selectedPayload))continue;
        const ratio=Math.max(w,h)/Math.min(w,h);
        const score=area*(1+Math.max(0,ratio-5.5)*.1);
        if(score<bestScore){bestScore=score;bestResult=candidate;bestVersion=version??'auto'}
      }catch{}
    }
    result=bestResult;
    console.log('rMQR chosen version '+bestVersion+' / '+result.symbol.width+'×'+result.symbol.height+' modules');
  }
  if (!result.svg||!result.image) throw new Error(game.format+' did not produce SVG and PNG: '+JSON.stringify({error:result.error,keys:Object.keys(result)}));
  // The barcode must be decoded from its actual pixels, not from copied payload metadata.
  const found=await readBarcodes(result.image,{formats:[game.format],tryHarder:true,maxNumberOfSymbols:1});
  if(!found.some(x=>x.text===selectedPayload))throw new Error(game.format+' failed its pixel round-trip');
  writeFileSync(asset(game.output+'.png'),Buffer.from(await result.image.arrayBuffer()));
  writeFileSync(asset(game.output+'.txt'),selectedPayload);
  console.log(game.format+' | '+source.length+' source characters | '+selectedPayload.length+' code characters | barcode verified');
}


// Generate Ironpass from its complete HTML on every build. The writer selects
// the smallest QR version fitting the whole program, rather than forcing v40.
const ironpassOriginal=readFileSync(new URL('examples/ironpass-micro-v3.html',root),'utf8').trim();
const ironpassSource=await compactGameHtml(ironpassOriginal);
const ironpassPayload='IP3:'+base43Encode(bestDeflateRaw(ironpassSource));
if(ironpassPayload.length>4296)throw Error('Ironpass exceeds QR-L capacity');
if((await decodeGame(ironpassPayload)).source!==ironpassSource)throw Error('Ironpass lost game content');
const ironpassQR=await writeBarcode(ironpassPayload,{format:'QRCode',scale:7,options:'ecLevel=1'});
if(!ironpassQR.image)throw Error('Ironpass QR generation failed: '+JSON.stringify(ironpassQR.error));
const ironpassResults=await readBarcodes(ironpassQR.image,{formats:['QRCode'],tryHarder:true});
if(!ironpassResults.some(x=>x.text===ironpassPayload))throw Error('Ironpass QR does not read back the game');
writeFileSync(asset('ironpass-micro-v3-qr.png'),Buffer.from(await ironpassQR.image.arrayBuffer()));
writeFileSync(asset('ironpass-micro-v3.txt'),ironpassPayload);
console.log('Ironpass | '+ironpassSource.length+' HTML characters | '+ironpassPayload.length+' QR characters | '+ironpassQR.symbol.width+'×'+ironpassQR.symbol.height+' modules');

// Preserve the full self-contained Snake in a 2D QR so it can be scanned.
const snake=packScript(readFileSync(new URL('examples/snake-standalone.js',root),'utf8').trim());
// Tap Rush stores its executable JavaScript counter; ScanDeck supplies the 5-second timer.
// No URL or remote game data is stored in the barcode.
const tapRush=packScript(readFileSync(new URL('examples/tap-rush-code128.js',root),'utf8').trim());
for(const game of [
  {name:'snake-qr',payload:snake,format:'QRCode',scale:8},
  {name:'taprush-code128',payload:tapRush,format:'Code128',scale:6}
]){
  const result=await writeBarcode(game.payload,{format:game.format,scale:game.scale});
  if(!result.image)throw Error(game.name+' PNG generation failed');
  const hits=await readBarcodes(result.image,{formats:[game.format],tryHarder:true,tryDownscale:false});
  if(!hits.some(r=>r.text===game.payload))throw Error(game.name+' failed pixel round trip');
  writeFileSync(asset(game.name+'.png'),Buffer.from(await result.image.arrayBuffer()));
  writeFileSync(asset(game.name+'.txt'),game.payload);
  console.log(game.format+' | '+game.name+' | '+game.payload.length+' chars | verified');
}
// Host scanner engine locally, including the Wasm binary used by the browser.
copyFileSync(new URL('node_modules/zxing-wasm/dist/iife/full/index.js',root),new URL('vendor/zxing-wasm/index.js',root));
copyFileSync(new URL('node_modules/zxing-wasm/dist/full/zxing_full.wasm',root),new URL('vendor/zxing-wasm/zxing_full.wasm',root));
copyFileSync(new URL('node_modules/qrcode-generator/dist/qrcode.js',root),new URL('vendor/qrcode-generator.js',root));
console.log('ZXing WASM and QR creator: local browser files prepared');
