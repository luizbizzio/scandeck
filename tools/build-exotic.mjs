import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';
import {encodeCodablockF,encodeDotCode,decodeCodablockF,decodeDotCode,toPNG} from '@sythos/js_barcode_universal';
import {base43Encode,packScript,decodeGame} from '../src/protocol.js';
import bwipjs from 'bwip-js';

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
    payload:source=>'SDZ:'+deflateRawSync(Buffer.from(source)).toString('base64'),
    format:'codablockf',
    encode:payload=>{
      // Try several legal layouts. Prefer fewer tall, redundant-looking rows
      // without turning the symbol into an impossibly wide barcode.
      const candidates=[];
      for(const rows of [20,24,26,28,30,32,36]){
        try{
          const matrix=encodeCodablockF(payload,{rows,columns:28,rowHeight:6,separatorHeight:1});
          if(decodeCodablockF(matrix)?.text!==payload)continue;
          const ratio=matrix.width/matrix.height;
          const score=900*Math.abs(Math.log(ratio/1.8))+
            matrix.width*matrix.height/4000;
          candidates.push({rows,matrix,score});
        }catch{}
      }
      candidates.sort((a,b)=>a.score-b.score);
      if(!candidates.length)throw Error('No complete Codablock F layout fits the full Snake');
      console.log('Codablock layout selected '+candidates[0].rows+' rows');
      return candidates[0].matrix;
    },
    margin:12,scale:4
  },{
    name:'neon-dodge-dotcode',
    input:'examples/neon-dodge-dotcode.html',
    payload:source=>'SDH:'+deflateRawSync(Buffer.from(source)).toString('base64'),
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
  // Public DotCode uses the independent BWIPP standard encoder for interoperability.
  // Sythos remains our strict local matrix integrity reference.
  if(game.format==='codablockf'&&(matrix.width>420||matrix.height<100))
    throw Error('Codablock F layout is too wide for practical camera framing');
  const png=game.format==='dotcode'
    ?await bwipjs.toBuffer({bcid:'dotcode',text:payload,scale:5,padding:20})
    :await toPNG(matrix,{scale:game.scale,margin:game.margin});
  // Check all data codewords, row checks and error correction using the
  // format's strict matrix decoder. Physical camera decoding is separate.
  const result=game.format==='codablockf'?decodeCodablockF(matrix):decodeDotCode(matrix);
  if(result?.text!==payload)
    throw Error(game.name+' failed complete matrix decode integrity check');
  writeFileSync(asset(game.name+'.png'),Buffer.from(png));
  writeFileSync(asset(game.name+'.txt'),payload);
  console.log(game.format+' | '+game.name+' | '+source.length+' source characters -> '+payload.length+' code characters | '+matrix.width+'×'+matrix.height+' modules | complete matrix round-trip verified');
}
copyFileSync(new URL('node_modules/@sythos/js_barcode_universal/bundle/sythos-barcode.esm.js',root),
 new URL('vendor/sythos-barcode.esm.js',root));
copyFileSync(new URL('node_modules/@sythos/js_barcode_universal/LICENSE',root),
 new URL('vendor/sythos.LICENSE',root));
console.log('Sythos MIT decoder bundled locally for camera and image uploads');
