import { decodeGame, packHtml, packScript, QR_LIMIT } from './protocol.js';
import { gameDocument } from './runtime.js';
import { code128Svg } from './code128.js';
const $ = id => document.getElementById(id);
const show = (el, visible) => { $(el).hidden = !visible; };
const DEFAULT_BARCODES = ['code_128','qr_code'];
const ZXING_URL = 'https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js';
const QR_GENERATOR_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
let selectedGame = null;
let scanStream = null, live = false, cameraToken = 0, scanner = null, scanTimeout = null;
let generatorFormat = 'qr', outputData = null;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function status(message, error = false) { $('status-text').textContent = message; $('status').classList.toggle('error', error); }
function switchTab(tab) {
  if (!['scan','library','create','about'].includes(tab)) tab='scan';
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active', x.id===tab));
  document.querySelectorAll('[data-tab]').forEach(x=>{x.classList.toggle('active',x.dataset.tab===tab);x.setAttribute('aria-current',x.dataset.tab===tab?'page':'false')});
  if (tab!=='scan') { stopCamera(); status(''); }
  history.replaceState(null,'','#'+tab);
}
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', ()=>switchTab(b.dataset.tab)));
addEventListener('hashchange',()=>switchTab(location.hash.slice(1)));
if(location.hash) switchTab(location.hash.slice(1));

async function acceptPayload(raw, mode='manual') {
  try {
    const game = await decodeGame(raw);
    selectedGame = game;
    $('detected-title').textContent = game.title;
    $('detected-description').textContent = 'Ready to play.';
    $('detected-meta').replaceChildren();
    for (const label of [game.type.includes('QR') ? 'QR Code' : 'Code 128']) {
      const span=document.createElement('span'); span.textContent=label; $('detected-meta').append(span);
    }
    show('detected', true);
    status(`${game.title} is ready.`);
    if (mode==='camera') stopCamera();
    $('detected').scrollIntoView({behavior:'smooth',block:'nearest'});
    return true;
  } catch (error) {
    if(mode!=='camera')status(error.message||String(error), true);
    return false;
  }
}
$('decode-text').addEventListener('click',()=>{resetDetected();void acceptPayload($('paste-input').value)});
$('paste-input').addEventListener('keydown',e=>{if(e.ctrlKey&&e.key==='Enter'){resetDetected();void acceptPayload($('paste-input').value)}});
$('play-detected').addEventListener('click',()=>selectedGame&&playGame(selectedGame));
$('inspect-detected').addEventListener('click',()=>{
  if (!selectedGame) return;
  $('source-view').textContent=selectedGame.source;
  $('source-dialog').showModal();
});
$('close-source').addEventListener('click',()=>$('source-dialog').close());
$('about-create').addEventListener('click',()=>switchTab('create'));
$('scan-games').addEventListener('click',()=>switchTab('library'));
function resetDetected(){selectedGame=null;show('detected',false);}

function playGame(game) {
  stopCamera();
  $('overlay-game-title').textContent=game.title;
  $('game-score').textContent='';
  show('touch-controls',game.kind==='snake'||game.kind==='micro');
  show('game-overlay',true);
  // Never grant allow-same-origin, form submission, popups, or top navigation.
  $('game-frame').srcdoc = gameDocument(game);
  document.documentElement.style.overflow='hidden';
}
function closeGame() {
  $('game-frame').srcdoc='';
  $('game-frame').removeAttribute('src');
  show('game-overlay',false);
  document.documentElement.style.overflow='';
}
$('exit-game').addEventListener('click',closeGame);
addEventListener('keydown',e=>{
  if (e.key==='Escape' && !$('game-overlay').hidden) { closeGame(); return; }
  if ($('game-overlay').hidden) return;
  const k={ArrowUp:'U',ArrowDown:'D',ArrowLeft:'L',ArrowRight:'R',w:'U',a:'L',s:'D',d:'R'}[e.key];
  if(k){e.preventDefault();$('game-frame').contentWindow?.postMessage(k,'*')}
});
document.querySelectorAll('[data-dir]').forEach(button=>button.addEventListener('pointerdown',e=>{e.preventDefault();$('game-frame').contentWindow?.postMessage(button.dataset.dir,'*')}));
addEventListener('message',e=>{
  if (e.source !== $('game-frame').contentWindow || !e.data || typeof e.data!=='object')return;
  if (e.data.scandeck==='score') $('game-score').textContent=`SCORE ${String(e.data.value).slice(0,16)}`;
  if (e.data.scandeck==='end') $('game-score').textContent=String(e.data.value||'GAME OVER').slice(0,28);
});

