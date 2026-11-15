/* One-shot image-upload decoder. All costly barcode and image processing
 * stays off the UI thread. The worker is terminated after each upload.
 * No image is sent to a remote service and no game code runs here.
 */
let decoderPromise=null;
const STANDARD=['QRCode','Code128','DataMatrix','Aztec','PDF417',
  'MicroPDF417','EAN13','MicroQRCode','DataBarExpStk'];
const MAX_UPLOAD_PIXELS=12_000_000;
const isGameText=value=>{
  const raw=String(value||'');
  return /^(?:91|\(91\)|\[91\])SDCB[1-9]$/.test(raw.replace(/^\]e[0-9]/,''))||
    /^(?:299000[0-9]{7}$|V1|LO:|SDM:|SD1:|SDC:|SDB:|SDH:|SDY:|SDZ:|SDS:|SDJ:|IP3:|MQ:|s=\[)/.test(raw);
};
const matching=results=>{
  const item=results?.find(hit=>isGameText(hit.text||hit.rawValue));
  return item?{text:item.text||item.rawValue,format:item.format||''}:null;
};
function decoder(){
  if(!decoderPromise)decoderPromise=(async()=>{
    importScripts('../vendor/zxing-wasm/index.js');
    const zx=self.ZXingWASM;
    if(!zx?.readBarcodes)throw Error('ZXing upload reader could not start.');
    zx.prepareZXingModule({overrides:{locateFile:path=>path.endsWith('.wasm')
      ?new URL('../vendor/zxing-wasm/'+path,self.location.href).href:path}});
    return zx;
  })().catch(err=>{decoderPromise=null;throw err});
  return decoderPromise;
}
const options={formats:STANDARD,maxNumberOfSymbols:1,tryHarder:true,
  tryRotate:true,tryInvert:true,tryDenoise:false,tryDownscale:false};
