import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {decodeGame} from '../src/protocol.js';

test('diagnose published exotic PNGs using the actual camera decoder (bounded)',async()=>{
 const script=`
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {decode} from '@sythos/js_barcode_universal';
const file=process.argv[1],format=process.argv[2];
const png=PNG.sync.read(readFileSync(file));
const image={width:png.width,height:png.height,data:new Uint8ClampedArray(png.data)};
const size=png.width+'x'+png.height;
const t=Date.now();
for(const profile of ['camera','default']){
 try{
  const hits=decode(image,{formats:[format],...(profile==='camera'?{profile:'camera',tryHarder:true}:{})});
  console.log(format,profile,size,hits.length,hits.map(x=>({text:x.text?.slice(0,45),length:x.text?.length})),Date.now()-t);
 }catch(error){console.log(format,profile,'ERROR',error.message,Date.now()-t)}
}
`;
 for(const [name,format] of [['snake-codablockf','codablockf'],['neon-dodge-dotcode','dotcode']]){
  const file=fileURLToPath(new URL('../assets/'+name+'.png',import.meta.url));
  const result=spawnSync(process.execPath,['--input-type=module','-e',script,file,format],
   {cwd:fileURLToPath(new URL('../',import.meta.url)),timeout:6500,encoding:'utf8',maxBuffer:30000});
  console.log('DIAGNOSTIC',name,'status=',result.status,'signal=',result.signal,'stdout=',result.stdout?.trim(),'stderr=',result.stderr?.slice(0,800),'error=',result.error?.code);
  const payload=readFileSync(new URL('../assets/'+name+'.txt',import.meta.url),'utf8');
  const game=await decodeGame(payload);
  assert.ok(game.source.length>0);
 }
});