async function loadExternal(url, globalName) {
  if (window[globalName]) return window[globalName];
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=url;script.async=true;
    script.onload=()=>window[globalName]?resolve(window[globalName]):reject(new Error(`Could not load ${globalName}.`));
    script.onerror=()=>reject(new Error('Could not load this tool. Check your connection and try again.'));
    document.head.append(script);
  });
}
async function getScanner() {
  if (scanner) return scanner;
  if ('BarcodeDetector' in globalThis) {
    try {
      const supported=await BarcodeDetector.getSupportedFormats();
      const formats=DEFAULT_BARCODES.filter(x=>supported.includes(x));
      if (formats.length===2) {scanner={kind:'native',engine:new BarcodeDetector({formats})};return scanner;}
    } catch (_) { /* try fallback */ }
  }
  const ZXingBrowser = await loadExternal(ZXING_URL,'ZXingBrowser');
  const reader = new ZXingBrowser.BrowserMultiFormatReader();
  scanner={kind:'zxing',engine:reader};return scanner;
}
function stopCamera() {
  cameraToken++;live=false;clearTimeout(scanTimeout);
  if(scanStream)scanStream.getTracks().forEach(track=>track.stop());scanStream=null;
  const video=$('camera');video.pause();video.srcObject=null;
  show('camera-panel',false);show('scan-idle',true);show('stop-camera',false);
  $('start-camera').disabled=false;$('stop-camera').disabled=true;
}
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia){status('Camera is not available here. You can upload an image instead.',true);return;}
  resetDetected();
  $('start-camera').disabled=true;status('Opening camera...');
  try {
    const engine=await getScanner();
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:20,max:24}},audio:false});
    scanStream=stream;$('camera').srcObject=stream;await $('camera').play();
    live=true;const token=++cameraToken;
    show('scan-idle',false);show('camera-panel',true);show('stop-camera',true);$('camera-label').textContent='SCANNING';
    $('stop-camera').disabled=false;status('Looking for a game code...');
    void cameraLoop(token,engine);
  } catch(error) {stopCamera();status('Could not open the camera. Check its permissions or upload an image.',true)}
}
async function cameraLoop(token, engine) {
  // Only one decode is active at any time. No requestAnimationFrame processing or parallel workers.
  while(live && cameraToken===token && !document.hidden){
    try {
      const video=$('camera');
      if(video.readyState>=2){
        let text='';
        if(engine.kind==='native'){
          const results=await engine.engine.detect(video);
          text=results.find(x=>x.rawValue)?.rawValue||'';
        }else{
          const canvas=document.createElement('canvas');
          const w=video.videoWidth,h=video.videoHeight,scale=Math.min(1,1050/Math.max(w,h));
          canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
          canvas.getContext('2d',{willReadFrequently:true}).drawImage(video,0,0,canvas.width,canvas.height);
          try{text=String((await engine.engine.decodeFromCanvas(canvas)).getText())}catch(_){/* no code in frame */}
          canvas.width=canvas.height=1;
        }
        if(live && token===cameraToken && text && await acceptPayload(text,'camera')) return;
      }
    } catch (error) {
      if(live&&token===cameraToken)status('Scanner error: '+error.message,true);
    }
    if(live && token===cameraToken) await delay(450);
  }
}
$('start-camera').addEventListener('click',startCamera);
$('stop-camera').addEventListener('click',()=>{stopCamera();status('Camera stopped.')});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera()});
addEventListener('pagehide',stopCamera);
async function detectImage(file) {
  const engine=await getScanner();
  if(engine.kind==='native'){
    let bitmap=null;
    try{bitmap=await createImageBitmap(file);const result=await engine.engine.detect(bitmap);if(result.length)return result[0].rawValue}finally{bitmap?.close()}
    // The native reader sometimes misses large QR codes; try ZXing once.
    const lib=await loadExternal(ZXING_URL,'ZXingBrowser');
    const reader=new lib.BrowserMultiFormatReader();
    const url=URL.createObjectURL(file);
    try{return String((await reader.decodeFromImageUrl(url)).getText())}finally{URL.revokeObjectURL(url)}
  }
  const url=URL.createObjectURL(file);
  try{return String((await engine.engine.decodeFromImageUrl(url)).getText())}finally{URL.revokeObjectURL(url)}
}
async function uploadImage(file) {
  if(!file)return;
  if(file.size>15_000_000) {status('Image is larger than 15 MB. Choose a smaller image.',true);return}
  if(live)stopCamera();
  resetDetected();
  status('Reading image...');
  try { const raw=await detectImage(file);if(!raw)throw Error('No barcode or QR code found.');await acceptPayload(raw,'upload') }
  catch(error){status(`Could not read the image: ${error.message}`,true)}
}
$('image-input').addEventListener('change',async e=>{await uploadImage(e.target.files?.[0]);e.target.value=''});
$('scan-viewport').addEventListener('dragover',e=>e.preventDefault());
$('scan-viewport').addEventListener('drop',e=>{e.preventDefault();void uploadImage(e.dataTransfer.files?.[0])});

