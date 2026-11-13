import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeGame} from '../src/protocol.js';

const root=new URL('../',import.meta.url);
const html=readFileSync(new URL('index.html',root),'utf8');
const app=readFileSync(new URL('src/app.js',root),'utf8');
const css=readFileSync(new URL('src/style.css',root),'utf8');

const examples=[
  ['QR Code','ironpass-micro-v3-qr','Ironpass Micro'],
  ['Code 128','taprush-code128','Tap Rush'],
  ['Codablock F','snake-codablockf','Snake'],
  ['DotCode','neon-dodge-dotcode','Neon Dodge'],
  ['Data Matrix','catch-datamatrix','Catch 10'],
  ['Aztec Code','memory-aztec','Pattern Memory'],
  ['PDF417','breakout-pdf417','Brick Rush'],
  ['MaxiCode','tap-maxicode','Perfect Timing'],
  ['Micro QR','reflex-microqr','Pocket Reflex'],
  ['rMQR','math-rmqr','Codebreaker'],
  ['IRIS','iris-wire','Wire Crisis'],
  ['ChromaQR','chromaqr-chroma','Chroma Rush']
];

test('About includes a genuine example image and full-size PNG link for every history card',()=>{
  const about=html.slice(html.indexOf('<section class="page" id="about"'),html.indexOf('</main>'));
  const histories=[...about.matchAll(/<article class="about-code-card">([\s\S]*?)<\/article>/g)];
  assert.equal(histories.length,12);
  for(const [format,id,game] of examples){
    const card=histories.find(([,markup])=>markup.includes('<h3>'+format+'</h3>'))?.[1];
    const ext='png';
    assert.ok(card,format+' history is missing');
    assert.ok(card.includes('href="assets/'+id+'.'+ext+'"'),format+' must link to the exact PNG');
    assert.ok(card.includes('src="assets/'+id+'.'+ext+'"'),format+' must preview the exact PNG');
    assert.ok(card.includes('EXAMPLE'),format+' example caption is missing');
    assert.ok(card.includes('<strong>'+game+'</strong>'),format+' example must name its actual game');
    assert.match(card,/class="about-code-example"[^>]*href="assets\/[a-z0-9-]+\.(?:png|svg)"[^>]*target="_blank" rel="noopener noreferrer"/);
    assert.match(card,/loading="lazy" decoding="async"/);
  }
  assert.match(css,/\.about-example-preview img\{display:block;width:100%;height:100%;object-fit:contain/);
  assert.match(css,/\.about-code-example:focus-visible/);
});

test('all library cards place a View source button alongside Download',()=>{
  const gallery=html.slice(html.indexOf('<section class="page" id="library"'),html.indexOf('<section class="page" id="create"'));
  const cards=[...gallery.matchAll(/<article class="surface game-card">([\s\S]*?)<\/article>/g)];
  assert.equal(cards.length,12);
  for(const [,card] of cards){
    const name=card.match(/data-code-asset="([a-z0-9-]+)"/)?.[1];
    assert.ok(name, 'game card needs a code asset ID');
    const item=examples.find(([,id])=>id===name);
    assert.ok(item,'unexpected game card '+name);
    const actions=card.slice(card.indexOf('<div class="game-actions">'));
    assert.ok(actions.includes('href="assets/'+name+'.png" download'),name+' needs PNG download');
    assert.ok(actions.includes('data-source-asset="'+name+'"'),name+' needs View source');
    assert.ok(actions.includes('data-source-title="'+item[2]+'"'),name+' needs correct title');
    assert.ok(actions.indexOf(' download>')<actions.indexOf('data-source-asset='),name+' source should be beside Download');
    assert.match(actions,/>View source<\/button>/);
  }
  assert.equal((gallery.match(/class="btn btn-source"/g)||[]).length,12);
});

test('source reader uses the decoded original program and does not execute it',()=>{
  assert.match(app,/\$\('library'\)\.addEventListener\('click',async event=>/);
  assert.match(app,/event\.target\.closest\('button\[data-source-asset\]'\)/);
  assert.match(app,/const game=await readCatalogGame\(payloadName\)/);
  assert.match(app,/name==='ironpass-micro-v3-qr'\?'ironpass-micro-v3':name/);
  assert.match(app,/\$\('source-view'\)\.textContent=source/);
  assert.match(app,/\$\('source-dialog'\)\.showModal\(\)/);
  assert.match(app,/navigator\.clipboard\.writeText/);
  assert.match(html,/id="source-heading"/);
  assert.match(html,/id="source-description"/);
  assert.match(html,/id="copy-source"/);
  assert.match(html,/id="source-view" tabindex="0"/);
  assert.match(css,/#source-dialog #source-view/);
});

test('each gallery example decodes into readable source and Micro QR is identified as bytecode',async()=>{
  for(const [,id,game] of examples){
    const file=id==='ironpass-micro-v3-qr'?'ironpass-micro-v3':id;
    const payload=readFileSync(new URL('assets/'+file+'.txt',root),'utf8').trim();
    const decoded=await decodeGame(payload);
    assert.equal(typeof decoded.source,'string',game+' source is not text');
    assert.ok(decoded.source.length>0,game+' source is empty');
    if(id==='reflex-microqr'){
      assert.equal(decoded.kind,'microvm');
      assert.equal(decoded.source,'V1R4T3DIC+L0X');
    }else{
      assert.ok(['standalone','html'].includes(decoded.kind),game+' should provide full JavaScript or HTML');
    }
  }
});

test('source dialog reports Full for HTML, Partial for JavaScript and yellow Bytecode for Micro VM',()=>{
  assert.match(html,/id="source-status"/);
  assert.match(html,/id="source-status-label"/);
  assert.match(html,/id="source-format"/);
  assert.match(app,/function getEmbeddingStatus\(game\)/);
  assert.match(app,/game\.kind==='html'\)return \{status:'full',label:'Full'/);
  assert.match(app,/status:'partial',label:'Partial',format:'JavaScript only'/);
  assert.match(app,/status:'bytecode',label:'Bytecode',format:'VM instructions'/);
  assert.match(app,/badge\.className='code-embedding code-embedding-'\+embedding\.status/);
  assert.match(app,/\$\('source-status-label'\)\.textContent=embedding\.label/);
  assert.match(css,/\.code-embedding-bytecode\{color:#f1d77d\}/);
});
