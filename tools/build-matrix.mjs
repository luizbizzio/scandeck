import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { writeBarcode, readBarcodes } from 'zxing-wasm';
import { base43Encode, packScript } from '../protocol.js';

const root=new URL('../',import.meta.url);
const asset=(name)=>new URL('assets/'+name,root);
mkdirSync(new URL('assets/',root),{recursive:true});
mkdirSync(new URL('vendor/zxing-wasm/',root),{recursive:true});

const matrixGames=[
  {input:'examples/breakout-pdf417.html',output:'breakout-pdf417',format:'PDF417',kind:'html',max:1700},
  {input:'examples/tap-maxicode.js',output:'tap-maxicode',format:'MaxiCode',kind:'script',max:95},
  {input:'examples/math-microqr.txt',output:'math-microqr',format:'MicroQRCode',kind:'tiny',max:15},
  {input:'examples/math-rmqr.js',output:'math-rmqr',format:'RMQRCode',kind:'script',max:160},
  {input:'examples/catch-datamatrix.html',output:'catch-datamatrix',format:'DataMatrix'},
  {input:'examples/memory-aztec.html',output:'memory-aztec',format:'Aztec'}
];

for (const game of matrixGames) {
  const source=readFileSync(new URL(game.input,root),'utf8').trim();
  const payload=game.kind==='script'?packScript(source):game.kind==='tiny'?source:
    'SD1:'+base43Encode(deflateRawSync(Buffer.from(source)));
  const max=game.max??1400;
  if (payload.length>max) throw new Error(game.format+' game is too large ('+payload.length+' > '+max+').');
  const result=await writeBarcode(payload,{format:game.format,scale:game.format==='PDF417'?10:game.format==='RMQRCode'?12:game.format==='MaxiCode'?12:8});
  if (!result.svg||!result.image) throw new Error(game.format+' did not produce SVG and PNG: '+JSON.stringify({error:result.error,keys:Object.keys(result)}));
  // The barcode must be decoded from its actual pixels, not from copied payload metadata.
  const found=await readBarcodes(result.image,{formats:[game.format],tryHarder:true,maxNumberOfSymbols:1});
  if(!found.some(x=>x.text===payload))throw new Error(game.format+' failed its pixel round-trip');
  writeFileSync(asset(game.output+'.png'),Buffer.from(await result.image.arrayBuffer()));
  writeFileSync(asset(game.output+'.txt'),payload);
  console.log(game.format+' | '+source.length+' source characters | '+payload.length+' code characters | barcode verified');
}

// Preserve the full self-contained Snake in a 2D QR so it can be scanned.
const snake=packScript(readFileSync(new URL('examples/snake-standalone.js',root),'utf8').trim());
// Seven printable characters encode a complete solvable Lights Out level.
// The rules and rendering are a reusable interpreter, not part of the barcode.
const lights='LO:5A36';
for(const game of [
  {name:'snake-qr',payload:snake,format:'QRCode',scale:8},
  {name:'lights-code128',payload:lights,format:'Code128',scale:5}
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