$('try-snake').addEventListener('click',async()=>{
  try {
    const response=await fetch('assets/snake-code128.svg',{cache:'no-cache'});
    if(!response.ok)throw Error('Snake barcode not found.');
    const documentSvg=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
    const payload=documentSvg.getElementById('scandeck-payload')?.textContent;
    if(!payload)throw Error('Snake barcode data is missing.');
    const game=await decodeGame(payload);
    if(game.kind!=='standalone')throw Error('Snake barcode is not standalone.');
    game.title='Snake';
    playGame(game);
  }catch(error){switchTab('scan');status('Snake could not load: '+error.message,true)}
});
$('try-ironpass').addEventListener('click',async()=>{
  try{const response=await fetch('assets/ironpass-micro-v3.txt',{cache:'force-cache'});if(!response.ok)throw Error('Game payload not found.');playGame(await decodeGame(await response.text()))}
  catch(error){switchTab('scan');status('Ironpass could not load: '+error.message,true)}
});

function selectGenerator(format) {
  generatorFormat=format;
  document.querySelectorAll('[data-format]').forEach(x=>x.classList.toggle('selected',x.dataset.format===format));
  $('create-label').textContent=format==='qr'?'Game code (HTML)':'Game code (JavaScript)';
  $('create-source').placeholder=format==='qr'?'Paste your HTML game here':'Paste standalone JavaScript here';
  $('create-help').textContent=format==='qr'?'QR codes can store more game data.':'Use standalone JavaScript without ScanDeck helpers. Long barcodes can be difficult to scan.';
  document.querySelectorAll('[data-format]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.format===format)));
  $('create-source').value='';
  outputData=null;$('output-label').textContent='READY';$('output-stats').textContent='';$('generated-payload').value='';
  $('output-preview').replaceChildren();show('create-result',false);show('create-error',false);
  for(const id of ['download-code','copy-code','test-code'])$(id).disabled=true;
}
document.querySelectorAll('[data-format]').forEach(b=>b.addEventListener('click',()=>selectGenerator(b.dataset.format)));
$('use-example').addEventListener('click',async()=>{
  if(generatorFormat==='qr'){
    $('create-source').value=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#101719;color:#b9ef79;display:grid;place-items:center;height:96vh;font:25px monospace"><button onclick="this.textContent='YOU WIN!'" style="padding:28px;background:#b9ef79;border:0">TAP TO WIN</button></body>`;
  } else {
    $('create-source').value="document.body.innerHTML='<button>Tap me</button>';document.querySelector('button').onclick=e=>e.target.textContent='You win!'";
  }
});
function displaySvg(svg) {
  const box=$('output-preview');box.innerHTML=svg;
  const el=box.querySelector('svg');if(!el)throw Error('Image generation failed.');
  el.setAttribute('role','img');el.setAttribute('aria-label','Generated game code');
  if(!el.getAttribute('xmlns'))el.setAttribute('xmlns','http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(el);
}
$('generate').addEventListener('click',async()=>{
  const button=$('generate');button.disabled=true;button.textContent='Generating...';show('create-error',false);
  try {
    const input=$('create-source').value.trim();if(!input)throw Error('Add a game or try an example first.');
    const payload=generatorFormat==='qr'?await packHtml(input):packScript(input);
    let svg;
    if(generatorFormat==='qr'){
      const qrFactory=await loadExternal(QR_GENERATOR_URL,'qrcode');
      const qr=qrFactory(0,'L');qr.addData(payload,'Alphanumeric');qr.make();
      svg=displaySvg(qr.createSvgTag({cellSize:4,margin:4,scalable:true}));
    } else svg=displaySvg(code128Svg(payload));
    outputData={svg,payload,kind:generatorFormat};
    show('create-result',true);
    $('output-label').textContent='READY';
    $('output-stats').replaceChildren();
    for(const s of [generatorFormat==='qr'?'QR Code ready':payload.length>190?'Barcode is long. It may be difficult to scan with a camera.':'Code 128 barcode ready']){const span=document.createElement('span');span.textContent=s;$('output-stats').append(span)}
    $('generated-payload').value=payload;
    for(const id of ['download-code','copy-code','test-code'])$(id).disabled=false;
    $('create-result').scrollIntoView({behavior:'smooth',block:'nearest'});
  } catch(error) {
    $('create-error').textContent=error.message||'Could not make this code.';
    show('create-error',true);show('create-result',false);
    $('generated-payload').value='';
    outputData=null;for(const id of ['download-code','copy-code','test-code'])$(id).disabled=true;
  } finally {button.disabled=false;button.textContent='Generate code ↗'}
});
$('download-code').addEventListener('click',()=>{
  if(!outputData)return;
  const blob=new Blob([outputData.svg],{type:'image/svg+xml'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`scandeck-${outputData.kind}-game.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
});
$('copy-code').addEventListener('click',async()=>{
  if(!outputData)return;
  try{await navigator.clipboard.writeText(outputData.payload);$('output-label').textContent='COPIED'}
  catch(_){$('generated-payload').focus();$('generated-payload').select();$('output-label').textContent='SELECTED / CTRL+C'}
});
$('test-code').addEventListener('click',async()=>{if(outputData)try{playGame(await decodeGame(outputData.payload))}catch(error){$('output-label').textContent=error.message}});

if('serviceWorker' in navigator && location.protocol==='https:') {
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}