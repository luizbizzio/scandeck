import { decodeGame, packHtml, packScript, packMicroQuiz, deflateRaw, base43Encode, QR_LIMIT } from './protocol.js';
import { gameDocument } from './runtime.js';
import { code128Svg, decodeCode128Svg } from './code128.js';
const $ = id => document.getElementById(id);
const show = (el, visible) => { $(el).hidden = !visible; };
const DEFAULT_BARCODES = ['qr_code','code_128','data_matrix','aztec','pdf417','maxi_code','micro_qr','rmqr'];
const WASM_FORMATS = ['QRCode','Code128','DataMatrix','Aztec','PDF417','MaxiCode','MicroQRCode','RMQRCode'];
const WASM_SCRIPT = 'vendor/zxing-wasm/index.js';
const QR_GENERATOR_URL = 'vendor/qrcode-generator.js';
let selectedGame = null;
let scanStream = null, live = false, cameraToken = 0, scanner = null, scanTimeout = null;
let generatorFormat = 'qr', outputData = null, lastGame = null;
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

async function acceptPayload(raw, mode='manual', format='') {
  try {
    const game = await decodeGame(raw);
    if(format==='MaxiCode'&&game.kind==='standalone')game.title='Perfect Timing';
    if(format==='RMQRCode'&&game.kind==='standalone')game.title='Codebreaker';
    if(format==='IRIS'&&game.kind==='standalone'&&game.source.startsWith("document.write('<p id=t>"))game.title='Wire Crisis';
    if(format==='IRIS'&&game.kind==='html'&&game.source.includes('CHROMA RUSH'))game.title='Chroma Rush';
    selectedGame = game;
    $('detected-title').textContent = game.title;
    $('detected-description').textContent = 'Ready to play.';
    $('detected-meta').replaceChildren();
    const labels={IRIS:'IRIS',qr_code:'QR Code',QRCode:'QR Code',code_128:'Code 128',Code128:'Code 128',data_matrix:'Data Matrix',DataMatrix:'Data Matrix',aztec:'Aztec Code',Aztec:'Aztec Code',PDF417:'PDF417',MaxiCode:'MaxiCode',MicroQRCode:'Micro QR',RMQRCode:'rMQR'};
    for (const label of [labels[format] || (game.kind==='micro'||game.kind==='standalone'||game.kind==='snake'?'Code 128':'2D game code')]) {
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
  lastGame=game;
  $('overlay-game-title').textContent=game.title;
  const hints={'Perfect Timing':'MATCH YOUR TARGET TIME IN MILLISECONDS','Codebreaker':'GUESS 0-98 · 7 TRIES · UP / DOWN','Pocket Maze':'RANDOM 6×6 MAZE · FIND THE STAR','Chroma Rush':'TAP THE INK COLOR, NOT THE WORD','Wire Crisis':'5 ROUNDS · REMEMBER 3-7 COLORS · BEAT THE CLOCK'};
  game.instructions=hints[game.title]||game.instructions||'';
  $('game-score').textContent=game.instructions;
  show('touch-controls',game.kind==='snake'||game.kind==='micro');
  show('game-overlay',true);
  // Never grant allow-same-origin, form submission, popups, or top navigation.
  $('game-frame').srcdoc = gameDocument(game);
  document.documentElement.style.overflow='hidden';
}
function closeGame() {
  lastGame=null;
  $('game-frame').srcdoc='';
  $('game-frame').removeAttribute('src');
  show('game-overlay',false);
  document.documentElement.style.overflow='';
}
$('exit-game').addEventListener('click',closeGame);
$('retry-game').addEventListener('click',()=>{if(lastGame){$('game-frame').srcdoc='';$('game-frame').srcdoc=gameDocument(lastGame)}});
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
async function getMatrixEngine() {
  const lib=await loadExternal(WASM_SCRIPT,'ZXingWASM');
  if (!lib.readBarcodes || !lib.writeBarcode) throw new Error('The matrix code engine is unavailable.');
  if (!lib.__scandeckReady) {
    lib.prepareZXingModule({overrides:{locateFile:(path,prefix)=>
      path.endsWith('.wasm')?new URL('vendor/zxing-wasm/'+path,document.baseURI).href:prefix+path}});
    lib.__scandeckReady=true;
  }
  return lib;
}
// The color IRIS decoder runs in a module worker to avoid blocking camera preview.
let irisWorker=null,irisSeq=0;
const irisPending=new Map();
function failIrisWorker(){
  if(irisWorker){irisWorker.terminate();irisWorker=null}
  for(const p of irisPending.values()){clearTimeout(p.timer);p.resolve('')}
  irisPending.clear();
}
function getIrisWorker(){
  if(!irisWorker){
    irisWorker=new Worker(new URL('./iris-worker.js',import.meta.url),{type:'module'});
    irisWorker.onmessage=({data})=>{
      const pending=irisPending.get(data?.id);
      if(!pending)return;
      clearTimeout(pending.timer);irisPending.delete(data.id);
      pending.resolve(typeof data.text==='string'?data.text:'');
    };
    irisWorker.onerror=failIrisWorker;
  }
  return irisWorker;
}
function readIrisPixels(image){
  const {width,height,data}=image;
  if(width*height>2_000_000)return Promise.resolve('');
  const rgb=new Uint8Array(width*height*3);
  for(let i=0,j=0;i<data.length;i+=4,j+=3){
    rgb[j]=data[i];rgb[j+1]=data[i+1];rgb[j+2]=data[i+2];
  }
  return new Promise(resolve=>{
    const id=++irisSeq;
    const timer=setTimeout(failIrisWorker,2500);
    irisPending.set(id,{resolve,timer});
    try{getIrisWorker().postMessage({id,width,height,buffer:rgb.buffer},[rgb.buffer])}
    catch{clearTimeout(timer);irisPending.delete(id);resolve('')}
  });
}

async function getScanner() {
  if (scanner) return scanner;
  if ('BarcodeDetector' in globalThis) {
    try {
      const formats=await BarcodeDetector.getSupportedFormats();
      if (DEFAULT_BARCODES.every(x=>formats.includes(x))) {
        scanner={kind:'native',engine:new BarcodeDetector({formats:DEFAULT_BARCODES})};
        return scanner;
      }
    } catch (_) { /* use the local WASM decoder */ }
  }
  const lib=await getMatrixEngine();
  scanner={kind:'wasm',engine:lib};
  return scanner;
}
const firstResult=results=>results.find(x=>x.text||x.rawValue);
const wasmOptions={formats:WASM_FORMATS,maxNumberOfSymbols:1,tryHarder:true};
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
async function cameraLoop(token,engine){
  // One scan per iteration: ZXing for standard codes, IRIS in an off-thread worker.
  while(live&&cameraToken===token&&!document.hidden){
    try{
      const video=$('camera');
      if(video.readyState>=2){
        const canvas=document.createElement('canvas');
        const width=video.videoWidth,height=video.videoHeight;
        const scale=Math.min(1,900/Math.max(width,height));
        canvas.width=Math.max(1,Math.round(width*scale));
        canvas.height=Math.max(1,Math.round(height*scale));
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(video,0,0,canvas.width,canvas.height);
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
        let text='',format='';
        if(engine.kind==='native'){
          const result=(await engine.engine.detect(video)).find(x=>x.rawValue);
          text=result?.rawValue||'';format=result?.format||'';
        }else{
          const result=firstResult(await engine.engine.readBarcodes(pixels,wasmOptions));
          text=result?.text||'';format=result?.format||'';
        }
        if(!text&&live&&cameraToken===token){
          text=await readIrisPixels(pixels);
          if(text)format='IRIS';
        }
        canvas.width=canvas.height=1;
        if(live&&token===cameraToken&&text&&await acceptPayload(text,'camera',format))return;
      }
    }catch(error){
      if(live&&token===cameraToken)status('Scanner error: '+error.message,true);
    }
    if(live&&token===cameraToken)await delay(450);
  }
}
$('start-camera').addEventListener('click',startCamera);
$('stop-camera').addEventListener('click',()=>{stopCamera();status('Camera stopped.')});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera()});
addEventListener('pagehide',stopCamera);
async function detectImage(file) {
  const engine=await getScanner();
  if(engine.kind==='native'){
    let bitmap;
    try {
      bitmap=await createImageBitmap(file);
      const hit=(await engine.engine.detect(bitmap)).find(x=>x.rawValue);
      if(hit)return {text:hit.rawValue,format:hit.format};
    } finally {bitmap?.close()}
  }
  const lib=engine.kind==='wasm'?engine.engine:await getMatrixEngine();
  try {
    const hit=firstResult(await lib.readBarcodes(file,wasmOptions));
    if(hit)return {text:hit.text,format:hit.format};
  } catch (_) { /* SVG and some image encodings need a browser bitmap */ }
  const bitmap=await createImageBitmap(file);
  const canvas=document.createElement('canvas');
  try {
    canvas.width=bitmap.width;canvas.height=bitmap.height;
    if (canvas.width*canvas.height>12000000) throw new Error('Image is too large to scan safely.');
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(bitmap,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    const hit=firstResult(await lib.readBarcodes(pixels,wasmOptions));
    if(hit)return {text:hit.text,format:hit.format};
    const iris=await readIrisPixels(pixels);
    if(iris)return {text:iris,format:'IRIS'};
  } finally {bitmap.close();canvas.width=canvas.height=1}
  throw Error('No supported game code was found in this image.');
}
async function uploadImage(file) {
  if(!file)return;
  if(file.size>15_000_000) {status('Image is larger than 15 MB. Choose a smaller image.',true);return}
  if(live)stopCamera();
  resetDetected();
  status('Reading image...');
  try { const hit=await detectImage(file);await acceptPayload(hit.text,'upload',hit.format) }
  catch(error){status(`Could not read the image: ${error.message}`,true)}
}
$('image-input').addEventListener('change',async e=>{await uploadImage(e.target.files?.[0]);e.target.value=''});
$('scan-viewport').addEventListener('dragover',e=>e.preventDefault());
$('scan-viewport').addEventListener('drop',e=>{e.preventDefault();void uploadImage(e.dataTransfer.files?.[0])});

$('try-snake').addEventListener('click',async()=>{
  try {
    const response=await fetch('assets/snake-code128.svg',{cache:'no-cache'});
    if(!response.ok)throw Error('Snake barcode not found.');
    const payload=decodeCode128Svg(await response.text());
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

async function playMatrixExample(name,title,format) {
  try {
    const response=await fetch('assets/'+name+'.png');
    if(!response.ok)throw Error('Game code image not found.');
    const engine=await getMatrixEngine();
    const hit=firstResult(await engine.readBarcodes(await response.blob(),{formats:[format],tryHarder:true,maxNumberOfSymbols:1}));
    if(!hit?.text)throw Error('Could not read the game from its code image.');
    const game=await decodeGame(hit.text);
    if(!['html','standalone','bytecode','maze'].includes(game.kind))throw Error('Unsupported embedded game program.');
    game.title=title;
    playGame(game);
  } catch(error) {switchTab('scan');status('Could not open '+title+': '+error.message,true)}
}
$('try-catch').addEventListener('click',()=>playMatrixExample('catch-datamatrix','Catch 10','DataMatrix'));
$('try-memory').addEventListener('click',()=>playMatrixExample('memory-aztec','Pattern Memory','Aztec'));
$('try-breakout').addEventListener('click',()=>playMatrixExample('breakout-pdf417','Brick Rush','PDF417'));
$('try-tap').addEventListener('click',()=>playMatrixExample('tap-maxicode','Perfect Timing','MaxiCode'));
$('try-micro').addEventListener('click',()=>playMatrixExample('math-microqr','Pocket Maze','MicroQRCode'));
$('try-rmqr').addEventListener('click',()=>playMatrixExample('math-rmqr','Codebreaker','RMQRCode'));

// Every IRIS Play button reads the generated image using the actual color decoder.
async function playIrisExample(name,title){
  try{
    const response=await fetch('assets/'+name+'.png');
    if(!response.ok)throw Error('IRIS image not found');
    const hit=await detectImage(await response.blob());
    if(hit.format!=='IRIS')throw Error('IRIS decoder did not read the image');
    const game=await decodeGame(hit.text);
    game.title=title;
    playGame(game);
  }catch(error){switchTab('scan');status('Could not scan '+title+': '+error.message,true)}
}
$('try-iris-chroma').addEventListener('click',()=>playIrisExample('iris-chroma','Chroma Rush'));
$('try-iris-wire').addEventListener('click',()=>playIrisExample('iris-wire','Wire Crisis'));

function selectGenerator(format) {
  generatorFormat=format;
  document.querySelectorAll('[data-format]').forEach(x=>x.classList.toggle('selected',x.dataset.format===format));
  const tiny=format==='microqr';
  const script=['bar','maxi','rmqr'].includes(format);
  $('create-label').textContent=tiny?'Program (maze bytecode)':script?'Game code (JavaScript)':'Game code (HTML)';
  $('create-source').placeholder=tiny?'M36509':script?'Paste standalone JavaScript here':'Paste a complete HTML game here';
  $('create-help').textContent=tiny?'Micro QR stores a seed and difficulty instruction. ScanDeck generates different solvable 6×6 mazes. This is bytecode, not standalone JavaScript.':
    format==='bar'?'Keep JavaScript short. Code 128 can become too wide to scan.':
    format==='maxi'?'MaxiCode holds only a very small standalone JavaScript program.':
    format==='rmqr'?'rMQR is rectangular. Keep standalone JavaScript very short.':
    format==='pdf'?'PDF417 holds a compact, self-contained HTML game.':
    format==='data-matrix'?'Data Matrix works best with small self-contained HTML games.':
    format==='aztec'?'Aztec Code can store a compact HTML game.':format==='iris'?'IRIS stores the full game in a colored circular symbol. Use ScanDeck to scan it.':'QR codes can store more game data.';
  document.querySelectorAll('[data-format]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.format===format)));
  $('create-source').value='';
  outputData=null;$('output-label').textContent='READY';$('output-stats').textContent='';$('generated-payload').value='';
  $('output-preview').replaceChildren();show('create-result',false);show('create-error',false);
  for(const id of ['download-code','copy-code','test-code'])$(id).disabled=true;
}
document.querySelectorAll('[data-format]').forEach(b=>b.addEventListener('click',()=>selectGenerator(b.dataset.format)));
$('use-example').addEventListener('click',async()=>{
  if(generatorFormat==='microqr'){
    $('create-source').value='M36509';
  }else if(!['bar','maxi','rmqr'].includes(generatorFormat)){
    $('create-source').value=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#101719;color:#b9ef79;display:grid;place-items:center;height:96vh;font:25px monospace"><button onclick="this.textContent='YOU WIN!'" style="padding:28px;background:#b9ef79;border:0">TAP TO WIN</button></body>`;
  } else {
    $('create-source').value="document.body.innerHTML='<button>Tap me</button>';document.querySelector('button').onclick=e=>e.target.textContent='You win!'";
  }
});
async function packIrisHtml(input){
  if(!/<(?:canvas|html|body|svg|div|script)\b/i.test(input))throw Error('Paste an HTML game, not plain text.');
  return 'SD1:'+base43Encode(await deflateRaw(input));
}
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
    const payload=generatorFormat==='microqr'?packMicroQuiz(input):['bar','maxi','rmqr'].includes(generatorFormat)?packScript(input):generatorFormat==='iris'?await packIrisHtml(input):await packHtml(input);
    let svg;
    if(generatorFormat==='qr'){
      const qrFactory=await loadExternal(QR_GENERATOR_URL,'qrcode');
      const qr=qrFactory(0,'L');qr.addData(payload,'Alphanumeric');qr.make();
      svg=displaySvg(qr.createSvgTag({cellSize:4,margin:4,scalable:true}));
    } else if(generatorFormat==='bar') {
      svg=displaySvg(code128Svg(payload));
    } else if(generatorFormat==='iris') {
      const {encodeColor,renderColorSVG}=await import('./vendor/iris/color.js');
      svg=displaySvg(renderColorSVG(encodeColor(payload,{markers:true}),{style:'slices'}));
    } else {
      const lib=await getMatrixEngine();
      const format=({ 'data-matrix':'DataMatrix',aztec:'Aztec',pdf:'PDF417',maxi:'MaxiCode',microqr:'MicroQRCode',rmqr:'RMQRCode' })[generatorFormat];
      if(!format)throw Error('Unsupported code format.');
      const result=await lib.writeBarcode(payload,{format,scale:5});
      svg=displaySvg(result.svg);
    }
    outputData={svg,payload,kind:generatorFormat};
    show('create-result',true);
    $('output-label').textContent='READY';
    $('output-stats').replaceChildren();
    for(const s of [generatorFormat==='bar'?(payload.length>190?'Code 128 is very wide and may not scan on a phone.':'Code 128 ready'):(generatorFormat==='microqr'?'Micro QR bytecode ready (requires ScanDeck interpreter)':generatorFormat.toUpperCase()+' game code ready'),payload.length+' encoded characters']){const span=document.createElement('span');span.textContent=s;$('output-stats').append(span)}
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