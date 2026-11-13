import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateRawSync, deflateSync } from 'node:zlib';
import { encodeColor, renderColorSVG, renderColorRaster, decodeColor } from '../vendor/iris/color.js';
import { base43Encode, packScript } from '../src/protocol.js';

const root=new URL('../',import.meta.url);
const asset=name=>new URL('assets/'+name,root);
mkdirSync(asset(''),{recursive:true});

// This encoder and decoder are sourced from AllTerrainDeveloper/iris (MIT).
// Full games remain inside the color symbol. The RGB markers improve camera registration.
const games=[
  {input:'examples/colormatch-ultra.js',output:'iris-wire',kind:'script'}
];
const crcTable=Uint32Array.from({length:256},(_,n)=>{
  for(let k=0;k<8;k++)n=n&1?(n>>>1)^0xedb88320:n>>>1;
  return n>>>0;
});
function chunk(type,data){
  const name=Buffer.from(type),out=Buffer.alloc(12+data.length);
  out.writeUInt32BE(data.length,0);name.copy(out,4);data.copy(out,8);
  let crc=0xffffffff;
  for(const byte of out.subarray(4,8+data.length))crc=crcTable[(crc^byte)&255]^(crc>>>8);
  out.writeUInt32BE((crc^0xffffffff)>>>0,8+data.length);
  return out;
}
function encodePng(grid){
  const {width,height,data}=grid;
  const scanlines=Buffer.alloc(height*(1+width*3));
  for(let y=0;y<height;y++)Buffer.from(data.buffer,data.byteOffset+y*width*3,width*3).copy(scanlines,y*(1+width*3)+1);
  const head=Buffer.alloc(13);head.writeUInt32BE(width,0);head.writeUInt32BE(height,4);
  head[8]=8;head[9]=2; // 8-bit RGB
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(scanlines,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
for(const game of games){
  const source=readFileSync(new URL(game.input,root),'utf8').trim();
  const payload=game.kind==='html'?'SD1:'+base43Encode(deflateRawSync(Buffer.from(source))):packScript(source);
  const symbol=encodeColor(payload,{markers:true});
  const grid=renderColorRaster(symbol);
  if(decodeColor(grid).text!==payload)throw Error(game.output+' failed its RGB-pixel round trip');
  const svg=renderColorSVG(symbol,{style:'slices'});
  if(!svg.includes('<svg'))throw Error(game.output+' SVG generation failed');
  writeFileSync(asset(game.output+'.svg'),svg);
  // Render more pixels per IRIS cell without changing its payload or marker geometry.
  const multiplier=Math.max(1,Math.min(6,Math.floor(3000/grid.width)));
  const detailed=multiplier>1?renderColorRaster({...symbol,params:{...symbol.params,u:symbol.params.u*multiplier}}):grid;
  if(decodeColor(detailed).text!==payload)throw Error('High-resolution IRIS integrity check failed');
  writeFileSync(asset(game.output+'.png'),encodePng(detailed));
  writeFileSync(asset(game.output+'.txt'),payload);
  console.log('IRIS | '+game.output+' | '+payload.length+' characters | '+symbol.params.K+' rings | RGB-pixel round trip verified at '+detailed.width+'x'+detailed.height);
}
