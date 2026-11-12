import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

test('premise is clear on first visit', () => {
  assert.match(html, /The game is in the code\./);
  assert.match(html, /The code holds the game, not a link to it\./);
  assert.match(html, /id="start-camera"/);
  assert.match(html, /id="image-input"/);
  assert.match(html, /id="camera-panel"[^>]*hidden/);
  assert.match(html, /id="scan-games"/);
  assert.doesNotMatch(html, /CAMERA OFF|Supported formats|Nothing here yet/);
});

test('games are clearly split by code type', () => {
  assert.match(html, /id="qr-games-heading"/);
  assert.match(html, /id="bar-games-heading"/);
  assert.match(html, /id="dm-games-heading"/);
  assert.match(html, /id="aztec-games-heading"/);
  for(const id of ['pdf-games-heading','maxi-games-heading','micro-games-heading','rmqr-games-heading'])assert.ok(html.includes('id="'+id+'"'));
  assert.match(html, /Download QR/);
  assert.match(html, /Download barcode/);
});

test('games show their actual QR and Code 128 images with full-size links', () => {
  for (const name of ['ironpass-micro-v3-qr.png','snake-code128.svg']) {
    assert.match(html, new RegExp('href="assets/' + name.replace('.', '\\.') + '"'));
    assert.match(html, new RegExp('src="assets/' + name.replace('.', '\\.') + '"'));
  }
  assert.match(html, /class="game-code-preview qr-code-preview"/);
  assert.match(html, /class="game-code-preview barcode-code-preview"/);
  assert.doesNotMatch(html, /class="game-art/);
  assert.match(script, /fetch\('assets\/snake-code128\.svg'/);
  assert.match(script, /decodeCode128Svg\(await response\.text\(\)\)/);
  assert.match(script, /fetch\('assets\/'\+name\+'\.png'\)/);
  assert.match(script, /getMatrixEngine\(\)/);
  assert.doesNotMatch(script, /decodeGame\(LEGACY_SNAKE\)/);
  assert.match(script, /show\('touch-controls',game.kind==='snake'\|\|game.kind==='micro'\)/);
});

test('create page shows a clear workflow and hides result until used', () => {
  assert.match(html, /id="create-source"/);
  assert.match(html, /id="create-result" hidden/);
  assert.match(html, /id="use-example"/);
  assert.match(html, /data-format="qr"/);
  assert.match(html, /data-format="bar"/);
  assert.match(html, /data-format="data-matrix"/);
  assert.match(html, /data-format="aztec"/);
  for(const code of ['pdf','maxi','microqr','rmqr'])assert.ok(html.includes('data-format="'+code+'"'));
  assert.match(html, /Beta 0\.2/);
  assert.doesNotMatch(script, /https:\/\/cdnjs\.cloudflare\.com/);
  assert.match(html, /id="create-error"/);
});

test('about explains the difference and does not use developer protocol jargon', () => {
  assert.match(html, /Most QR codes open a website/);
  assert.match(html, /How it works/);
  assert.match(html, /Only compatible game codes work/);
  const about = html.split('<section class="page" id="about"')[1].split('</section>')[0];
  assert.doesNotMatch(about, /IP3:|SD1:|SDJ:|iframe|sandbox|payload/);
});

test('all visible actions still have handlers', () => {
  for (const id of ['scan-games','try-snake','try-ironpass','create-source','generate','use-example','download-code','test-code','copy-code','about-create','start-camera','stop-camera','image-input','play-detected','try-catch','try-memory','try-breakout','try-tap','try-micro','try-rmqr']) {
    assert.ok(html.includes(`id="${id}"`), `${id} control is present`);
    assert.ok(script.includes(`$('${id}')`), `${id} has a JS handler`);
  }
  assert.match(script, /show\('camera-panel',true\)/);
  assert.match(script, /show\('create-result',true\)/);
  assert.match(css, /\[hidden\]\{display:none!important\}/);
});


test('scanner has a visible idle preview and keeps the camera available on demand', () => {
  assert.match(html, /id="scan-viewport"/);
  assert.match(html, /id="scan-idle"/);
  assert.match(html, /id="camera-panel"[^>]*hidden/);
  assert.match(html, /id="stop-camera"[^>]*hidden/);
  assert.match(html, /Scan a game/);
  assert.match(html, /Code 128<\/span><span>Data Matrix<\/span><span>Aztec/);
  assert.match(script, /show\('scan-idle',false\)/);
  assert.match(script, /show\('scan-idle',true\)/);
  assert.match(script, /show\('stop-camera',true\)/);
  assert.match(script, /show\('stop-camera',false\)/);
  assert.match(script, /\$\('scan-viewport'\)\.addEventListener\('drop'/);
  assert.match(css, /\.scan-workspace\{display:grid/);
});
test('experimental color games explain that their Play buttons are not scans',()=>{
  for(const name of ['jab-games-heading','ultra-games-heading'])assert.match(html,new RegExp('id="'+name+'"'));
  for(const id of ['try-jab','try-ultra'])assert.ok(script.includes("$('"+id+"')"));
  assert.match(html,/Scanner unavailable/);
  assert.match(script,/playColorExample/);
});

test('standalone CSS is kept in the head when game rewrites body HTML',async()=>{
  const {gameDocument}=await import('../runtime.js');
  const doc=gameDocument({kind:'standalone',title:'Perfect Timing',instructions:'TAP WHEN 7',
    source:'document.body.innerHTML=7'});
  const head=doc.slice(0,doc.indexOf('</head>'));
  assert.match(head,/background:#09120d/);
  assert.match(doc,/<body data-title="Perfect Timing" data-hint="TAP WHEN 7">/);
  assert.match(doc,/PERFECT!/);
  assert.ok(doc.indexOf('<style>')<doc.indexOf('</head>'),'Styles must survive document.body.innerHTML updates');
  const safe=gameDocument({kind:'standalone',title:'<script>alert(1)</script>',source:'document.body.textContent=1'});
  assert.doesNotMatch(safe, /data-title="<script>/);
});

test('Every game has a real restart button',()=>{
 assert.match(html,/id="retry-game"/);
 assert.match(script,/\$\('retry-game'\)\.addEventListener\('click'/);
 assert.match(script,/lastGame=game/);
 assert.match(script,/gameDocument\(lastGame\)/);
});
