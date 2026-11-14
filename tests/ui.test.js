import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

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
  assert.match(html, /Download PNG/);
});

test('games show their actual QR and Code 128 images with full-size links', () => {
  for (const name of ['ironpass-micro-v3-qr.png','taprush-code128.png','dice-streak-micropdf417.png','neon-dodge-dotcode.png']) {
    assert.match(html, new RegExp('href="assets/' + name.replace('.', '\\.') + '"'));
    assert.match(html, new RegExp('src="assets/' + name.replace('.', '\\.') + '"'));
  }
  assert.match(html, /class="game-code-preview qr-code-preview"/);
  assert.match(html, /class="game-code-preview barcode-code-preview"/);
  assert.doesNotMatch(html, /class="game-art/);
  assert.match(script, /playMatrixExample\('dice-streak-micropdf417','Dice Streak','MicroPDF417'\)/);
  assert.match(script, /playMatrixExample\('taprush-code128','Tap Rush','Code128'\)/);
  assert.match(script, /fetch\('assets\/'\+name\+'\.txt'/);
  assert.match(script, /catalogPromises=new Map\(\)/);
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
  for(const code of ['pdf','micropdf417','maxi','microqr','rmqr','iris','chromaqr'])assert.ok(html.includes('data-format="'+code+'"'));
  assert.match(html, /ScanDeck · 1\.0\.0/);
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
  for (const id of ['scan-games','try-taprush','try-dice-streak','try-dotcode-dodge','try-ironpass','create-source','generate','use-example','download-code','test-code','copy-code','about-create','start-camera','stop-camera','image-input','play-detected','try-catch','try-memory','try-breakout','try-tap','try-micro','try-rmqr']) {
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
test('IRIS and ChromaQR use PNG files with separate format handlers',()=>{
  assert.ok(html.includes('id="iris-games-heading"'));
  assert.ok(html.includes('id="chroma-games-heading"'));
  assert.ok(html.includes('assets/iris-wire.png'));
  assert.ok(html.includes('assets/chromaqr-chroma.png'));
  assert.ok(!html.includes('iris-chroma.png'));
  for(const id of ['try-iris-wire','try-chromaqr-chroma']){
    assert.ok(html.includes('id="'+id+'"'));
    assert.ok(script.includes("$('"+id+"')"));
  }
  assert.ok(html.includes('data-format="chromaqr"'));
  assert.ok(script.includes('readIrisPixels('));
  assert.ok(script.includes('readChromaImage('));
  assert.ok(script.includes("format:'IRIS'"));
  assert.ok(script.includes("'ChromaQR'"));
  assert.ok(!script.includes('playColorExample('));
});

test('camera keeps detail and enables focused scanning for dense symbols',()=>{
  assert.match(script,/width:\{ideal:1920\}/);
  assert.match(script,/tryDownscale:false/);
  assert.match(script,/tryDenoise:true/);
  assert.match(script,/centeredIrisFrame\(video,frame%3===2\)/);
  assert.match(script,/FOCUS_FORMATS/);
  for(const name of ['pdf417','micropdf417','maxicode','rmqr','code128','iris','chromaqr'])
    assert.ok(html.includes('option value="'+name+'"'),name+' focused scanner option is available');
});

test('every displayed and downloadable game code uses PNG',()=>{
  const gallery=html.split('id="library"')[1].split('id="create"')[0];
  assert.ok(gallery.includes('assets/taprush-code128.png'));
  assert.ok(gallery.includes('assets/dice-streak-micropdf417.png'));
  assert.ok(gallery.includes('assets/neon-dodge-dotcode.png'));
  assert.match(gallery,/assets\/iris-wire\.png/);
  assert.match(gallery,/assets\/chromaqr-chroma\.png/);
  assert.match(html,/Download PNG/);
  assert.match(script,/svgToPng\(/);
  assert.match(script,/image\/png/);
  assert.match(script,/game\.png/);
});
test('standalone CSS is kept in the head when game rewrites body HTML',async()=>{
  const {gameDocument}=await import('../src/runtime.js');
  const doc=gameDocument({kind:'standalone',title:'Perfect Timing',instructions:'TAP WHEN 7',
    source:'document.body.innerHTML=7'});
  const head=doc.slice(0,doc.indexOf('</head>'));
  assert.match(head,/background:#0b1410/);
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

test('the arcade design presents time, attempts, wires and a centered brick field',async()=>{
 const {gameDocument}=await import('../src/runtime.js');
 const timing=gameDocument({kind:'standalone',title:'Perfect Timing',source:'n=1400;t=0;onclick=()=>alert(2)'});
 assert.match(timing,/YOUR TARGET/);
 assert.match(timing,/ELAPSED TIME/);
 assert.match(timing,/#sd-perfect/);
 const breaker=gameDocument({kind:'standalone',title:'Codebreaker',source:'document.write("Test")'});
 assert.match(breaker,/GUESSES LEFT/);
 assert.match(breaker,/UP ↑/);
 assert.match(breaker,/DOWN ↓/);
 const wire=gameDocument({kind:'standalone',title:'Wire Crisis',source:'document.write("Test")'});
 assert.match(wire,/MEMORIZE/);
 assert.match(wire,/TIME IS UP/);
 assert.match(wire,/button:nth-of-type/);
 const brick=gameDocument({kind:'html',title:'Brick Rush',source:'<canvas id=c></canvas>'});
 assert.match(brick,/align-items:center/);
 assert.match(brick,/justify-content:center/);
});

test('inline barcode buttons are closed before player UI scripts',async()=>{
 const {gameDocument}=await import('../src/runtime.js');
 const frame=gameDocument({kind:'standalone',title:'Codebreaker',source:"document.write('<input id=a><button id=b>GO')"});
 assert.match(frame,/<\/script><\/button><script>/);
});

test('arcade shell contains all games with a centered Snake and working replay controls',async()=>{
 assert.match(html,/class="game-app"/);assert.match(html,/class="game-viewport"/);
 assert.match(html,/sandbox="allow-scripts"/);assert.match(css,/\.game-app\{/);
 const {gameDocument}=await import('../src/runtime.js');
 assert.match(gameDocument({kind:'snake',source:'s=[27,26,25];f=45;I=180;T=()=>{}'}),/body\{display:grid;place-items:center\}/);
 assert.match(gameDocument({kind:'standalone',title:'Perfect Timing',source:'n=1400;t=0;onclick=()=>alert(2)'}),/PLAY AGAIN/);
 assert.match(gameDocument({kind:'standalone',title:'Codebreaker',source:'document.write("Test")'}),/THE CODE WAS/);
 const wire=gameDocument({kind:'standalone',title:'Wire Crisis',source:'document.write("Test")'});
 assert.match(wire,/1600/);assert.match(wire,/ROUND /);
});

test('mobile camera fills the viewport with a safe close button and scan format picker',()=>{
  assert.ok(html.includes('id="camera-mode"'));
  assert.ok(html.includes('id="camera-tip"'));
  const panel=html.indexOf('id="camera-panel"'),close=html.indexOf('id="stop-camera"'),actions=html.indexOf('class="scan-actions"');
  assert.ok(panel<close&&close<actions,'Stop must be inside camera preview, not scanner actions.');
  assert.match(css,/html\.camera-open \.camera-panel/);
  assert.match(css,/position:fixed!important/);
  assert.match(css,/height:100dvh/);
  assert.match(css,/safe-area-inset-top/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/\.camera-stage video\{object-fit:contain\}/);
  assert.match(script,/classList\.toggle\('camera-open'/);
  assert.match(script,/classList\.remove\('camera-open'\)/);
  assert.match(script,/\$\('camera-mode'\)\.addEventListener\('change'/);
});
test('focused rMQR and MaxiCode use additional camera preprocessing',()=>{
  assert.match(script,/makeFocusedPixels\(/);
  assert.match(script,/readFocused\(/);
  assert.match(script,/binarizer:useCrop\?'GlobalHistogram'/);
  assert.match(script,/isPure:monochrome/);
  assert.match(script,/maxicode:'MaxiCode must be flat/);
  assert.match(script,/rmqr:'Turn your phone sideways/);
});
test('Code 128 gallery contains the full Tap Rush JavaScript game',()=>{
  assert.ok(html.includes('id="try-taprush"'));
  assert.ok(html.includes('taprush-code128.png'));
  assert.ok(!html.includes('Lights Out'));
  assert.ok(!html.includes('lights-code128'));
  assert.match(script,/taprush-code128/);
});

test('MicroPDF417 and DotCode have scan focus, download PNG and real reader',()=>{
  for(const [format,id,asset] of [['micropdf417','try-dice-streak','dice-streak-micropdf417'],['dotcode','try-dotcode-dodge','neon-dodge-dotcode']]){
    assert.ok(html.includes('id="'+id+'"'));
    assert.ok(html.includes('assets/'+asset+'.png'));
    assert.ok(html.includes('data-format="'+format+'"'));
    assert.ok(html.includes('<option value="'+format+'">'));
    assert.ok(script.includes("$('"+id+"')"));
    assert.ok(script.includes("readExoticPixels("));
    assert.ok(script.includes("format==='dotcode'"));
    assert.ok(script.includes("MicroPDF417"));
  }
  assert.match(script,/exotic-worker\.js/);
  assert.doesNotMatch(html,/assets\/snake-qr\.png/);
});

test('Tap Rush is a five-second high-score challenge and its player shows a live counter',()=>{
  assert.ok(html.includes('Tap as fast as you can for five seconds'));
  assert.ok(!html.includes('Make ten taps in three seconds'));
  assert.ok(script.includes('AS MANY TAPS AS YOU CAN IN 5 SECONDS'));
  assert.ok(script.includes("game.source.startsWith('n=0;onclick=()=>n++||setTimeout')"),'Camera scans should get the correct Tap Rush title and scoreboard');
  const runtime=readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8');
  assert.ok(runtime.includes('sd-rush-count'));
  assert.ok(runtime.includes('sd-rush-clock'));
  assert.ok(runtime.includes('TAPS IN 5 SECONDS'));
});

test('Pocket Reflex is a complete 13-character Micro VM program in the Micro QR PNG',()=>{
  assert.ok(html.includes('Pocket Reflex'));
  assert.ok(!html.includes('Pocket Maze'));
  assert.ok(html.includes('assets/reflex-microqr.png'));
  assert.ok(!html.includes('assets/math-microqr.png'));
  assert.ok(script.includes("playMatrixExample('reflex-microqr','Pocket Reflex','MicroQRCode')"));
  assert.ok(script.includes('V1R4T3DIC+L0X'));
  assert.ok(script.includes('packMicroVm(input)'));
  assert.ok(script.includes("V1|LO:"));
  const runtime=readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8');
  assert.ok(runtime.includes("game.kind==='microvm'"));
  assert.ok(runtime.includes('microVmHtml'));
});

test('Scan header uses a compact, optional list instead of overflowing twelve format badges',()=>{
  assert.match(html, /<details class="scan-formats-details"><summary>12 code formats<\/summary>/);
  assert.match(css, /\.scan-formats-details/);
  assert.match(css, /\.scanner-heading\{position:relative/);
});
test('mobile and desktop scanner selectors contain every format exactly once and remain synchronized',()=>{
  const modes=['auto','qr','code128','datamatrix','aztec','pdf417','maxicode','microqr','rmqr','iris','chromaqr','micropdf417','dotcode'];
  for(const id of ['scan-mode','camera-mode']){
    const fragment=html.slice(html.indexOf('id="'+id+'"'));
    const select=fragment.slice(0,fragment.indexOf('</select>'));
    for(const mode of modes){
      const occurrences=select.match(new RegExp('<option value="'+mode+'">','g'))||[];
      assert.equal(occurrences.length,1,id+' should list '+mode+' exactly once');
    }
  }
  assert.match(script,/\$\('camera-mode'\)\.value=mode/);
  assert.match(script,/\$\('scan-mode'\)\.value=mode/);
});
test('camera preview starts before WASM initialization; expensive experimental formats require focus',()=>{
  const open=script.slice(script.indexOf('async function startCamera()'),script.indexOf('async function readChromaImage('));
  assert.ok(open.indexOf("show('camera-panel',true)")>=0);
  assert.doesNotMatch(open,/await getScanner\(\)/,'Do not initialize heavy WASM on the UI thread during camera opening');
  assert.match(script,/new Worker\(new URL\('\.\/barcode-worker\.js'/);
  assert.match(script,/if\(mode==='iris'\)/);
  assert.match(script,/if\(mode==='chromaqr'\)/);
  assert.doesNotMatch(script,/mode==='auto'&&frame%5===4/);
  assert.match(html,/Auto \(standard codes\)/);
});
test('library Play is fast, uses cached exact payload copies, and supports Micro VM programs',()=>{
  const item=script.slice(script.indexOf('async function readCatalogGame'),script.indexOf("$('try-catch')"));
  assert.match(item,/cache:'force-cache'/);
  assert.match(script,/bundledCatalog=JSON\.parse\(new TextDecoder\(\)\.decode\(bytes\)\)/);
  assert.match(script,/if\(bundledCatalog&&Object\.hasOwn/);
  assert.match(item,/catalogPromises\.set\(name,promise\)/);
  assert.match(item,/microvm/);
  assert.match(script,/openCatalogGame\('chromaqr-chroma','Chroma Rush'\)/);
  assert.match(script,/playMatrixExample\('reflex-microqr','Pocket Reflex','MicroQRCode'\)/);
  assert.doesNotMatch(item,/readBarcodes\(/);
  assert.match(html,/src\/app\.js\?v=52/);
  assert.match(html,/src\/style\.css\?v=52/);
});

test('expanding Paste game data cannot stretch the camera over the controls',()=>{
  const workspace=css.match(/\.scan-workspace\{([^}]*)\}/)?.[1]||'';
  const viewport=css.match(/\.scan-viewport\{([^}]*)\}/)?.[1]||'';
  const controls=css.match(/\.scan-controls\{([^}]*)\}/)?.[1]||'';
  assert.match(workspace,/align-items:start/,'grid items must not vertically stretch');
  assert.doesNotMatch(workspace,/align-items:stretch/);
  assert.match(viewport,/align-self:start/);
  assert.match(viewport,/width:100%/);
  assert.match(viewport,/max-width:100%/);
  assert.match(viewport,/height:auto/);
  assert.match(controls,/align-self:start/);
  assert.match(css,/\.manual-entry\[open\] \.manual-inner\{width:100%\}/);
  const scanner=html.slice(html.indexOf('class="scan-workspace"'),html.indexOf('</section>\n        <p class="scan-explore"'));
  assert.ok(scanner.indexOf('id="scan-viewport"')<scanner.indexOf('class="scan-controls"'));
  assert.ok(scanner.indexOf('class="scan-controls"')<scanner.indexOf('class="manual-entry"'));
});

test('Paste game data is a full-width section below the camera and scan controls',()=>{
  const scanner=html.slice(html.indexOf('<section class="surface scanner"'),html.indexOf('<p class="scan-explore">'));
  const status=scanner.indexOf('id="status"');
  const manual=scanner.indexOf('<details class="manual-entry">');
  assert.ok(manual>status,'manual input should follow the full camera and controls row');
  assert.match(scanner,/class="status"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<details class="manual-entry">/);
  assert.match(css,/\.scanner>\.manual-entry>\.manual-inner\{display:grid/);
  assert.match(css,/\.scanner>\.manual-entry textarea\{grid-column:1/);
  assert.match(css,/@media\(max-width:700px\)\{\s*\.scanner>\.manual-entry>\.manual-inner\{grid-template-columns:minmax\(0,1fr\)/);
});
test('game cards contain only gameplay descriptions, no experimental titles or technical notes',()=>{
  const gallery=html.slice(html.indexOf('id="library"'),html.indexOf('id="create"'));
  assert.doesNotMatch(gallery,/\(Experimental\)/);
  assert.doesNotMatch(gallery,/class="barcode-note"/);
  const cards=[...gallery.matchAll(/<article class="surface game-card">([\s\S]*?)<\/article>/g)];
  assert.equal(cards.length,12);
  for(const [,card] of cards){
    const body=card.split('<div class="game-body">')[1];
    assert.match(body,/^<h3>[^<]+<\/h3><p>[^<]+<\/p>/);
    const description=body.match(/^<h3>[^<]+<\/h3><p>([^<]+)<\/p>/)?.[1]||'';
    assert.ok(description.length>35);
    assert.doesNotMatch(description,/barcode|javascript|html|camera|symbol|standalone|code|embedded|decoder|experiment|scan/i);
  }
});
test('About explains origin and use of all 12 formats with history source links',()=>{
  const about=html.slice(html.indexOf('id="about"'),html.indexOf('</main>'));
  assert.match(about,/Meet the 12 code formats/);
  const cards=[...about.matchAll(/<article class="about-code-card">([\s\S]*?)<\/article>/g)];
  assert.equal(cards.length,12);
  for(const format of ['QR Code','Code 128','Codablock F','DotCode','Data Matrix','Aztec Code','PDF417','MaxiCode','Micro QR','rMQR','IRIS','ChromaQR']){
    assert.ok(cards.some(([,card])=>card.includes('<h3>'+format+'</h3>')),format+' must have a history card');
  }
  for(const [,card] of cards){
    assert.match(card,/class="about-code-heading"/);
    assert.match(card,/class="about-source"/);
    assert.match(card,/href="https:\/\//);
    assert.match(card,/rel="noopener noreferrer"/);
  }
  assert.match(about,/Only compatible game codes work/);
  assert.match(css,/\.about-types>\.about-code-card\{display:flex/);
});

test('mobile game buttons put Play above Download and View source',()=>{
  assert.match(css,/@media\(max-width:700px\)\{\s*\.game-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.game-actions>\.btn-primary\{grid-column:1\/-1;grid-row:1/);
  assert.match(css,/\.game-actions>a\.btn\{grid-column:1;grid-row:2/);
  assert.match(css,/\.game-actions>\.btn-source\{grid-column:2;grid-row:2/);
  const cards=[...html.matchAll(/<article class="surface game-card">([\s\S]*?)<\/article>/g)];
  assert.equal(cards.length,12);
  for(const [,card] of cards){
    const row=card.match(/<div class="game-actions">([\s\S]*?)<\/div>/)?.[1]||'';
    assert.ok(row.indexOf('btn-primary')>=0&&row.indexOf('btn-source')>row.indexOf('btn-primary'));
  }
});
test('footer has the centered creator credit and keeps version 1.0.0',()=>{
  assert.match(html,/<footer class="site-footer"><span class="footer-version">ScanDeck · 1\.0\.0<\/span>/);
  assert.match(html,/class="footer-credit">Created by <a href="https:\/\/github\.com\/luizbizzio"/);
  assert.match(css,/\.site-footer\{display:grid;grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/);
  assert.match(css,/\.footer-credit\{justify-self:center/);
});
test('About correctly explains Full, Partial and Bytecode without changing the game count',()=>{
  assert.match(html,/Six games contain a full HTML game/);
  assert.match(html,/Five contain complete JavaScript/);
  assert.match(html,/Pocket Reflex is Bytecode/);
  assert.match(html,/legend-bytecode/);
});

test('landscape mobile scanning keeps full-screen camera and supports rotated barcodes',()=>{
  assert.match(css,/@media\(max-width:700px\), \(pointer:coarse\)\{/);
  assert.match(css,/@media\(orientation:landscape\) and \(pointer:coarse\)/);
  assert.match(script,/function isMobileCamera\(\)/);
  assert.match(script,/matchMedia\('\(max-width:700px\), \(pointer:coarse\)'\)/);
  assert.match(script,/addEventListener\('orientationchange',syncCameraLayout\)/);
  assert.match(script,/addEventListener\('resize',syncCameraLayout\)/);
  assert.match(script,/document\.documentElement\.classList\.toggle\('camera-open',isMobileCamera\(\)\)/);
  assert.match(script,/\.\.\.wasmOptions,formats,tryHarder:false,tryDenoise:false,tryRotate:true/);
  assert.match(script,/isPure:monochrome/);
  assert.match(script,/tryRotate:true/);
  assert.match(script,/code128:'Scan upright or sideways/);
});

test('opening a hash URL never stops camera before workers and Play buttons initialize',()=>{
  const initial=script.lastIndexOf('if(location.hash) switchTab(location.hash.slice(1));');
  assert.ok(initial>0,'initial hash navigation must be present');
  for(const prerequisite of [
    'let irisWorker=null','const irisPending=new Map()',
    'const exoticWaiting=new Map()','const barcodePending=new Map()',
    "function stopCamera()", "$('try-breakout').addEventListener",
    "$('try-dotcode-dodge').addEventListener", "$('try-micro').addEventListener",
    "navigator.serviceWorker.register('sw.js')"
  ]){
    const position=script.indexOf(prerequisite);
    assert.ok(position>=0,prerequisite+' must exist');
    assert.ok(position<initial,prerequisite+' must initialize before initial hash navigation');
  }
  assert.equal(script.indexOf('if(location.hash) switchTab(location.hash.slice(1));'),initial,
    'hash navigation must not also run at module startup');
});

test('experimental upload processes full-resolution photos without discarding 2MP+ images',()=>{
 const photo=script.slice(script.indexOf('async function detectImage('),script.indexOf('async function uploadImage('));
 assert.match(photo,/const exoticImages=\[\]/);
 assert.match(photo,/captureDimensions\(bitmap\.width,bitmap\.height,'codablockf'\)/);
 assert.match(photo,/exoticImages\.push\(cx\.getImageData/);
 assert.match(photo,/for\(const phase of \[2,0\]\)/);
 assert.match(script,/getCapabilities\?\.\(\)/);
 assert.match(script,/focusMode\?\.includes\?\.\('continuous'\)/);
});

test('dense experimental camera uses direct full and cropped sensor pixels, not stretched images',()=>{
 assert.match(script,/exoticCaptureRegion\(canvas\.width,canvas\.height,frame\)/);
 assert.match(script,/ctx\.getImageData\(roi\.left,roi\.top,roi\.width,roi\.height\)/);
 assert.match(script,/Use the full-size PNG, not the small gallery preview/);
});

test('exotic gallery pictures open the original PNG directly',()=>{
  for(const name of ['snake-codablockf','neon-dodge-dotcode']){
    assert.ok(html.includes('href="assets/'+name+'.png"'));
    assert.doesNotMatch(html,new RegExp('href="assets/'+name+'\\.png" target="_blank"'));
    assert.ok(!html.includes('data-scan-ready="'+name+'"'));
  }
  assert.doesNotMatch(html,/id="scan-ready-dialog"/);
});
test('auto excludes ChromaQR decoding and keeps focused ChromaQR selection',()=>{
  assert.match(html,/Auto \(standard codes\)/);
  assert.doesNotMatch(html,/Auto \(standard codes \+ ChromaQR\)/);
  assert.ok(html.includes('<option value="chromaqr">ChromaQR</option>'));
  assert.doesNotMatch(script,/mode==='auto'&&frame%5===4/);
});


test('all code previews open an in-page dialog headed with the barcode type',()=>{
  assert.match(html,/id="code-image-dialog"/);
  assert.match(html,/id="code-image-full"/);
  assert.doesNotMatch(html,/id="code-image-zoom"/);
  assert.match(script,/event\.target\.closest\('a\.game-code-preview, a\.about-code-example'\)/);
  assert.match(script,/event\.preventDefault\(\)/);
  assert.match(script,/codeImageDialog\.showModal\(\)/);
  assert.match(script,/querySelector\('\.group-title'\)/);
  assert.match(script,/querySelector\('\.about-code-heading h3'\)/);
  assert.doesNotMatch(script,/codeImageDialog\.classList\.toggle\('actual-size'\)/);
  assert.doesNotMatch(css,/#code-image-dialog\.actual-size/);
  const gallery=html.slice(html.indexOf('<section class="page" id="library"'),html.indexOf('<section class="page" id="create"'));
  assert.equal((gallery.match(/class="game-code-preview/g)||[]).length,12);
  assert.equal((html.match(/class="about-code-example"/g)||[]).length,12);
});

test('MaxiCode/rMQR uploads get a pure-image pass and the camera dynamically limits CPU use',()=>{
 const upload=script.slice(script.indexOf('async function detectImage('),script.indexOf('async function uploadImage('));
 assert.match(upload,/for\(const format of \['MaxiCode','RMQRCode'\]\)/);
 assert.match(upload,/formats:\[format\],isPure:true/);
 assert.match(upload,/item=>isGamePayload\(item\.text\)/);
 assert.match(script,/slowDecodeBackoff=elapsed>750/);
 assert.match(script,/frameRate:\{ideal:24,max:30\}/);
});
