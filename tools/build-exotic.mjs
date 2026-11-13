import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';
import {encodeCodablockF,encodeDotCode,decodeCodablockF,decodeDotCode,toPNG} from '@sythos/js_barcode_universal';
import {base43Encode,packScript,decodeGame} from '../src/protocol.js';

// Both extra formats use the MIT-licensed Sythos SDK v1.6.8.
// Store complete games, never an URL, game identifier, or interpreter bytecode.
const root=new URL('../',import.meta.url);
const asset=n=>new URL('assets/'+n,root);
mkdirSync(asset(''),{recursive:true});
mkdirSync(new URL('vendor/',root),{recursive:true});
const games=[
  {
    name:'snake-codablockf',
    input:'examples/snake-standalone.js',
    payload:source=>packScript(source),
    format:'codablockf',
    encode:payload=>encodeCodablockF(payload,{rowHeight:5,separatorHeight:1}),
    margin:12,scale:4
  },{
    name:'neon-dodge-dotcode',
    input:'examples/neon-dodge-dotcode.html',
    payload:source=>'SD1:'+base43Encode(deflateRawSync(Buffer.from(source))),
    format:'dotcode',
    encode:payload=>encodeDotCode(payload,{aspectRatio:1}),
    margin:10,scale:5
  }
];
for(const game of games){
  const source=readFileSync(new URL(game.input,root),'utf8').trim();
  const payload=game.payload(source);
  const g=await decodeGame(payload);
  if(g.source.trim()!==source)throw Error(game.name+' game content is not completely embedded');
  const matrix=game.encode(payload);
  const png=await toPNG(matrix,{scale:game.scale,margin:game.margin});
  // Check all data codewords, row checks and error correction using the
  // format's strict matrix decoder. Physical camera decoding is separate.
  const result=game.format==='codablockf'?decodeCodablockF(matrix):decodeDotCode(matrix);
  if(result?.text!==payload)
    throw Error(game.name+' failed complete matrix decode integrity check');
  writeFileSync(asset(game.name+'.png'),Buffer.from(png));
  writeFileSync(asset(game.name+'.txt'),payload);
  console.log(game.format+' | '+game.name+' | '+payload.length+' characters | '+matrix.width+'×'+matrix.height+' modules | complete matrix round-trip verified');
}
copyFileSync(new URL('node_modules/@sythos/js_barcode_universal/bundle/sythos-barcode.esm.js',root),
 new URL('vendor/sythos-barcode.esm.js',root));
copyFileSync(new URL('node_modules/@sythos/js_barcode_universal/LICENSE',root),
 new URL('vendor/sythos.LICENSE',root));
console.log('Sythos MIT decoder bundled locally for camera and image uploads');
