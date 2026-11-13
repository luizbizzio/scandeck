import {statSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Every entry uses the actual PNG and exact encoded text shipped in the build.
// Byte sizes are not estimates, and the PNG is never confused with payload data.
const root=new URL('../assets/',import.meta.url);
const entries=[
  'ironpass-micro-v3-qr',
  'taprush-code128',
  'snake-codablockf',
  'neon-dodge-dotcode',
  'catch-datamatrix',
  'memory-aztec',
  'breakout-pdf417',
  'tap-maxicode',
  'reflex-microqr',
  'math-rmqr',
  'iris-wire',
  'chromaqr-chroma'
];
const out={};
for(const id of entries){
  const png=fileURLToPath(new URL(id+'.png',root));
  const txt=fileURLToPath(new URL((id==='ironpass-micro-v3-qr'?'ironpass-micro-v3':id)+'.txt',root));
  const bytes=readFileSync(txt);
  if(!bytes.length)throw Error('Empty encoded game: '+id);
  const size=statSync(png).size;
  if(size<8||!readFileSync(png).subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))
    throw Error('Invalid PNG for '+id);
  const payload=bytes.toString('utf8');
  const completeness=payload.startsWith('V1')?'bytecode'
    :payload.startsWith('SDS:')||payload.startsWith('SDJ:')||payload.startsWith('SDZ:')?'partial'
    :payload.startsWith('IP3:')||payload.startsWith('SD1:')||payload.startsWith('SDH:')?'full'
    :null;
  if(!completeness)throw Error('Unknown game encoding: '+id);
  if(completeness==='bytecode'&&id!=='reflex-microqr')throw Error('Unexpected bytecode game: '+id);
  out[id]={payloadBytes:bytes.length,pngBytes:size,completeness};
}
writeFileSync(new URL('code-sizes.json',root),JSON.stringify(out)+'\n');
console.log('Code metadata: '+entries.length+' PNG sizes | '+Object.values(out).filter(x=>x.completeness==='full').length+' Full | '+Object.values(out).filter(x=>x.completeness==='partial').length+' Partial | '+Object.values(out).filter(x=>x.completeness==='bytecode').length+' Bytecode');
