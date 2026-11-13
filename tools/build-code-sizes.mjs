import {statSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Every entry uses the actual PNG and exact encoded text shipped in the build.
// Byte sizes are not estimates, and the PNG is never confused with payload data.
const root=new URL('../assets/',import.meta.url);
const entries=[
  ['ironpass-micro-v3-qr','full'],
  ['taprush-code128','full'],
  ['snake-codablockf','full'],
  ['neon-dodge-dotcode','full'],
  ['catch-datamatrix','full'],
  ['memory-aztec','full'],
  ['breakout-pdf417','full'],
  ['tap-maxicode','full'],
  ['reflex-microqr','partial'],
  ['math-rmqr','full'],
  ['iris-wire','full'],
  ['chromaqr-chroma','full']
];
const out={};
for(const [id,completeness] of entries){
  const png=fileURLToPath(new URL(id+'.png',root));
  const txt=fileURLToPath(new URL((id==='ironpass-micro-v3-qr'?'ironpass-micro-v3':id)+'.txt',root));
  const bytes=readFileSync(txt);
  if(!bytes.length)throw Error('Empty encoded game: '+id);
  const size=statSync(png).size;
  if(size<8||!readFileSync(png).subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))
    throw Error('Invalid PNG for '+id);
  const payload=bytes.toString('utf8');
  if(completeness==='partial'&&(!payload.startsWith('V1')||id!=='reflex-microqr'))
    throw Error('Unexpected VM/interpreter dependency for '+id);
  if(completeness==='full'&&!/^(?:SD1:|SDS:|IP3:)/.test(payload))
    throw Error('Missing complete game payload for '+id);
  out[id]={payloadBytes:bytes.length,pngBytes:size,completeness};
}
writeFileSync(new URL('code-sizes.json',root),JSON.stringify(out)+'\n');
console.log('Code metadata: '+entries.length+' PNG sizes, '+entries.filter(x=>x[1]==='full').length+' complete games, '+entries.filter(x=>x[1]==='partial').length+' interpreter-dependent game');
