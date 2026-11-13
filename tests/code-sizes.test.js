import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const html=readFileSync(new URL('index.html',root),'utf8');
const source=readFileSync(new URL('app.js',root),'utf8');
const css=readFileSync(new URL('style.css',root),'utf8');
const manifest=JSON.parse(readFileSync(new URL('assets/code-sizes.json',root),'utf8'));

test('each of the 12 game cards has code bytes, PNG file size and a visible check',()=>{
  const games=[...html.matchAll(/<article class="surface game-card">([\s\S]*?)<\/article>/g)];
  assert.equal(games.length,12);
  assert.equal(Object.keys(manifest).length,12);
  for(const [,card] of games){
    const id=card.match(/data-code-asset="([a-z0-9-]+)"/)?.[1];
    assert.ok(id, 'Card is missing code metadata');
    assert.ok(manifest[id], id+' is missing from generated metadata');
    assert.match(card,/data-payload-size/);
    assert.match(card,/data-png-size/);
    assert.match(card,/class="code-tick"/);
    const kind=id==='reflex-microqr'?'partial':'full';
    assert.ok(card.includes('code-embedding-'+kind),id+' has wrong embedding indicator');
  }
  assert.match(css,/code-embedding-full \.code-tick/);
  assert.match(css,/code-embedding-partial \.code-tick/);
});

test('sizes are taken from exact shipped PNG and embedded payload bytes',()=>{
  let complete=0,partial=0;
  for(const [id,meta] of Object.entries(manifest)){
    const png=statSync(new URL('assets/'+id+'.png',root)).size;
    const payload=readFileSync(new URL('assets/'+(id==='ironpass-micro-v3-qr'?'ironpass-micro-v3':id)+'.txt',root));
    assert.equal(meta.pngBytes,png,id+' PNG size must be exact');
    assert.equal(meta.payloadBytes,payload.byteLength,id+' payload must be exact');
    if(meta.completeness==='full')complete++;
    else if(meta.completeness==='partial')partial++;
    else assert.fail(id+' has unknown completeness');
  }
  assert.equal(complete,11);
  assert.equal(partial,1);
  assert.equal(manifest['reflex-microqr'].payloadBytes,13);
  assert.equal(manifest['taprush-code128'].payloadBytes,65);
});

test('one lightweight metadata request updates all sizes without decoding any images',()=>{
  assert.match(source,/fetch\('assets\/code-sizes\.json\?v=28'/);
  assert.match(source,/function formatCodeSize\(/);
  assert.match(source,/querySelectorAll\('\.code-metadata\[data-code-asset\]'\)/);
  assert.match(source,/row\.querySelector\('\[data-payload-size\]'\)/);
  assert.match(source,/row\.querySelector\('\[data-png-size\]'\)/);
  assert.match(source,/if\(tab==='library'\)void loadCodeSizes\(\)/);
  assert.match(html,/src="app\.js\?v=28"/);
  assert.match(html,/href="style\.css\?v=29"/);
});
