import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {decodeGame} from '../src/protocol.js';

test('published HTML embeds all 12 real decoded games without fetching on Play',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'sd-play-'));
 const path=join(folder,'index.html');
 try{
  writeFileSync(path,readFileSync(new URL('../index.html',import.meta.url),'utf8'));
  execFileSync(process.execPath,['tools/inject-code-sizes.mjs',path],{cwd:new URL('../',import.meta.url)});
  const html=readFileSync(path,'utf8');
  const embedded=html.match(/<script type="application\/json" id="play-catalog">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(embedded,'Build must inject JSON payload');
  assert.ok(!embedded.includes('</script>'));
  const catalog=JSON.parse(embedded);
  assert.equal(Object.keys(catalog).length,12);
  for(const [name,game] of Object.entries(catalog)){
   const actual=await decodeGame(readFileSync(new URL('../assets/'+name+'.txt',import.meta.url),'utf8'));
   assert.deepEqual(game,actual,name);
  }
  assert.match(html,/data-png-size>\d/);
 }finally{rmSync(folder,{recursive:true,force:true})}
});
