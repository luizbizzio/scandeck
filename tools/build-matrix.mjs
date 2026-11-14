import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { writeBarcode, readBarcodes } from 'zxing-wasm';
import { base43Encode, packScript, packEanLevel, packMicroHtml } from '../src/protocol.js';

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
  const source=readFileSync(new URL(game.input,root),'utf8').trim();
  const payload=game.kind==='script'?packScript(source):game.kind==='microhtml'?packMicroHtml(source):game.kind==='ean'?packEanLevel(source):game.kind==='tiny'?source:
    'SD1:'+base43Encode(deflateRawSync(Buffer.from(source)));
  const max=game.max??1400;
  if (payload.length>max) throw new Error(game.format+' game is too large ('+payload.length+' > '+max+').');
  const opts={format:game.format,scale:game.format==='PDF417'||game.format==='MicroPDF417'?10:game.format==='RMQRCode'?12:game.format==='EAN13'?12:8};
  let result=await writeBarcode(payload,opts);
  let selectedPayload=payload;
  if(game.format==='RMQRCode'){
    // An alphanumeric compressed encoding can fit a smaller rMQR version than
    // the byte-mode JavaScript. Select it only if the written symbol is smaller
    // and the actual PNG independently decodes to the full compressed payload.
    const packed='SDY:'+base43Encode(deflateRawSync(Buffer.from(source)));
    try{
      const other=await writeBarcode(packed,opts);
      if(other.image&&other.svg){
        const match=(await readBarcodes(other.image,{formats:[game.format],tryHarder:true,maxNumberOfSymbols:1})).some(x=>x.text===packed);
        const rawImage=Buffer.from(await result.image.arrayBuffer());
        const otherImage=Buffer.from(await other.image.arrayBuffer());
        const area=rawImage.readUInt32BE(16)*rawImage.readUInt32BE(20);
        const otherArea=otherImage.readUInt32BE(16)*otherImage.readUInt32BE(20);
        console.log('rMQR candidates: original '+payload.length+' chars / '+area+' px², compressed '+packed.length+' chars / '+otherArea+' px²');
        if(match&&otherArea<area){selectedPayload=packed;result=other}
        // Zint defaults to the smallest area, which can create an R13x139
    // extremely thin symbol. A slightly taller code with fewer columns
    // is easier to locate and keep in focus on a phone.
    const basePng=Buffer.from(await result.image.arrayBuffer());
    const baseArea=basePng.readUInt32BE(16)*basePng.readUInt32BE(20);
    let bestScore=Infinity,bestResult=result,bestVersion='auto';
    const options=[null,30,31,32,26,27,21,22];
    for(const version of options){
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
    }catch(error){console.log('rMQR compressed candidate unavailable: '+error.message)}
  }
  if (!result.svg||!result.image) throw new Error(game.format+' did not produce SVG and PNG: '+JSON.stringify({error:result.error,keys:Object.keys(result)}));
  // The barcode must be decoded from its actual pixels, not from copied payload metadata.
  const found=await readBarcodes(result.image,{formats:[game.format],tryHarder:true,maxNumberOfSymbols:1});
  if(!found.some(x=>x.text===selectedPayload))throw new Error(game.format+' failed its pixel round-trip');
  writeFileSync(asset(game.output+'.png'),Buffer.from(await result.image.arrayBuffer()));
  writeFileSync(asset(game.output+'.txt'),selectedPayload);
  console.log(game.format+' | '+source.length+' source characters | '+selectedPayload.length+' code characters | barcode verified');
}

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
