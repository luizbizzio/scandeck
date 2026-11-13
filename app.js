import { decodeGame, packHtml, packScript, packMicroQuiz, deflateRaw, base43Encode, QR_LIMIT } from './protocol.js';
import { gameDocument } from './runtime.js';
import { code128Svg, decodeCode128Svg } from './code128.js';
import { encodeChroma,chromaSvg,decodeChromaPixels } from './chroma.js';
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
    if(['QRCode','qr_code','CodablockF'].includes(format)&&game.kind==='standalone'&&game.source.startsWith("b=document.body"))game.title='Snake';
    if((format==='Code128'||format==='code_128')&&game.kind==='standalone'&&game.source.startsWith('n=0;onclick=()=>{n||setTimeout'))game.title='Tap Rush';
    if(format==='DotCode'&&game.kind==='html'&&game.source.includes('DODGE ·'))game.title='Neon Dodge';
    if((format==='IRIS'||format==='ChromaQR')&&game.kind==='standalone'&&game.source.startsWith("document.write('<p id=t>"))game.title='Wire Crisis';
    if(format==='ChromaQR'&&game.kind==='html'&&game.source.includes('CHROMA RUSH'))game.title='Chroma Rush';
    selectedGame = game;
    $('detected-title').textContent = game.title;
    $('detected-description').textContent = 'Ready to play.';
    $('detected-meta').replaceChildren();
    const labels={IRIS:'IRIS',ChromaQR:'ChromaQR',CodablockF:'Codablock F',DotCode:'DotCode',qr_code:'QR Code',QRCode:'QR Code',code_128:'Code 128',Code128:'Code 128',data_matrix:'Data Matrix',DataMatrix:'Data Matrix',aztec:'Aztec Code',Aztec:'Aztec Code',PDF417:'PDF417',MaxiCode:'MaxiCode',MicroQRCode:'Micro QR',RMQRCode:'rMQR'};
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
  const hints={'Tap Rush':'10 TAPS IN 3 SECONDS · START ON FIRST TAP','Neon Dodge':'TAP TO CHANGE LANES · AVOID THE RED BLOCKS','Lights Out':'FLIP THE LIGHTS · SOLVE THE 4×4 GRID','Snake':'ARROWS / SWIPE · EAT THE FOOD','Perfect Timing':'MATCH YOUR TARGET TIME IN MILLISECONDS','Codebreaker':'GUESS 0-98 · 7 TRIES · UP / DOWN','Pocket Maze':'RANDOM 6×6 MAZE · FIND THE STAR','Chroma Rush':'TAP THE INK COLOR, NOT THE WORD','Wire Crisis':'5 ROUNDS · REMEMBER 3-7 COLORS · BEAT THE CLOCK'};
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
const wasmOptions={formats:WASM_FORMATS,maxNumberOfSymbols:1,tryHarder:true,tryRotate:true,tryInvert:true,tryDenoise:true,tryDownscale:false};
const FOCUS_FORMATS={pdf417:'PDF417',maxicode:'MaxiCode',rmqr:'RMQRCode',code128:'Code128'};
const scanFocus=()=> $('scan-mode').value;
const focusTips={
  auto:'Keep the complete symbol in view.',
  rmqr:'Hold the rectangular rMQR level and sharp. Try landscape.',
  maxicode:'MaxiCode must be flat, upright and almost fill the square.',
  pdf417:'Hold PDF417 horizontally with all rows visible.',
  code128:'Keep the entire barcode visible from end to end.',
  iris:'Center the colored circular code in the frame.',
  chromaqr:'Center the full colored QR symbol.',
  codablockf:'Keep all stacked bars straight and fully inside the frame.',
  dotcode:'Hold the entire field of dots straight and sharply focused.'
};
function setScanFocus(mode){
  if(!['auto','rmqr','maxicode','pdf417','code128','iris','chromaqr','codablockf','dotcode'].includes(mode))mode='auto';
  $('scan-mode').value=mode;
  $('camera-mode').value=mode;
  $('camera-panel').dataset.focus=mode;
  const selected=$('scan-mode').selectedOptions[0].textContent;
  $('camera-label').textContent=mode==='auto'?'SCANNING':'SCANNING · '+selected.toUpperCase();
  $('camera-tip').textContent=focusTips[mode];
  if(live)status('Scanning '+selected+'. '+focusTips[mode]);
}
$('scan-mode').addEventListener('change',()=>setScanFocus($('scan-mode').value));
$('camera-mode').addEventListener('change',()=>setScanFocus($('camera-mode').value));
setScanFocus('auto');
function centeredIrisFrame(video){
  const w=video.videoWidth,h=video.videoHeight,side=Math.min(w,h);
  const canvas=document.createElement('canvas');
  const size=Math.min(side,1250);canvas.width=size;canvas.height=size;
  canvas.getContext('2d',{willReadFrequently:true}).drawImage(video,(w-side)/2,(h-side)/2,side,side,0,0,size,size);
  return canvas;
}
function stopCamera() {
  cameraToken++;live=false;clearTimeout(scanTimeout);
  if(scanStream)scanStream.getTracks().forEach(track=>track.stop());scanStream=null;
  const video=$('camera');video.pause();video.srcObject=null;
  show('camera-panel',false);show('scan-idle',true);show('stop-camera',false);
  document.documentElement.classList.remove('camera-open');
  $('start-camera').disabled=false;$('stop-camera').disabled=true;
}
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia){status('Camera is not available here. You can upload an image instead.',true);return;}
  resetDetected();
  $('start-camera').disabled=true;status('Opening camera...');
  try {
    const engine=await getScanner();
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:15,max:24}},audio:false});
    scanStream=stream;$('camera').srcObject=stream;await $('camera').play();
    live=true;const token=++cameraToken;
    show('scan-idle',false);show('camera-panel',true);show('stop-camera',true);
    document.documentElement.classList.toggle('camera-open',matchMedia('(max-width:700px)').matches);
    setScanFocus(scanFocus());
    $('stop-camera').disabled=false;status('Looking for a game code...');
    void cameraLoop(token,engine);
  } catch(error) {stopCamera();status('Could not open the camera. Check its permissions or upload an image.',true)}
}
async function readChromaImage(image){
  const engine=await getMatrixEngine();
  return decodeChromaPixels(image,(pixels,options)=>engine.readBarcodes(pixels,options));
}
function isGamePayload(text){
  return /^(?:LO:|SD1:|SDS:|SDJ:|IP3:|MQ:|s=\[)/.test(text||'');
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
function readExoticPixels(image,format){
  const {width,height,data}=image;
  if(!['codablockf','dotcode'].includes(format)||!width||!height||
    width*height>2_000_000||data?.length!==width*height*4)return Promise.resolve('');
  const rgba=new Uint8ClampedArray(data); // don't detach ZXing's camera image
  return new Promise(resolve=>{
    const id=++exoticSeq;
    const timer=setTimeout(resetExoticWorker,4500);
    exoticWaiting.set(id,{timer,resolve});
    try{getExoticWorker().postMessage({id,format,width,height,buffer:rgba.buffer},[rgba.buffer])}
    catch{clearTimeout(timer);exoticWaiting.delete(id);resolve('')}
  });
}

// Focused camera recovery for dense rectangular rMQR and rigid MaxiCode.
// ZXing MaxiCode needs an upright, monochrome and essentially frontal symbol.
function makeFocusedPixels(image,mode,monochrome=false){
  const w=image.width,h=image.height,short=Math.min(w,h);
  const roi=mode==='rmqr'
    ?{w:Math.min(w,w*.95),h:Math.min(h,h*.68)}
    :{w:short*.76,h:short*.76};
  const maxW=mode==='rmqr'?1500:750;
  const scale=Math.min(mode==='rmqr'?1.35:1.6,maxW/roi.w,1000/roi.h);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(roi.w*scale));
  canvas.height=Math.max(1,Math.round(roi.h*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(image,(w-roi.w)/2,(h-roi.h)/2,roi.w,roi.h,0,0,canvas.width,canvas.height);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  if(monochrome){
    const data=pixels.data;
    let min=255,max=0;
    for(let i=0;i<data.length;i+=4){
      const gray=(data[i]*77+data[i+1]*150+data[i+2]*29)>>8;
      min=Math.min(min,gray);max=Math.max(max,gray);
    }
    // Use a moderate threshold instead of losing the thin MaxiCode dots.
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
  const useCrop=frame%2===0&&(mode==='rmqr'||mode==='maxicode');
  const pix=useCrop?makeFocusedPixels(source,mode,mode==='maxicode'):
    source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,source.width,source.height);
  const opts={
    ...wasmOptions,formats:[format],
    binarizer:useCrop?'GlobalHistogram':'LocalAverage',
    isPure:useCrop&&mode==='maxicode',
    tryDownscale:mode==='maxicode'&&useCrop,
    tryDenoise:false,
    tryRotate:mode!=='maxicode'
  };
  const result=(await lib.readBarcodes(pix,opts)).find(item=>isGamePayload(item.text));
  return result||null;
}
async function cameraLoop(token,engine){
  let frame=0;
  while(live&&cameraToken===token&&!document.hidden){
    const video=$('camera');
    if(video.readyState>=2&&video.videoWidth&&video.videoHeight){
      try{
        const mode=scanFocus(),focused=FOCUS_FORMATS[mode];
        const limit=mode==='code128'?1800:mode==='rmqr'?1600:mode==='maxicode'?1300:1300;
        const ratio=Math.min(1,limit/Math.max(video.videoWidth,video.videoHeight));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(video.videoWidth*ratio));
        canvas.height=Math.max(1,Math.round(video.videoHeight*ratio));
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(video,0,0,canvas.width,canvas.height);
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
        let result=null;
        if(mode==='auto'||focused){
          if(engine.kind==='native'&&mode==='auto'){
            result=(await engine.engine.detect(video)).find(x=>isGamePayload(x.rawValue));
          }else{
            const lib=engine.kind==='wasm'?engine.engine:await getMatrixEngine();
            if(mode==='rmqr'||mode==='maxicode'){
              result=await readFocused(lib,canvas,mode,frame);
            }else{
              const formats=focused?[focused]:frame%3===0
                ?['QRCode','DataMatrix','Aztec','Code128']
                :frame%3===1?['PDF417','RMQRCode','MicroQRCode']:['MaxiCode'];
              result=(await lib.readBarcodes(pixels,{
                ...wasmOptions,formats,tryDenoise:false,tryRotate:mode!=='code128'
              })).find(x=>isGamePayload(x.text));
            }
          }
          const raw=result?.text||result?.rawValue;
          if(live&&token===cameraToken&&raw&&await acceptPayload(raw,'camera',result.format))return;
        }
        if(mode==='chromaqr'||mode==='auto'&&frame%4===0){
          const chroma=await readChromaImage(pixels);
          if(live&&token===cameraToken&&chroma&&await acceptPayload(chroma,'camera','ChromaQR'))return;
        }
        if(mode==='codablockf'||mode==='dotcode'||mode==='auto'&&frame%8===5){
          const format=mode==='codablockf'?'codablockf':mode==='dotcode'?'dotcode':frame%16===5?'codablockf':'dotcode';
          const experimental=await readExoticPixels(pixels,format);
          if(live&&token===cameraToken&&experimental&&await acceptPayload(experimental,'camera',format==='codablockf'?'CodablockF':'DotCode'))return;
        }
        if(mode==='iris'||mode==='auto'&&frame%4===2){
          const crop=centeredIrisFrame(video);
          const iris=await readIrisPixels(crop.getContext('2d',{willReadFrequently:true}).getImageData(0,0,crop.width,crop.height));
          crop.width=crop.height=1;
          if(live&&token===cameraToken&&iris&&await acceptPayload(iris,'camera','IRIS'))return;
        }
        canvas.width=canvas.height=1;
        frame++;
      }catch(error){
        if(live&&token===cameraToken)status('Scanner error: '+error.message,true);
      }
    }
    if(live&&token===cameraToken)await delay(220);
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
      if(hit&&isGamePayload(hit.rawValue))return {text:hit.rawValue,format:hit.format};
    } finally {bitmap?.close()}
  }
  const lib=engine.kind==='wasm'?engine.engine:await getMatrixEngine();
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
    // Camera screenshots and photos may need a centered, monochrome pass.
    for(const focusedFormat of ['rmqr','maxicode']){
      const focused=await readFocused(lib,canvas,focusedFormat,0);
      if(focused)return {text:focused.text,format:focused.format};
    }
    for(const exotic of ['codablockf','dotcode']){
      const found=await readExoticPixels(pixels,exotic);
      if(found)return {text:found,format:exotic==='codablockf'?'CodablockF':'DotCode'};
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

$('try-ironpass').addEventListener('click',async()=>{
  try{const response=await fetch('assets/ironpass-micro-v3.txt',{cache:'force-cache'});if(!response.ok)throw Error('Game payload not found.');playGame(await decodeGame(await response.text()))}
  catch(error){switchTab('scan');status('Ironpass could not load: '+error.message,true)}
});

async function playMatrixExample(name,title,format) {
  try {
    const response=await fetch('assets/'+name+'.png');
    if(!response.ok)throw Error('Game code image not found.');
    const engine=await getMatrixEngine();
    const hit=firstResult(await engine.readBarcodes(await response.blob(),{...wasmOptions,formats:[format]}));
    if(!hit?.text)throw Error('Could not read the game from its code image.');
    const game=await decodeGame(hit.text);
    if(!['html','standalone','bytecode','maze','lights'].includes(game.kind))throw Error('Unsupported embedded game program.');
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
$('try-taprush').addEventListener('click',()=>playMatrixExample('taprush-code128','Tap Rush','Code128'));
async function playExoticExample(name,title,format){
  try{
    const response=await fetch('assets/'+name+'.png',{cache:'no-cache'});
    if(!response.ok)throw Error('Game code PNG could not be loaded.');
    const bitmap=await createImageBitmap(await response.blob());
    const canvas=document.createElement('canvas');
    canvas.width=bitmap.width;canvas.height=bitmap.height;
    canvas.getContext('2d',{willReadFrequently:true}).drawImage(bitmap,0,0);
    bitmap.close();
    const bytes=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height);
    canvas.width=canvas.height=1;
    const payload=await readExoticPixels(bytes,format);
    if(!payload)throw Error('The experimental decoder could not read this PNG.');
    const game=await decodeGame(payload);
    game.title=title;
    playGame(game);
  }catch(error){switchTab('scan');status(title+' could not open: '+error.message,true)}
}
$('try-codablock-snake').addEventListener('click',()=>playExoticExample('snake-codablockf','Snake','codablockf'));
$('try-dotcode-dodge').addEventListener('click',()=>playExoticExample('neon-dodge-dotcode','Neon Dodge','dotcode'));

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
$('try-iris-wire').addEventListener('click',()=>playIrisExample('iris-wire','Wire Crisis'));
$('try-chromaqr-chroma').addEventListener('click',async()=>{
  try{
    const response=await fetch('assets/chromaqr-chroma.png');
    if(!response.ok)throw Error('ChromaQR image not found');
    const hit=await detectImage(await response.blob());
    if(hit.format!=='ChromaQR')throw Error('ChromaQR image decoder did not recover all three channels');
    const game=await decodeGame(hit.text);
    game.title='Chroma Rush';
    playGame(game);
  }catch(error){switchTab('scan');status('Could not scan Chroma Rush: '+error.message,true)}
});

function selectGenerator(format) {
  generatorFormat=format;
  document.querySelectorAll('[data-format]').forEach(x=>x.classList.toggle('selected',x.dataset.format===format));
  const tiny=format==='microqr';
  const script=['bar','maxi','rmqr','chromaqr','codablockf'].includes(format);
  $('create-label').textContent=tiny?'Program (maze bytecode)':format==='bar'?'Game code (JavaScript or LO: level)':script?'Game code (JavaScript)':'Game code (HTML)';
  $('create-source').placeholder=tiny?'M36509':script?'Paste standalone JavaScript here':'Paste a complete HTML game here';
  $('create-help').textContent=tiny?'Micro QR stores a seed and difficulty instruction. ScanDeck generates different solvable 6×6 mazes. This is bytecode, not standalone JavaScript.':
    format==='bar'?'A complete Tap Rush JavaScript program needs 83 characters with the prefix. Longer Code 128 symbols may fail on phone cameras.':
    format==='codablockf'?'Codablock F stores the full standalone JavaScript in stacked rows. Camera scanning is experimental.':
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
    $('create-source').value='M36509';
  }else if(generatorFormat==='bar'){
    $('create-source').value='n=0;onclick=()=>{n||setTimeout(()=>alert(n>9),3e3);document.body.innerText=++n}';
  }else if(!['bar','maxi','rmqr','chromaqr','codablockf'].includes(generatorFormat)){
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
    const payload=generatorFormat==='microqr'?packMicroQuiz(input):generatorFormat==='bar'&&input.toUpperCase().startsWith('LO:')?(/^LO:[0-9A-F]{4}$/.test(input.toUpperCase())&&input.toUpperCase()!=='LO:0000'?input.toUpperCase():(()=>{throw Error('Lights Out levels must be LO: and four hex digits, e.g. LO:5A36.')})()):['bar','maxi','rmqr','chromaqr','codablockf'].includes(generatorFormat)?packScript(input):generatorFormat==='iris'?await packIrisHtml(input):await packHtml(input);
    if(generatorFormat==='bar'&&payload.length>95)throw Error('For a camera-readable Code 128, keep the total below 95 characters or select a 2D code.');
    let svg,png;
    if(generatorFormat==='qr'){
      const qrFactory=await loadExternal(QR_GENERATOR_URL,'qrcode');
      const qr=qrFactory(0,'L');qr.addData(payload,'Alphanumeric');qr.make();
      svg=displaySvg(qr.createSvgTag({cellSize:4,margin:4,scalable:true}));
    } else if(generatorFormat==='bar') {
      svg=displaySvg(code128Svg(payload));
    } else if(generatorFormat==='iris') {
      const {encodeColor,renderColorSVG}=await import('./vendor/iris/color.js');
      svg=displaySvg(renderColorSVG(encodeColor(payload,{markers:true}),{style:'slices'}));
    } else if(generatorFormat==='chromaqr'){
      const factory=await loadExternal(QR_GENERATOR_URL,'qrcode');
      svg=displaySvg(chromaSvg(encodeChroma(factory,payload)));
    } else if(generatorFormat==='codablockf'||generatorFormat==='dotcode'){
      const {encodeCodablockF,encodeDotCode,toPNG}=await import('./vendor/sythos-barcode.esm.js');
      const matrix=generatorFormat==='codablockf'
        ?encodeCodablockF(payload,{rowHeight:5,separatorHeight:1})
        :encodeDotCode(payload,{aspectRatio:1});
      png=new Blob([await toPNG(matrix,{scale:5,margin:12})],{type:'image/png'});
    } else {
      const lib=await getMatrixEngine();
      const format=({ 'data-matrix':'DataMatrix',aztec:'Aztec',pdf:'PDF417',maxi:'MaxiCode',microqr:'MicroQRCode',rmqr:'RMQRCode' })[generatorFormat];
      if(!format)throw Error('Unsupported code format.');
      const result=await lib.writeBarcode(payload,{format,scale:format==='PDF417'||format==='RMQRCode'?10:8});
      png=result.image;
      if(!png)throw Error('The decoder could not generate a PNG barcode.');
    }
    png ||= await svgToPng(svg);
    const url=setGeneratedImage(png);
    outputData={blob:png,url,payload,kind:generatorFormat};
    show('create-result',true);
    $('output-label').textContent='READY';
    $('output-stats').replaceChildren();
    for(const s of [generatorFormat==='bar'?'Short Code 128 PNG ready':generatorFormat==='microqr'?'Micro QR bytecode ready (requires ScanDeck interpreter)':generatorFormat.toUpperCase()+' PNG ready',payload.length+' encoded characters']){const span=document.createElement('span');span.textContent=s;$('output-stats').append(span)}
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