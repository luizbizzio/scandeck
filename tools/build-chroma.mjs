import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import qrcode from 'qrcode-generator';
import {readBarcodes} from 'zxing-wasm';
import {packScript} from '../protocol.js';
import {encodeChroma,chromaSvg,chromaPixels,decodeChromaPixels} from '../chroma.js';

// RGB-channel ChromaQR adapted from w-henderson/ChromaQR (MIT).
// The barcode is assembled from three independent, identically sized QR planes.
const root=new URL('../',import.meta.url);
const asset=name=>new URL('assets/'+name,root);
mkdirSync(asset(''),{recursive:true});
const table=Uint32Array.from({length:256},(_,v)=>{
 for(let n=0;n<8;n++)v=v&1?(v>>>1)^0xedb88320:v>>>1;
 return v>>>0;
});
function chunk(type,data){
 const label=Buffer.from(type),buf=Buffer.alloc(12+data.length);
 buf.writeUInt32BE(data.length,0);label.copy(buf,4);data.copy(buf,8);
 let crc=0xffffffff;
 for(const n of buf.subarray(4,8+data.length))crc=table[(crc^n)&255]^(crc>>>8);
 buf.writeUInt32BE((crc^0xffffffff)>>>0,8+data.length);
 return buf;
}
function png(rgb){
 const {width,height,data}=rgb,bytes=Buffer.alloc(height*(width*3+1));
 for(let y=0;y<height;y++)Buffer.from(data.buffer,data.byteOffset+y*width*3,width*3).copy(bytes,y*(width*3+1)+1);
 const head=Buffer.alloc(13);head.writeUInt32BE(width,0);head.writeUInt32BE(height,4);head[8]=8;head[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(bytes,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
const source=readFileSync(new URL('examples/colormatch-ultra.js',root),'utf8').trim();
const payload=packScript(source);
const symbol=encodeChroma(qrcode,payload);
const pixels=chromaPixels(symbol,10);
const recovered=await decodeChromaPixels(pixels,readBarcodes);
if(recovered!==payload)throw Error('ChromaQR RGB-channel pixel round trip failed');
writeFileSync(asset('chromaqr-wire.svg'),chromaSvg(symbol));
writeFileSync(asset('chromaqr-wire.png'),png(pixels));
writeFileSync(asset('chromaqr-wire.txt'),payload);
console.log('ChromaQR | Wire Crisis | '+payload.length+' game characters | '+symbol.modules+' QR modules per RGB layer | pixel round trip verified');
