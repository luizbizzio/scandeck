import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
test('published HTML contains real game code and PNG sizes without JavaScript',()=>{
 const folder=mkdtempSync(join(tmpdir(),'sd-card-'));
 const file=join(folder,'index.html');
 try{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  writeFileSync(file,html);
  execFileSync(process.execPath,['tools/inject-code-sizes.mjs',file],{cwd:new URL('../',import.meta.url)});
  const output=readFileSync(file,'utf8');
  const cards=[...output.matchAll(/<div class="code-metadata" data-code-asset="([^"]+)"[^>]*>[\s\S]*?<\/div>/g)];
  assert.equal(cards.length,12);
  for(const [,name,markup] of cards){
   assert.match(markup,/data-payload-size>\d[\d,.]* (?:B|KB)<\/strong>/,name);
   assert.match(markup,/data-png-size>\d[\d,.]* (?:B|KB)<\/strong>/,name);
  }
 }finally{rmSync(folder,{recursive:true,force:true})}
});
