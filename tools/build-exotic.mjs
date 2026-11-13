import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';
import {encodeCodablockF,encodeDotCode,decodeCodablockF,decodeDotCode,toPNG} from '@sythos/js_barcode_universal';
import {base85Encode,decodeGame} from '../src/protocol.js';

// Both extra formats use the MIT-licensed Sythos SDK v1.6.8.
// Store complete games, never an URL, game identifier, or interpreter bytecode.
const root=new URL('../',import.meta.url);
const asset=n=>new URL('assets/'+n,root);
mkdirSync(asset(''),{recursive:true});
mkdirSync(new URL('vendor/',root),{recursive:true});
const generatedShapes={};
const games=[
  {
    name:'snake-codablockf',
    input:'examples/snake-standalone.js',
    payload:source=>'SDB:'+base85Encode(deflateRawSync(Buffer.from(source),{level:9,windowBits:9,memLevel:9})),
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
          const score=900*Math.abs(Math.log(ratio/2.2))+
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
    payload:source=>'SDC:'+base85Encode(deflateRawSync(Buffer.from(source),{level:9,windowBits:10,memLevel:9})),
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
  if(game.format==='codablockf'&&(matrix.width>420||matrix.height<100))
    throw Error('Codablock F layout is too wide for practical camera framing');
  // Use the exact writer expected by our strict image decoder. BWIPP's
  // previous 1941×1371 DotCode PNG exceeded the camera image safety limit.
  const png=await toPNG(matrix,{scale:game.scale,margin:game.margin});
  generatedShapes[game.format]=[matrix.width,matrix.height];
  // Check all data codewords, row checks and error correction using the
  // format's strict matrix decoder. Physical camera decoding is separate.
  const result=game.format==='codablockf'?decodeCodablockF(matrix):decodeDotCode(matrix);
  if(result?.text!==payload)
    throw Error(game.name+' failed complete matrix decode integrity check');
  writeFileSync(asset(game.name+'.png'),Buffer.from(png));
  writeFileSync(asset(game.name+'.txt'),payload);
  console.log(game.format+' | '+game.name+' | '+source.length+' source characters -> '+payload.length+' code characters | '+matrix.width+'×'+matrix.height+' modules | complete matrix round-trip verified');
}
writeFileSync(new URL('src/exotic-shapes.js',root),
  '/* Geometry only, generated at build time. */\nexport const EXOTIC_SHAPES='+JSON.stringify(generatedShapes)+';\n');
copyFileSync(new URL('node_modules/@sythos/js_barcode_universal/bundle/sythos-barcode.esm.js',root),
 new URL('vendor/sythos-barcode.esm.js',root));
copyFileSync(new URL('node_modules/@sythos/js_barcode_universal/LICENSE',root),
 new URL('vendor/sythos.LICENSE',root));
console.log('Sythos MIT decoder bundled locally for camera and image uploads');
