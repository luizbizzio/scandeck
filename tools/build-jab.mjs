// Generate a genuine, color-encoded JAB Code containing the complete Codebreaker JavaScript.
// Experimental 8-color, single-symbol JAB default-mode profile from Sythos v1.6.8.
// Bundle only the JAB module, keeping the scanner usable offline.
import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {PNG} from 'pngjs';
import {packScript,decodeGame} from '../src/protocol.js';

const root=new URL('../',import.meta.url);
mkdirSync(new URL('vendor/',root),{recursive:true});
await build({
 entryPoints:[new URL('../node_modules/@sythos/js_barcode_universal/src/js/jabcode/index.js',import.meta.url).pathname],
 outfile:new URL('../vendor/jabcode.js',import.meta.url).pathname,
 platform:'neutral',format:'esm',target:'es2022',bundle:true,minify:true,logLevel:'warning',
 legalComments:'eof'
});
const {encodeJABCode,decodeJABCode,toColorImageData}=await import('../vendor/jabcode.js');
const source=readFileSync(new URL('../examples/math-rmqr.js',import.meta.url),'utf8').trim();
const payload=packScript(source);
if((await decodeGame(payload)).source!==source)throw Error('Codebreaker source was lost');
const matrix=encodeJABCode(new TextEncoder().encode(payload));
const margin=4,scale=12,version=matrix.jabcode.version;
const image=toColorImageData(matrix,{scale,margin});
// Keep a white quiet zone, not the rendering API's internal grey background.
const edge=margin*scale,size=matrix.width*scale;
for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
 if(x>=edge&&x<edge+size&&y>=edge&&y<edge+size)continue;
 const p=(y*image.width+x)*4;
 image.data[p]=image.data[p+1]=image.data[p+2]=image.data[p+3]=255;
}
const corners={
 topLeft:{x:edge,y:edge},topRight:{x:edge+size,y:edge},
 bottomRight:{x:edge+size,y:edge+size},bottomLeft:{x:edge,y:edge+size}
};
const decoded=new TextDecoder('utf-8',{fatal:true}).decode(decodeJABCode(image,corners,version));
if(decoded!==payload)throw Error('JAB pixel decode differs from the full embedded game payload');
const png=PNG.sync.write({width:image.width,height:image.height,data:Buffer.from(image.data)});
writeFileSync(new URL('../assets/codebreaker-jab.png',import.meta.url),png);
writeFileSync(new URL('../assets/codebreaker-jab.txt',import.meta.url),payload);
writeFileSync(new URL('../assets/codebreaker-jab.json',import.meta.url),JSON.stringify({version,modules:matrix.width,scale,margin})+'\n');
console.log('JAB Code | '+matrix.width+'x'+matrix.width+' modules | '+payload.length+' complete payload characters | PNG pixel round trip verified');
