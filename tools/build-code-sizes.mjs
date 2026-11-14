import {statSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Every entry uses the actual PNG and exact encoded text shipped in the build.
// Byte sizes are not estimates, and the PNG is never confused with payload data.
const root=new URL('../assets/',import.meta.url);
const entries=[
  'ironpass-micro-v3-qr',
  'taprush-code128',
  'dice-streak-micropdf417',
  'neon-dodge-dotcode',
  'catch-datamatrix',
  'memory-aztec',
  'breakout-pdf417',
  'timing-ean13',
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
  const completeness=payload.startsWith('V1')||/^299000[0-9]{7}$/.test(payload)?'bytecode'
    :payload.startsWith('SDS:')||payload.startsWith('SDJ:')||payload.startsWith('SDZ:')||payload.startsWith('SDB:')?'partial'
    :payload.startsWith('IP3:')||payload.startsWith('SD1:')||payload.startsWith('SDH:')||payload.startsWith('SDC:')||payload.startsWith('SDM:')?'full'
    :null;
  if(!completeness)throw Error('Unknown game encoding: '+id);
  if(completeness==='bytecode'&&!['reflex-microqr','timing-ean13'].includes(id))throw Error('Unexpected bytecode game: '+id);
  out[id]={payloadBytes:bytes.length,pngBytes:size,completeness};
}
writeFileSync(new URL('code-sizes.json',root),JSON.stringify(out)+'\n');
console.log('Code metadata: '+entries.length+' PNG sizes | '+Object.values(out).filter(x=>x.completeness==='full').length+' Full | '+Object.values(out).filter(x=>x.completeness==='partial').length+' Partial | '+Object.values(out).filter(x=>x.completeness==='bytecode').length+' Bytecode');