async function read(zx,source,opts){
  try{return matching(await zx.readBarcodes(source,opts))}catch{return null}
}
function capture(bitmap,ratio=1,maxPixels=2_100_000,maxEdge=2200){
  const scale=Math.min(1,ratio,maxEdge/Math.max(bitmap.width,bitmap.height),
    Math.sqrt(maxPixels/(bitmap.width*bitmap.height)));
  const width=Math.max(1,Math.floor(bitmap.width*scale));
  const height=Math.max(1,Math.floor(bitmap.height*scale));
  const canvas=new OffscreenCanvas(width,height);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bitmap,0,0,width,height);
  return ctx.getImageData(0,0,width,height);
}
function captureCenter(bitmap,fraction=.70){
  const rw=bitmap.width*fraction,rh=bitmap.height*fraction;
  const scale=Math.min(1.15,1920/Math.max(rw,rh),
    Math.sqrt(1_900_000/(rw*rh)));
  const width=Math.max(1,Math.floor(rw*scale));
  const height=Math.max(1,Math.floor(rh*scale));
  const canvas=new OffscreenCanvas(width,height);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bitmap,(bitmap.width-rw)/2,(bitmap.height-rh)/2,
    rw,rh,0,0,width,height);
  return ctx.getImageData(0,0,width,height);
}
function cropBitmap(bitmap,mode,phase){
  const w=bitmap.width,h=bitmap.height;
  let rw,rh;
  if(mode==='rmqr'){rw=w*(phase%3===1?.96:.78);rh=h*(phase%3===1?.68:.92)}
  else{rw=w*.96;rh=h*.76}
  const maxW=mode==='rmqr'?1900:1700;
  const scale=Math.min(1.35,maxW/rw,1400/rh,Math.sqrt(1_650_000/(rw*rh)));
  const width=Math.max(1,Math.floor(rw*scale));
  const height=Math.max(1,Math.floor(rh*scale));
  const canvas=new OffscreenCanvas(width,height);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=mode!=='rmqr';
  ctx.drawImage(bitmap,(w-rw)/2,(h-rh)/2,rw,rh,0,0,width,height);
  return ctx.getImageData(0,0,width,height);
}
async function decodeExotic(image,format,phase=0,exact=false){
  try{
    const {BitMatrix,decodeCodablockF,decodeDotCode,decode}=await import('../vendor/sythos-barcode.esm.js');
    const {EXOTIC_SHAPES}=await import('./exotic-shapes.js');
    const {sampleKnownGrid,samplePerspectiveGrid}=await import('./exotic-grid.js');
    const {width,height,data}=image;
    const strict=format==='codablockf'?decodeCodablockF:decodeDotCode;
    if(width*height>2_000_000)return null;
    if(exact){
      const scale=format==='codablockf'?4:5,margin=format==='codablockf'?12:10;
      if(width%scale===0&&height%scale===0){
        const cols=width/scale-margin*2,rows=height/scale-margin*2;
        if(cols>0&&rows>0){
          const matrix=new BitMatrix(cols,rows);
          for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
            const px=((y+margin)*scale+(scale>>1))*width+(x+margin)*scale+(scale>>1);
            if(data[px*4]<128)matrix.set(x,y);
          }
          const result=strict(matrix)?.text;
          if(isGameText(result))return {text:result,format:format==='codablockf'?'CodablockF':'DotCode'};
        }
      }
    }
    const text=phase%3===2
      ?samplePerspectiveGrid(image,EXOTIC_SHAPES[format],format==='codablockf'?12:10,BitMatrix,strict)
      :sampleKnownGrid(image,EXOTIC_SHAPES[format],BitMatrix,strict);
    if(isGameText(text))return {text,format:format==='codablockf'?'CodablockF':'DotCode'};
    if(width*height<=450_000&&phase===0){
      const result=decode(image,{formats:[format]}).find(x=>isGameText(x.text))?.text;
      if(result)return {text:result,format:format==='codablockf'?'CodablockF':'DotCode'};
    }
  }catch{/* A failed experimental reader never rejects all other formats. */}
  return null;
}
async function decodeIris(image){
  try{
    const {decodeColor}=await import('../vendor/iris/color.js');
    const {decodeColorMarkers}=await import('../vendor/iris/markers.js');
    const {decodeColorRobust}=await import('../vendor/iris/robust.js');
    const {cropIrisCard,cropIrisDisk}=await import('./iris-camera.js');
    const {width,height,data}=image;
    const rgb=new Uint8Array(width*height*3);
    for(let i=0,j=0;i<data.length;i+=4,j+=3){
      rgb[j]=data[i];rgb[j+1]=data[i+1];rgb[j+2]=data[i+2];
    }
    const grid={width,height,data:rgb},card=cropIrisCard(grid);
    let text='';
    if(card){
      try{text=decodeColorMarkers(card)?.text||''}catch{}
      if(!text){try{text=decodeColorRobust(card,{budgetMs:650})?.text||''}catch{}}
      if(!text&&Math.abs(card.width-card.height)<Math.max(card.width,card.height)*.08){
        try{text=decodeColor(card)?.text||''}catch{}
      }
    }
    if(!text){
      const disk=cropIrisDisk(grid);
      if(disk){
        try{text=decodeColorRobust(disk,{budgetMs:850})?.text||''}catch{}
        if(!text){try{text=decodeColorMarkers(disk)?.text||''}catch{}}
      }
    }
    if(!text){try{text=decodeColorMarkers(grid)?.text||''}catch{}}
    if(!text&&!card&&Math.abs(width-height)<Math.max(width,height)*.04){
      try{text=decodeColor(grid)?.text||''}catch{}
    }
    if(!text&&!card){try{text=decodeColorRobust(grid,{budgetMs:600})?.text||''}catch{}}
    return isGameText(text)?{text,format:'IRIS'}:null;
  }catch{return null}
}
async function decodeFile(file,id){
  // Check decompressed image dimensions before passing untrusted files into
  // a third-party WASM decoder. Compressed uploads can be tiny but enormous.
  const bitmap=await createImageBitmap(file);
  try{
    if(bitmap.width*bitmap.height>MAX_UPLOAD_PIXELS)
      throw Error('Image is too large to scan safely (12 megapixels max).');
    const zx=await decoder();
    self.postMessage({id,stage:'Checking standard code formats...'});
    const pure={...options,isPure:true,tryHarder:false};
    for(const format of ['DataBarExpStk','RMQRCode']){
      const result=await read(zx,file,{...pure,formats:[format]});
      if(result)return result;
    }
    const first=await read(zx,file,options);
    if(first)return first;
    const pixels=capture(bitmap);
    let result=await read(zx,pixels,options);
    if(result)return result;
    self.postMessage({id,stage:'Checking hard-to-read matrix codes...'});
    const {specialtyCandidates}=await import('./specialty-candidates.js');
    for(const candidate of specialtyCandidates(pixels,'rmqr')){
      result=await read(zx,candidate.image,{...options,formats:['RMQRCode'],
        ...candidate.options,tryRotate:true,tryDownscale:false});
      if(result)return result;
    }
    // Independent rMQR readers preserve the legacy image-upload fallback.
    try{
      const {readAnyDRMQRFrame}=await import('./rmqr-anyd.js');
      result=matching(await readAnyDRMQRFrame(pixels,0));
      if(result)return result;
    }catch{}
    try{
      const {readRxingRMQRFrame}=await import('./rmqr-rxing.js');
      result=matching(await readRxingRMQRFrame(pixels,1));
      if(result)return result;
    }catch{}
    for(const format of ['rmqr','pdf417','micropdf417']){
      for(let phase=0;phase<3;phase++){
        const crop=cropBitmap(bitmap,format,phase);
        result=await read(zx,crop,{...options,formats:[
          format==='rmqr'?'RMQRCode':format==='pdf417'?'PDF417':'MicroPDF417'],
          isPure:false,tryHarder:true});
        if(result)return result;
      }
    }
    self.postMessage({id,stage:'Checking experimental codes...'});
    const normal=capture(bitmap,1,1_900_000,1920);
    const center=captureCenter(bitmap);
    for(const format of ['codablockf','dotcode']){
      for(const image of [normal,center]){
        for(const phase of [2,0]){
          result=await decodeExotic(image,format,phase,phase===0&&image===normal);
          if(result)return result;
        }
      }
    }
    const {decodeChromaPixels}=await import('./chroma.js');
    const {findLightCard,cropRgba}=await import('./specialty-candidates.js');
    const card=findLightCard(pixels);
    if(card&&card.width>100&&card.height>100&&card.width*card.height<pixels.width*pixels.height*.88){
      const isolated=cropRgba(pixels,card);
      const color=await decodeChromaPixels(isolated,(input,opts)=>zx.readBarcodes(input,opts));
      if(isGameText(color))return {text:color,format:'ChromaQR'};
    }
    const color=await decodeChromaPixels(pixels,(input,opts)=>zx.readBarcodes(input,opts));
    if(isGameText(color))return {text:color,format:'ChromaQR'};
    const iris=capture(bitmap,1,1_690_000,1300);
    return await decodeIris(iris);
  }finally{bitmap.close()}
}
self.onmessage=async({data})=>{
  const {id,file}=data||{};
  try{
    if(typeof OffscreenCanvas!=='function'||typeof createImageBitmap!=='function'){
      self.postMessage({id,unsupported:true});return;
    }
    if(!(file instanceof Blob))throw Error('Invalid uploaded image.');
    const result=await decodeFile(file,id);
    self.postMessage({id,result});
  }catch(error){
    self.postMessage({id,error:String(error?.message||error)});
  }
};
