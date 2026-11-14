import { decodeGame, packHtml, packScript, packMicroQuiz, packMicroVm, packCompactHtml, packCompactScript, packDenseHtml, packDenseScript, deflateRaw, base43Encode, QR_LIMIT } from './protocol.js?v=60';
import { gameDocument } from './runtime.js?v=60';
import { code128Svg, decodeCode128Svg } from './code128.js';
import { encodeChroma,chromaSvg,decodeChromaPixels } from './chroma.js';
import { specialtyCandidates } from './specialty-candidates.js';
import { captureDimensions, focusedCrop, scanPause, exoticCaptureRegion } from './scanner-geometry.js?v=60';
const $ = id => document.getElementById(id);
const show = (el, visible) => { $(el).hidden = !visible; };
const DEFAULT_BARCODES = ['qr_code','code_128','data_matrix','aztec','pdf417','maxi_code','micro_qr','rmqr'];
const WASM_FORMATS = ['QRCode','Code128','DataMatrix','Aztec','PDF417','MicroPDF417','MaxiCode','MicroQRCode','RMQRCode'];
const WASM_SCRIPT = 'vendor/zxing-wasm/index.js';
const QR_GENERATOR_URL = 'vendor/qrcode-generator.js';
let selectedGame = null;
let scanStream = null, live = false, cameraToken = 0, scanner = null, scanTimeout = null;
let barcodeWorker=null,barcodeSequence=0,barcodeReads=0;
const barcodePending=new Map();
let generatorFormat = 'qr', outputData = null, lastGame = null;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let codeSizesRequest=null;
function formatCodeSize(bytes){
  return bytes<1024?bytes.toLocaleString('en-US')+' B':(bytes/1024).toFixed(1)+' KB';
}
async function loadCodeSizes(){
  // Production HTML already contains exact values supplied by the build.
  const rows=[...document.querySelectorAll('.code-metadata[data-code-asset]')];
  if(rows.every(row=>row.querySelector('[data-payload-size]').textContent!=='...'&&row.querySelector('[data-png-size]').textContent!=='...'))return;
  if(!codeSizesRequest){
    codeSizesRequest=fetch('assets/code-sizes.json?v=60',{cache:'no-store'})
      .then(response=>{if(!response.ok)throw Error('Code size manifest unavailable');return response.json()})
      .catch(error=>{codeSizesRequest=null;throw error});
  }
  try{
    const info=await codeSizesRequest;
    for(const row of document.querySelectorAll('.code-metadata[data-code-asset]')){
      const item=info[row.dataset.codeAsset];
      if(!item||!Number.isInteger(item.payloadBytes)||!Number.isInteger(item.pngBytes)||item.payloadBytes<1||item.pngBytes<1)continue;
      row.querySelector('[data-payload-size]').textContent=formatCodeSize(item.payloadBytes);
      row.querySelector('[data-png-size]').textContent=formatCodeSize(item.pngBytes);
    }
  }catch(error){
    for(const row of document.querySelectorAll('.code-metadata[data-code-asset]')){
      row.querySelector('[data-payload-size]').textContent='N/A';
      row.querySelector('[data-png-size]').textContent='N/A';
    }
  }
}
function status(message, error = false) { $('status-text').textContent = message; $('status').classList.toggle('error', error); }
function switchTab(tab) {
  if (!['scan','library','create','about'].includes(tab)) tab='scan';
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active', x.id===tab));
  document.querySelectorAll('[data-tab]').forEach(x=>{x.classList.toggle('active',x.dataset.tab===tab);x.setAttribute('aria-current',x.dataset.tab===tab?'page':'false')});
  if (tab!=='scan') { stopCamera(); status(''); }
  if(tab==='library')void loadCodeSizes();
  history.replaceState(null,'','#'+tab);
}
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', event=>{event.preventDefault();switchTab(b.dataset.tab)}));
addEventListener('hashchange',()=>switchTab(location.hash.slice(1)));
// Initial navigation runs after all module-level worker state is initialized.
void loadCodeSizes();

async function acceptPayload(raw, mode='manual', format='') {
  try {
    const game = await decodeGame(raw);
    if(format==='MicroPDF417'&&game.kind==='standalone'&&game.source.startsWith("s=0;document.write('<button id=b>ROLL"))game.title='Dice Streak';
    if(format==='MaxiCode'&&game.kind==='standalone')game.title='Perfect Timing';
    if(format==='RMQRCode'&&game.kind==='standalone')game.title='Codebreaker';
    if(['QRCode','qr_code','CodablockF'].includes(format)&&game.kind==='standalone'&&game.source.startsWith("b=document.body"))game.title='Snake';
    if((format==='Code128'||format==='code_128')&&game.kind==='standalone'&&game.source.startsWith('n=0;onclick=_=>n++'))game.title='Tap Rush';
    if(format==='DotCode'&&game.kind==='html'&&game.source.includes('DODGE ·'))game.title='Neon Dodge';
    if((format==='IRIS'||format==='ChromaQR')&&game.kind==='standalone'&&game.source.startsWith("document.write('<p id=t>"))game.title='Wire Crisis';
    if(format==='ChromaQR'&&game.kind==='html'&&game.source.includes('CHROMA RUSH'))game.title='Chroma Rush';
    selectedGame = game;
    $('detected-title').textContent = game.title;
    $('detected-description').textContent = 'Ready to play.';
    $('detected-meta').replaceChildren();
    const labels={IRIS:'IRIS',ChromaQR:'ChromaQR',CodablockF:'Codablock F',DotCode:'DotCode',qr_code:'QR Code',QRCode:'QR Code',code_128:'Code 128',Code128:'Code 128',data_matrix:'Data Matrix',DataMatrix:'Data Matrix',aztec:'Aztec Code',Aztec:'Aztec Code',PDF417:'PDF417',MicroPDF417:'MicroPDF417',MaxiCode:'MaxiCode',MicroQRCode:'Micro QR',RMQRCode:'rMQR'};
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
function getEmbeddingStatus(game){
  if(game.kind==='html')return {status:'full',label:'Full',format:'HTML game',
    description:'The full HTML game and its JavaScript are stored inside the code.'};
  if(['microvm','bytecode','maze','lights'].includes(game.kind))
    return {status:'bytecode',label:'Bytecode',format:'VM instructions',
      description:'The symbol contains the game instructions. ScanDeck provides the interpreter and interface needed to run them.'};
  return {status:'partial',label:'Partial',format:'JavaScript only',
    description:'The complete JavaScript game is stored in the code, but ScanDeck provides its HTML interface.'};
}
function showGameSource(game,title=game.title){
  const source=String(game.source||'');
  if(!source)throw Error('The game has no readable source data.');
  const embedding=getEmbeddingStatus(game);
  $('source-heading').textContent=title+' source';
  const badge=$('source-status');
  badge.className='code-embedding code-embedding-'+embedding.status;
  badge.querySelector('.code-tick').textContent=embedding.status==='bytecode'?'⌘':'✓';
  $('source-status-label').textContent=embedding.label;
  $('source-format').textContent=embedding.format;
  $('source-description').textContent=embedding.description+' The text below is the actual decoded program, not a substitute example.';
  $('source-view').textContent=source;
  $('copy-source').textContent='Copy code';
  if(!$('source-dialog').open)$('source-dialog').showModal();
}
$('inspect-detected').addEventListener('click',()=>{
  if(selectedGame)showGameSource(selectedGame);
});
$('copy-source').addEventListener('click',async()=>{
  const button=$('copy-source');
  try{
    await navigator.clipboard.writeText($('source-view').textContent||'');
    button.textContent='Copied';
  }catch(error){
    button.textContent='Copy failed';
  }
  setTimeout(()=>{button.textContent='Copy code'},1600);
});
$('close-source').addEventListener('click',()=>$('source-dialog').close());
$('about-create').addEventListener('click',()=>switchTab('create'));
$('scan-games').addEventListener('click',()=>switchTab('library'));
function resetDetected(){selectedGame=null;show('detected',false);}

function playGame(game) {
  stopCamera();
  lastGame=game;
  $('overlay-game-title').textContent=game.title;
  const hints={'Dice Streak':'ROLL THE DICE · A 1 ENDS YOUR STREAK','Tap Rush':'AS MANY TAPS AS YOU CAN IN 5 SECONDS · FIRST TAP STARTS TIMER','Neon Dodge':'TAP TO CHANGE LANES · AVOID THE RED BLOCKS','Lights Out':'FLIP THE LIGHTS · SOLVE THE 4×4 GRID','Snake':'ARROWS / SWIPE · EAT THE FOOD','Perfect Timing':'MATCH YOUR TARGET TIME IN MILLISECONDS','Codebreaker':'GUESS 0-98 · 7 TRIES · UP / DOWN','Pocket Reflex':'FIND THE MATCHING NUMBER · ENDLESS SCORE · FASTER EACH POINT','Chroma Rush':'TAP THE INK COLOR, NOT THE WORD','Wire Crisis':'5 ROUNDS · REMEMBER 3-7 COLORS · BEAT THE CLOCK'};
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
  if(e.key==='Escape'&&live){stopCamera();return}
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
let irisWorker=null,irisSeq=0,irisReads=0;
const irisPending=new Map();
function failIrisWorker(){
  if(irisWorker){irisWorker.terminate();irisWorker=null}
  irisReads=0;
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
      if(++irisReads>=16&&irisPending.size===0){
        irisWorker.terminate();irisWorker=null;irisReads=0;
      }
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
    const timer=setTimeout(failIrisWorker,3800);
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
const wasmOptions={formats:WASM_FORMATS,maxNumberOfSymbols:1,tryHarder:true,tryRotate:true,tryInvert:true,tryDenoise:true,tryDownscale:false};
const FOCUS_FORMATS={qr:'QRCode',code128:'Code128',datamatrix:'DataMatrix',aztec:'Aztec',pdf417:'PDF417',micropdf417:'MicroPDF417',maxicode:'MaxiCode',microqr:'MicroQRCode',rmqr:'RMQRCode'};
const scanFocus=()=> $('scan-mode').value;
const focusTips={
  auto:'Standard QR, barcodes and matrix codes. Select specialty formats manually.',
  qr:'Keep the complete QR Code centered.',
  datamatrix:'Keep the complete square Data Matrix in view.',
  aztec:'Center the Aztec symbol and keep it sharp.',
  microqr:'Move closer to the small Micro QR without cutting off the edges.',
  rmqr:'Turn your phone sideways if needed. Keep the entire rectangular rMQR sharply focused.',
  maxicode:'MaxiCode must be flat, upright and almost fill the square.',
  pdf417:'Try landscape. Keep every PDF417 row visible and focus on the fine bars.',
  micropdf417:'Keep every bar and both white margins visible. Try landscape if the code is small.',
  code128:'Scan upright or sideways. Keep every bar and both white side margins visible.',
  iris:'Center the colored circular code in the frame.',
  chromaqr:'Center the full colored QR symbol.',
  dotcode:'Open the full-size PNG on another screen. Keep all dots visible, sharp and evenly lit.'
};
function setScanFocus(mode){
  if(!['auto','qr','code128','datamatrix','aztec','pdf417','micropdf417','maxicode','microqr','rmqr','iris','chromaqr','codablockf','dotcode'].includes(mode))mode='auto';
  $('scan-mode').value=mode;
  $('camera-mode').value=mode;
  $('camera-panel').dataset.focus=mode;
  const selected=$('scan-mode').selectedOptions[0]?.textContent||'All formats';
  $('camera-label').textContent=mode==='auto'?'SCANNING':'SCANNING · '+selected.toUpperCase();
  $('camera-tip').textContent=focusTips[mode];
  if(live)status('Scanning '+selected+'. '+focusTips[mode]);
}
$('scan-mode').addEventListener('change',()=>setScanFocus($('scan-mode').value));
$('camera-mode').addEventListener('change',()=>setScanFocus($('camera-mode').value));
setScanFocus('auto');
function isMobileCamera(){
  return matchMedia('(max-width:700px), (pointer:coarse)').matches;
}
function syncCameraLayout(){
  if(live)document.documentElement.classList.toggle('camera-open',isMobileCamera());
}
addEventListener('resize',syncCameraLayout);
addEventListener('orientationchange',syncCameraLayout);
function centeredIrisFrame(video,full=false){
  const w=video.videoWidth,h=video.videoHeight,side=Math.min(w,h);
  const scale=full?Math.min(1,1200/Math.max(w,h),Math.sqrt(1_350_000/(w*h))):Math.min(1,1200/side);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round((full?w:side)*scale));
  canvas.height=Math.max(1,Math.round((full?h:side)*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=false;
  if(full)ctx.drawImage(video,0,0,w,h,0,0,canvas.width,canvas.height);
  else ctx.drawImage(video,(w-side)/2,(h-side)/2,side,side,0,0,canvas.width,canvas.height);
  return canvas;
}
// A worker does expensive barcode decoding, keeping the camera preview responsive.
function stopBarcodeWorker(){
  if(barcodeWorker){barcodeWorker.terminate();barcodeWorker=null}
  barcodeReads=0;
  for(const job of barcodePending.values()){
    clearTimeout(job.timer);job.resolve(job.mode==='chroma'?'':[]);
  }
  barcodePending.clear();
}
function getBarcodeWorker(){
  if(!barcodeWorker){
    barcodeWorker=new Worker(new URL('./barcode-worker.js',import.meta.url));
    barcodeWorker.onmessage=({data})=>{
      const job=barcodePending.get(data?.id);
      if(!job)return;
      clearTimeout(job.timer);barcodePending.delete(data.id);
      // WASM memory can grow with varied frame sizes over long camera sessions.
      // Recycle only after this job finishes, never while a decode is pending.
      if(++barcodeReads>=40&&barcodePending.size===0){
        barcodeWorker.terminate();barcodeWorker=null;barcodeReads=0;
      }
      job.resolve(job.mode==='chroma'?(typeof data.result==='string'?data.result:''):(Array.isArray(data.result)?data.result:[]));
    };
    barcodeWorker.onerror=stopBarcodeWorker;
    barcodeWorker.onmessageerror=stopBarcodeWorker;
  }
  return barcodeWorker;
}
function requestBarcodeWorker(pixels,mode='standard',options={}){
  return new Promise(resolve=>{
    const {width,height,data}=pixels;
    if(!width||!height||data.length!==width*height*4){resolve(mode==='chroma'?'':[]);return}
    const id=++barcodeSequence;
    const timer=setTimeout(stopBarcodeWorker,options.formats?.length===1?4500:2300);
    barcodePending.set(id,{resolve,timer,mode});
    try{getBarcodeWorker().postMessage({id,mode,width,height,buffer:data.buffer,options},[data.buffer])}
    catch{stopBarcodeWorker()}
  });
}
const readCameraBarcodes=(pixels,options)=>requestBarcodeWorker(pixels,'standard',options);
const readCameraChroma=pixels=>requestBarcodeWorker(pixels,'chroma');
function stopCamera() {
  cameraToken++;live=false;clearTimeout(scanTimeout);
  stopBarcodeWorker();failIrisWorker();resetExoticWorker();
  if(scanStream)scanStream.getTracks().forEach(track=>track.stop());scanStream=null;
  const video=$('camera');video.pause();video.srcObject=null;
  show('camera-panel',false);show('scan-idle',true);show('stop-camera',false);
  document.documentElement.classList.remove('camera-open');
  $('start-camera').disabled=false;$('stop-camera').disabled=true;
}
async function startCamera() {
  if(!navigator.mediaDevices?.getUserMedia){
    status('Camera is unavailable. You can upload a PNG instead.',true);
    return;
  }
  resetDetected();
  const token=++cameraToken;
  $('start-camera').disabled=true;
  status('Opening camera...');
  try{
    // Start camera preview before loading the WASM scanner so the screen responds immediately.
    const stream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:24,max:30}},
      audio:false
    });
    if(token!==cameraToken){stream.getTracks().forEach(t=>t.stop());return}
    scanStream=stream;
    // Request continuous hardware autofocus on devices that advertise it.
    // Unsupported constraints must never prevent the camera from opening.
    try{
      const track=stream.getVideoTracks()[0],caps=track?.getCapabilities?.();
      if(caps?.focusMode?.includes?.('continuous'))
        void track.applyConstraints({advanced:[{focusMode:'continuous'}]}).catch(()=>{});
    }catch{}
    $('camera').srcObject=stream;
    await $('camera').play();
    if(token!==cameraToken){stopCamera();return}
    live=true;
    show('scan-idle',false);
    show('camera-panel',true);
    show('stop-camera',true);
    $('stop-camera').disabled=false;
    document.documentElement.classList.toggle('camera-open',isMobileCamera());
    setScanFocus(scanFocus());
    status('Camera ready. Initializing code reader...');
    if(!live||token!==cameraToken)return;
    status('Camera ready. '+focusTips[scanFocus()]);
    void cameraLoop(token);
  }catch(error){
    if(token===cameraToken){
      stopCamera();
      status('Could not open the camera or scanner: '+(error.message||'Check permissions and refresh.'),true);
    }
  }
}
async function readChromaImage(image){
  const engine=await getMatrixEngine();
  return decodeChromaPixels(image,(pixels,options)=>engine.readBarcodes(pixels,options));
}
function isGamePayload(text){
  return /^(?:V1|LO:|SD1:|SDC:|SDB:|SDH:|SDY:|SDZ:|SDS:|SDJ:|IP3:|MQ:|s=\[)/.test(text||'');
}
// Experimental decoders run off-thread; no image data is sent to a server.
let exoticWorker=null,exoticSeq=0;
const exoticWaiting=new Map();
function resetExoticWorker(){
  if(exoticWorker){exoticWorker.terminate();exoticWorker=null}
  for(const pending of exoticWaiting.values()){
    clearTimeout(pending.timer);pending.resolve('');
  }
  exoticWaiting.clear();
}
function getExoticWorker(){
  if(!exoticWorker){
    exoticWorker=new Worker(new URL('./exotic-worker.js',import.meta.url),{type:'module'});
    exoticWorker.onmessage=({data})=>{
      const pending=exoticWaiting.get(data?.id);
      if(!pending)return;
      clearTimeout(pending.timer);
      exoticWaiting.delete(data.id);
      pending.resolve(typeof data.text==='string'?data.text:'');
    };
    exoticWorker.onerror=resetExoticWorker;
  }
  return exoticWorker;
}
function readExoticPixels(image,format,exact=false,phase=0){
  const {width,height,data}=image;
  if(!['codablockf','dotcode'].includes(format)||!width||!height||
    width*height>2_000_000||data?.length!==width*height*4)return Promise.resolve('');
  const rgba=new Uint8ClampedArray(data); // don't detach ZXing's camera image
  return new Promise(resolve=>{
    const id=++exoticSeq;
    const timer=setTimeout(resetExoticWorker,9000);
    exoticWaiting.set(id,{timer,resolve});
    try{getExoticWorker().postMessage({id,format,width,height,buffer:rgba.buffer,exact,phase},[rgba.buffer])}
    catch{clearTimeout(timer);exoticWaiting.delete(id);resolve('')}
  });
}

// An alternate centered crop helps dense PDF417/rMQR and frontal MaxiCode.
// The full frame is always tried too, so cropped quiet zones cannot block scanning.
function makeFocusedPixels(image,mode,monochrome=false,phase=0){
  const w=image.width,h=image.height;
  const roi=focusedCrop(w,h,mode,phase);
  const canvas=document.createElement('canvas');
  canvas.width=roi.outputWidth;canvas.height=roi.outputHeight;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(image,roi.left,roi.top,roi.width,roi.height,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  if(monochrome){
    const data=pixels.data;
    let min=255,max=0;
    for(let i=0;i<data.length;i+=4){
      const gray=(data[i]*77+data[i+1]*150+data[i+2]*29)>>8;
      min=Math.min(min,gray);max=Math.max(max,gray);
    }
    const threshold=Math.round(min+(max-min)*.54);
    for(let i=0;i<data.length;i+=4){
      const v=((data[i]*77+data[i+1]*150+data[i+2]*29)>>8)>threshold?255:0;
      data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
    }
  }
  canvas.width=canvas.height=1;
  return pixels;
}
async function readFocused(lib,source,mode,frame){
  const format=FOCUS_FORMATS[mode];
  if(!format)return null;
  const useCrop=mode==='maxicode'?frame%4!==0:mode==='rmqr'?frame%3===1:(mode==='pdf417'||mode==='micropdf417')&&frame%3===1;
  const monochrome=mode==='maxicode'&&useCrop&&frame%4===2;
  const pix=useCrop?makeFocusedPixels(source,mode,monochrome,frame):
    source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,source.width,source.height);
  const opts={
    ...wasmOptions,formats:[format],
    binarizer:useCrop?'GlobalHistogram':'LocalAverage',
    isPure:monochrome, // Only one centered MaxiCode pass assumes a clean aligned image.
    minLineCount:mode==='code128'?1:2,
    tryDownscale:false, // Preserve rMQR locator detail at phone camera resolution.
    tryDenoise:false, // expensive morphology hurts continuous camera scans
    tryRotate:true,
    retryBinarizer:(mode==='rmqr'||mode==='maxicode')&&frame%4===0,
    specialty:mode==='rmqr'||mode==='maxicode'?mode:null,
    retryRotated:mode==='code128'?frame%3===0:(mode==='rmqr'||mode==='maxicode')&&frame%3===2
  };
  const result=(await lib.readBarcodes(pix,opts)).find(item=>isGamePayload(item.text));
  return result||null;
}
// Native detection can read some difficult linear codes without an extra WASM pass.
let nativeFocusPromise=null;
async function detectNativeFocused(mode,video){
  const names={code128:'code_128',pdf417:'pdf417',maxicode:'maxi_code',rmqr:'rmqr'};
  const format=names[mode];
  if(!format||!('BarcodeDetector' in globalThis))return null;
  if(!nativeFocusPromise)nativeFocusPromise=(async()=>{
    try{
      const supported=await BarcodeDetector.getSupportedFormats();
      return new Map(supported.map(name=>[name,new BarcodeDetector({formats:[name]})]));
    }catch{return new Map()}
  })();
  const detector=(await nativeFocusPromise).get(format);
  if(!detector)return null;
  try{return (await detector.detect(video)).find(result=>isGamePayload(result.rawValue))||null}
  catch{return null}
}
async function cameraLoop(token){
  let frame=0,slowDecodeBackoff=0;
  // Reuse the capture surface. Native BarcodeDetector can work directly on video.
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  try{
    while(live&&cameraToken===token&&!document.hidden){
      const video=$('camera');
      if(video.readyState>=2&&video.videoWidth&&video.videoHeight){
        try{
          const mode=scanFocus(),focused=FOCUS_FORMATS[mode];
          const decodeStarted=performance.now();
          if(frame%2===0){
            const native=await detectNativeFocused(mode,video);
            if(live&&token===cameraToken&&native&&await acceptPayload(native.rawValue,'camera',native.format))return;
          }
          if(mode==='iris'){
            // IRIS is color-sensitive and benefits from the centered square source.
            const crop=centeredIrisFrame(video,frame%3===2);
            try{
              const iris=await readIrisPixels(crop.getContext('2d',{willReadFrequently:true}).getImageData(0,0,crop.width,crop.height));
              if(live&&token===cameraToken&&iris&&await acceptPayload(iris,'camera','IRIS'))return;
            }finally{crop.width=crop.height=1}
          }else{
            const size=captureDimensions(video.videoWidth,video.videoHeight,mode);
            if(canvas.width!==size.width||canvas.height!==size.height){
              canvas.width=size.width;canvas.height=size.height;
            }
            ctx.drawImage(video,0,0,canvas.width,canvas.height);
            if(mode==='auto'||focused){
              const lib={readBarcodes:readCameraBarcodes};
              let result;
              if(['rmqr','maxicode','pdf417','micropdf417','code128'].includes(mode)){
                result=await readFocused(lib,canvas,mode,frame);
              }else{
                const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
                const formats=focused?[focused]:frame%3===0
                  ?['QRCode','DataMatrix','Aztec','Code128']
                  :frame%3===1?['PDF417','MicroPDF417','RMQRCode','MicroQRCode']:['MaxiCode'];
                result=(await lib.readBarcodes(pixels,{
                  ...wasmOptions,formats,tryHarder:false,tryDenoise:false,tryRotate:true
                })).find(x=>isGamePayload(x.text));
              }
              const raw=result?.text||result?.rawValue;
              if(live&&token===cameraToken&&raw&&await acceptPayload(raw,'camera',result.format))return;
            }else if(mode==='chromaqr'){
              const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
              const chroma=await readCameraChroma(pixels);
              if(live&&token===cameraToken&&chroma&&await acceptPayload(chroma,'camera','ChromaQR'))return;
            }else if(mode==='codablockf'||mode==='dotcode'){
              // No software zoom: direct image pixels preserve tiny bars and dots.
              // Alternate a full frame with two centered crops; the latter
              // reject background noise without interpolating the barcode.
              const roi=exoticCaptureRegion(canvas.width,canvas.height,frame);
              const pixels=ctx.getImageData(roi.left,roi.top,roi.width,roi.height);
              const experimental=await readExoticPixels(pixels,mode,false,frame%5);
              if(live&&token===cameraToken&&experimental&&await acceptPayload(experimental,'camera',mode==='codablockf'?'CodablockF':'DotCode'))return;
            }
          }
          const elapsed=performance.now()-decodeStarted;
          slowDecodeBackoff=elapsed>750
            ?Math.min(800,slowDecodeBackoff+140)
            :Math.max(0,slowDecodeBackoff-70);
          frame++;
        }catch(error){
          if(live&&token===cameraToken)status('Scanner error: '+error.message,true);
        }
      }
      if(live&&token===cameraToken)await delay(scanPause(scanFocus())+slowDecodeBackoff);
    }
  }finally{canvas.width=canvas.height=1}
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
      if(hit&&isGamePayload(hit.rawValue))return {text:hit.rawValue,format:hit.format};
    } finally {bitmap?.close()}
  }
  const lib=engine.kind==='wasm'?engine.engine:await getMatrixEngine();
  // PNG uploads are already isolated symbols. The MaxiCode reader needs this
  // explicit pure-image pass; all-format scanning can fail on clean MaxiCode.
  for(const format of ['MaxiCode','RMQRCode']){
    try{
      const isolated=await lib.readBarcodes(file,{
        ...wasmOptions,formats:[format],isPure:true,
        tryHarder:false,tryDownscale:false,tryDenoise:false
      });
      const hit=isolated.find(item=>isGamePayload(item.text));
      if(hit)return {text:hit.text,format:hit.format};
    }catch{/* Continue with the next image reader. */}
  }
  try {
    const hit=firstResult(await lib.readBarcodes(file,wasmOptions));
    if(hit&&isGamePayload(hit.text))return {text:hit.text,format:hit.format};
  } catch (_) { /* SVG and some image encodings need a browser bitmap */ }
  const bitmap=await createImageBitmap(file);
  const canvas=document.createElement('canvas');
  try {
    canvas.width=bitmap.width;canvas.height=bitmap.height;
    if (canvas.width*canvas.height>12000000) throw new Error('Image is too large to scan safely.');
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(bitmap,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    let hit;
    try{hit=firstResult(await lib.readBarcodes(pixels,wasmOptions))}
    catch(_){/* An unknown experimental format must not abort IRIS detection. */}
    if(hit&&isGamePayload(hit.text))return {text:hit.text,format:hit.format};
    // Match the camera worker's white-card recovery for uploaded photographs.
    // Downscale only very large photos; do not smooth already small symbols.
    const specialtyCanvas=document.createElement('canvas');
    let specialtyPixels=pixels;
    if(pixels.width*pixels.height>2_400_000){
      const factor=Math.sqrt(2_100_000/(pixels.width*pixels.height));
      specialtyCanvas.width=Math.max(1,Math.floor(pixels.width*factor));
      specialtyCanvas.height=Math.max(1,Math.floor(pixels.height*factor));
      const specialtyCtx=specialtyCanvas.getContext('2d',{willReadFrequently:true});
      specialtyCtx.drawImage(canvas,0,0,specialtyCanvas.width,specialtyCanvas.height);
      specialtyPixels=specialtyCtx.getImageData(0,0,specialtyCanvas.width,specialtyCanvas.height);
    }
    try{
      for(const specialtyFormat of ['rmqr','maxicode']){
        for(const candidate of specialtyCandidates(specialtyPixels,specialtyFormat)){
          try{
            const hits=await lib.readBarcodes(candidate.image,{
              ...wasmOptions,formats:[FOCUS_FORMATS[specialtyFormat]],...candidate.options,
              tryRotate:specialtyFormat==='rmqr',tryHarder:specialtyFormat==='rmqr',
              tryDownscale:false,tryDenoise:false
            });
            const match=hits.find(item=>isGamePayload(item.text));
            if(match)return {text:match.text,format:match.format};
          }catch{/* Continue with other candidate images. */}
        }
      }
    }finally{specialtyCanvas.width=specialtyCanvas.height=1}
    // Camera screenshots and photos may need a centered, monochrome pass.
    for(const focusedFormat of ['rmqr','maxicode','pdf417','micropdf417']){
      // Upload decoding uses both uncropped pixels and centered subject passes.
      for(const phase of [0,1,2]){
        const focused=await readFocused(lib,canvas,focusedFormat,phase);
        if(focused)return {text:focused.text,format:focused.format};
      }
    }
    // High-resolution photos often exceed the worker's 2 MP safety bound.
    // Retain a full-view and a zoomed center view, both under the bound,
    // so the matrix reader actually receives their pixels.
    const exoticImages=[];
    if(pixels.width*pixels.height<=1_900_000)exoticImages.push(pixels);
    else{
      const work=document.createElement('canvas'),cx=work.getContext('2d',{willReadFrequently:true});
      const size=captureDimensions(bitmap.width,bitmap.height,'codablockf');
      work.width=size.width;work.height=size.height;
      cx.drawImage(bitmap,0,0,work.width,work.height);
      exoticImages.push(cx.getImageData(0,0,work.width,work.height));
      const ratio=.70;
      const boxW=bitmap.width*ratio,boxH=bitmap.height*ratio;
      cx.clearRect(0,0,work.width,work.height);
      cx.drawImage(bitmap,(bitmap.width-boxW)/2,(bitmap.height-boxH)/2,boxW,boxH,0,0,work.width,work.height);
      exoticImages.push(cx.getImageData(0,0,work.width,work.height));
      work.width=work.height=1;
    }
    for(const exotic of ['codablockf','dotcode']){
      const format=exotic==='codablockf'?'CodablockF':'DotCode';
      if(pixels.width*pixels.height<=1_900_000){
        const exact=await readExoticPixels(pixels,exotic,true);
        if(exact)return {text:exact,format};
      }
      for(const candidate of exoticImages){
        // Perspective and upright-grid retries use the same strict checksum.
        for(const phase of [2,0]){
          const found=await readExoticPixels(candidate,exotic,false,phase);
          if(found)return {text:found,format};
        }
      }
    }
    const chroma=await readChromaImage(pixels);
    if(chroma)return {text:chroma,format:'ChromaQR'};
    // The IRIS decoder operates on <=2 MP to bound worker memory and mobile CPU.
    // Large originals stay full-resolution for ZXing; only the IRIS pass is resized.
    if(canvas.width*canvas.height>1_690_000){
      const scale=Math.min(1,1300/Math.max(bitmap.width,bitmap.height));
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));
      canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    }
    const iris=await readIrisPixels(ctx.getImageData(0,0,canvas.width,canvas.height));
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

// Library Play uses a fast cached copy of the exact game bytes embedded in each PNG.
// Physical scans and image uploads still decode the barcode. CI verifies image-to-payload
// integrity for every published game code, including the experimental color formats.
// Reuse one modal for all game and About code images: no extra tab or popup.
const codeImageDialog=$('code-image-dialog'),codeImage=$('code-image-full');
document.addEventListener('click',event=>{
  const anchor=event.target.closest('a.game-code-preview, a.about-code-example');
  if(!anchor||!anchor.href)return;
  const target=new URL(anchor.href,location.href);
  if(target.origin!==location.origin||!/^\/assets\/[a-z0-9-]+\.png$/.test(target.pathname))return;
  event.preventDefault();
  codeImage.src=target.pathname;
  codeImage.alt=anchor.querySelector('img')?.alt||'Full game code';
  const groupFormat=anchor.closest('.game-group')?.querySelector('.group-title')?.textContent?.trim()||'';
  const aboutFormat=anchor.closest('.about-code-card')?.querySelector('.about-code-heading h3')?.textContent?.trim()||'';
  $('code-image-heading').textContent=(groupFormat||aboutFormat||'Code preview').replace(/ barcode$/i,'');
  codeImageDialog.classList.toggle('dotcode-viewer',groupFormat==='DotCode'||aboutFormat==='DotCode');
  if(!codeImageDialog.open)codeImageDialog.showModal();
});
$('close-code-image').addEventListener('click',()=>codeImageDialog.close());
codeImageDialog.addEventListener('close',()=>{codeImage.removeAttribute('src');codeImageDialog.classList.remove('dotcode-viewer')});
codeImageDialog.addEventListener('click',event=>{if(event.target===codeImageDialog)codeImageDialog.close()});

const catalogPromises=new Map();
let bundledCatalog=null;
try{
  const inline=document.getElementById('play-catalog');
  if(inline){
    const bytes=Uint8Array.from(atob(inline.textContent.trim()),char=>char.charCodeAt(0));
    bundledCatalog=JSON.parse(new TextDecoder().decode(bytes));
  }
}catch{bundledCatalog=null}
async function readCatalogGame(name){
  if(!/^[a-z0-9-]+$/.test(name))throw Error('Invalid game asset name.');
  // Production embeds decoded first-party games. No fetch or decompression on Play.
  if(bundledCatalog&&Object.hasOwn(bundledCatalog,name))return bundledCatalog[name];
  if(!catalogPromises.has(name)){
    const promise=fetch('assets/'+name+'.txt',{cache:'force-cache'})
      .then(async response=>{
        if(!response.ok)throw Error('Game payload is unavailable.');
        const payload=(await response.text()).trim();
        if(!isGamePayload(payload))throw Error('The saved game data is invalid.');
        const game=await decodeGame(payload);
        if(!['html','standalone','bytecode','maze','lights','microvm','micro'].includes(game.kind))
          throw Error('Unsupported embedded game program.');
        return game;
      }).catch(error=>{catalogPromises.delete(name);throw error});
    catalogPromises.set(name,promise);
  }
  return catalogPromises.get(name);
}
// Inspect the exact decompressed game program. Unlike the preview, this view
// never executes game code. The cached payload is identical to the barcode data.
$('library').addEventListener('click',async event=>{
  const button=event.target.closest('button[data-source-asset]');
  if(!button)return;
  const name=button.dataset.sourceAsset;
  const title=button.dataset.sourceTitle;
  button.disabled=true;
  const original=button.textContent;
  button.textContent='Loading...';
  try{
    // Ironpass uses a different basename for its PNG and encoded text.
    const payloadName=name==='ironpass-micro-v3-qr'?'ironpass-micro-v3':name;
    const game=await readCatalogGame(payloadName);
    showGameSource(game,title);
  }catch(error){
    $('source-heading').textContent=title+' source';
    $('source-description').textContent='Could not load the game code. Try again.';
    $('source-view').textContent=error.message||String(error);
    if(!$('source-dialog').open)$('source-dialog').showModal();
  }finally{
    button.disabled=false;
    button.textContent=original;
  }
});
async function openCatalogGame(name,title){
  try{
    const game=await readCatalogGame(name);
    playGame({...game,title});
  }catch(error){
    switchTab('scan');
    status('Could not open '+title+': '+(error.message||String(error)),true);
  }
}
$('try-ironpass').addEventListener('click',()=>openCatalogGame('ironpass-micro-v3','Ironpass Micro'));
async function playMatrixExample(name,title,format){
  // The format remains part of the caller contract; this is a fast library preview.
  // Actual barcode scanning uses detectImage or cameraLoop, not this shortcut.
  return openCatalogGame(name,title);
}
$('try-catch').addEventListener('click',()=>playMatrixExample('catch-datamatrix','Catch 10','DataMatrix'));
$('try-memory').addEventListener('click',()=>playMatrixExample('memory-aztec','Pattern Memory','Aztec'));
$('try-breakout').addEventListener('click',()=>playMatrixExample('breakout-pdf417','Brick Rush','PDF417'));
$('try-tap').addEventListener('click',()=>playMatrixExample('tap-maxicode','Perfect Timing','MaxiCode'));
$('try-micro').addEventListener('click',()=>playMatrixExample('reflex-microqr','Pocket Reflex','MicroQRCode'));
$('try-rmqr').addEventListener('click',()=>playMatrixExample('math-rmqr','Codebreaker','RMQRCode'));
$('try-taprush').addEventListener('click',()=>playMatrixExample('taprush-code128','Tap Rush','Code128'));
async function playExoticExample(name,title,format){
  return openCatalogGame(name,title);
}
$('try-dice-streak').addEventListener('click',()=>playMatrixExample('dice-streak-micropdf417','Dice Streak','MicroPDF417'));
$('try-dotcode-dodge').addEventListener('click',()=>playExoticExample('neon-dodge-dotcode','Neon Dodge','dotcode'));

async function playIrisExample(name,title){
  return openCatalogGame(name,title);
}
$('try-iris-wire').addEventListener('click',()=>playIrisExample('iris-wire','Wire Crisis'));
$('try-chromaqr-chroma').addEventListener('click',()=>openCatalogGame('chromaqr-chroma','Chroma Rush'));

function selectGenerator(format) {
  generatorFormat=format;
  document.querySelectorAll('[data-format]').forEach(x=>x.classList.toggle('selected',x.dataset.format===format));
  const tiny=format==='microqr';
  const script=['bar','maxi','rmqr','chromaqr','micropdf417'].includes(format);
  $('create-label').textContent=tiny?'Micro VM program (13 characters)':format==='bar'?'Game code (JavaScript or LO: level)':script?'Game code (JavaScript)':'Game code (HTML)';
  $('create-source').placeholder=tiny?'V1R4T3DIC+L0X':script?'Paste standalone JavaScript here':'Paste a complete HTML game here';
  $('create-help').textContent=tiny?'Micro QR stores the full 13-character VM program (random number, display, timer, input, scoring and endless loop with a shorter timer for each point). A generic interpreter runs the instructions. Not standalone JavaScript.':
    format==='bar'?'The Tap Rush example uses 22 encoded characters. Its JavaScript counter is in the barcode; ScanDeck provides the five-second timer. Larger barcodes may be hard to scan on phones.':
    format==='micropdf417'?'MicroPDF417 holds a short JavaScript game. Keep the entire barcode sharp and inside the camera frame.':
    format==='dotcode'?'DotCode stores a complete compressed HTML game. ScanDeck uses an experimental strict DotCode reader.':
    format==='maxi'?'MaxiCode holds only a very small standalone JavaScript program.':
    format==='rmqr'?'rMQR is rectangular. Keep standalone JavaScript very short.':
    format==='pdf'?'PDF417 holds a compact, self-contained HTML game.':
    format==='data-matrix'?'Data Matrix works best with small self-contained HTML games.':
    format==='aztec'?'Aztec Code can store a compact HTML game.':format==='chromaqr'?'ChromaQR stores the entire JavaScript game across three RGB QR layers.':format==='iris'?'IRIS stores the full game in a colored circular symbol. Use ScanDeck to scan it.':'QR codes can store more game data.';
  document.querySelectorAll('[data-format]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.format===format)));
  $('create-source').value='';
  if(outputData?.url)URL.revokeObjectURL(outputData.url);
  outputData=null;$('output-label').textContent='READY';$('output-stats').textContent='';$('generated-payload').value='';
  $('output-preview').replaceChildren();show('create-result',false);show('create-error',false);
  for(const id of ['download-code','copy-code','test-code'])$(id).disabled=true;
}
document.querySelectorAll('[data-format]').forEach(b=>b.addEventListener('click',()=>selectGenerator(b.dataset.format)));
$('use-example').addEventListener('click',async()=>{
  if(generatorFormat==='microqr'){
    $('create-source').value='V1R4T3DIC+L5X';
  }else if(generatorFormat==='bar'){
    $('create-source').value='n=0;onclick=_=>n++';
  }else if(generatorFormat==='micropdf417'){
    $('create-source').value="s=0;document.write('<button id=b>ROLL</button><p id=p>0');b.onclick=()=>{r=Math.random()*6|0;s=r?s+r+1:0;p.textContent=s?'SCORE '+s:'BUST'}";
  }else if(!['bar','maxi','rmqr','chromaqr'].includes(generatorFormat)){
    $('create-source').value=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#101719;color:#b9ef79;display:grid;place-items:center;height:96vh;font:25px monospace"><button onclick="this.textContent='YOU WIN!'" style="padding:28px;background:#b9ef79;border:0">TAP TO WIN</button></body>`;
  } else {
    $('create-source').value="document.body.innerHTML='<button>Tap me</button>';document.querySelector('button').onclick=e=>e.target.textContent='You win!'";
  }
});
async function packIrisHtml(input){
  if(!/<(?:canvas|html|body|svg|div|script)\b/i.test(input))throw Error('Paste an HTML game, not plain text.');
  return 'SD1:'+base43Encode(await deflateRaw(input));
}
// Render all creator formats into a real PNG before preview and download.
function displaySvg(source){
  const doc=new DOMParser().parseFromString(source,'image/svg+xml');
  const svg=doc.documentElement;
  if(svg.localName!=='svg'||doc.querySelector('parsererror'))throw Error('Invalid generated barcode image.');
  if(!svg.getAttribute('xmlns'))svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const box=svg.getAttribute('viewBox')?.split(/[ ,]+/).map(Number);
  if(box?.length===4&&box.every(Number.isFinite)){
    svg.setAttribute('width',String(box[2]));
    svg.setAttribute('height',String(box[3]));
  }
  return new XMLSerializer().serializeToString(svg);
}
async function svgToPng(svg){
  const src=new Blob([svg],{type:'image/svg+xml'});
  const url=URL.createObjectURL(src);
  try{
    const img=new Image();
    await new Promise((resolve,reject)=>{
      img.onload=resolve;
      img.onerror=()=>reject(Error('Could not rasterize this barcode.'));
      img.src=url;
    });
    const rawWidth=img.naturalWidth||640,rawHeight=img.naturalHeight||640;
    const scale=Math.min(3,4096/Math.max(rawWidth,rawHeight),Math.sqrt(8000000/(rawWidth*rawHeight)));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(rawWidth*scale));
    canvas.height=Math.max(1,Math.round(rawHeight*scale));
    const ctx=canvas.getContext('2d');
    ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const png=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG conversion failed')),'image/png'));
    canvas.width=canvas.height=1;
    return png;
  }finally{URL.revokeObjectURL(url)}
}
function setGeneratedImage(blob){
  if(outputData?.url)URL.revokeObjectURL(outputData.url);
  const url=URL.createObjectURL(blob);
  const img=document.createElement('img');
  img.src=url;img.alt='Generated PNG game code';
  img.style.maxWidth='100%';img.style.height='auto';img.style.objectFit='contain';
  $('output-preview').replaceChildren(img);
  return url;
}
$('generate').addEventListener('click',async()=>{
  const button=$('generate');button.disabled=true;button.textContent='Generating...';show('create-error',false);
  try {
    const input=$('create-source').value.trim();if(!input)throw Error('Add a game or try an example first.');
    const payload=generatorFormat==='microqr'?packMicroVm(input):generatorFormat==='bar'&&input.toUpperCase().startsWith('LO:')?(/^LO:[0-9A-F]{4}$/.test(input.toUpperCase())&&input.toUpperCase()!=='LO:0000'?input.toUpperCase():(()=>{throw Error('Lights Out levels must be LO: and four hex digits, e.g. LO:5A36.')})()):generatorFormat==='micropdf417'?packScript(input):generatorFormat==='dotcode'?await packDenseHtml(input):['bar','maxi','rmqr','chromaqr'].includes(generatorFormat)?packScript(input):generatorFormat==='iris'?await packIrisHtml(input):await packHtml(input);
    if(generatorFormat==='micropdf417'&&new TextEncoder().encode(payload).length>150)throw Error('MicroPDF417 is limited to 150 encoded bytes. Shorten the JavaScript game.');
    if(generatorFormat==='bar'&&payload.length>95)throw Error('For a camera-readable Code 128, keep the total below 95 characters or select a 2D code.');
    let svg,png;
    if(generatorFormat==='qr'){
      const qrFactory=await loadExternal(QR_GENERATOR_URL,'qrcode');
      const qr=qrFactory(0,'L');qr.addData(payload,'Alphanumeric');qr.make();
      svg=displaySvg(qr.createSvgTag({cellSize:4,margin:4,scalable:true}));
    } else if(generatorFormat==='bar') {
      svg=displaySvg(code128Svg(payload));
    } else if(generatorFormat==='iris') {
      const {encodeColor,renderColorSVG}=await import('../vendor/iris/color.js');
      svg=displaySvg(renderColorSVG(encodeColor(payload,{markers:true}),{style:'slices'}));
    } else if(generatorFormat==='chromaqr'){
      const factory=await loadExternal(QR_GENERATOR_URL,'qrcode');
      svg=displaySvg(chromaSvg(encodeChroma(factory,payload)));
    } else if(generatorFormat==='dotcode'){
      const {encodeDotCode,toPNG}=await import('../vendor/sythos-barcode.esm.js');
      const matrix=encodeDotCode(payload,{aspectRatio:1});
      png=new Blob([await toPNG(matrix,{scale:5,margin:12})],{type:'image/png'});
    } else {
      const lib=await getMatrixEngine();
      const format=({ 'data-matrix':'DataMatrix',aztec:'Aztec',pdf:'PDF417',micropdf417:'MicroPDF417',maxi:'MaxiCode',microqr:'MicroQRCode',rmqr:'RMQRCode' })[generatorFormat];
      if(!format)throw Error('Unsupported code format.');
      const result=await lib.writeBarcode(payload,{format,scale:format==='PDF417'||format==='RMQRCode'||format==='MicroPDF417'?10:8});
      png=result.image;
      if(!png)throw Error('The decoder could not generate a PNG barcode.');
    }
    png ||= await svgToPng(svg);
    const url=setGeneratedImage(png);
    outputData={blob:png,url,payload,kind:generatorFormat};
    show('create-result',true);
    $('output-label').textContent='READY';
    $('output-stats').replaceChildren();
    for(const s of [generatorFormat==='bar'?'Short Code 128 PNG ready':generatorFormat==='microqr'?'Complete 13-byte VM program ready (generic interpreter required)':generatorFormat.toUpperCase()+' PNG ready',payload.length+' encoded characters']){const span=document.createElement('span');span.textContent=s;$('output-stats').append(span)}
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
  const a=document.createElement('a');
  a.href=outputData.url;
  a.download='scandeck-'+outputData.kind+'-game.png';
  a.click();
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

// Avoid temporal dead-zone errors when opening a URL with #library/#create/#about.
// switchTab() invokes stopCamera(), so initialize every worker and game handler first.
if(location.hash) switchTab(location.hash.slice(1));