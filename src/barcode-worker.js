/* Long-running camera decoders run away from the UI thread.
   Only one request is sent at a time, and closing the camera terminates this worker. */
let decoderPromise=null,preprocessorPromise=null;
function getSpecialtyPreprocessor(){
  if(!preprocessorPromise)preprocessorPromise=import('./specialty-candidates.js').catch(error=>{
    preprocessorPromise=null;throw error;
  });
  return preprocessorPromise;
}
function rotatePixels(image,clockwise){
  const {width,height,data}=image;
  const out=new Uint8ClampedArray(data.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const from=(y*width+x)*4;
    const dst=clockwise?x*height+(height-1-y):(width-1-x)*height+y;
    const to=dst*4;
    out[to]=data[from];out[to+1]=data[from+1];out[to+2]=data[from+2];out[to+3]=data[from+3];
  }
  return {width:height,height:width,data:out};
}
function getDecoder(){
  if(!decoderPromise)decoderPromise=(async()=>{
    importScripts('../vendor/zxing-wasm/index.js');
    const zxing=self.ZXingWASM;
    if(!zxing?.readBarcodes)throw Error('ZXing worker unavailable');
    zxing.prepareZXingModule({overrides:{locateFile:path=>
      path.endsWith('.wasm')?new URL('../vendor/zxing-wasm/'+path,self.location.href).href:path}});
    return zxing;
  })().catch(error=>{decoderPromise=null;throw error});
  return decoderPromise;
}
self.onmessage=async({data:task})=>{
  const {id,mode,width,height,buffer,options}=task||{};
  let result=mode==='chroma'?'':[];
  try{
    if(!Number.isInteger(width)||!Number.isInteger(height)||
       width<1||height<1||width*height>3_000_000||
       !(buffer instanceof ArrayBuffer)||buffer.byteLength!==width*height*4)
      throw Error('Invalid camera frame');
    const zxing=await getDecoder();
    const pixels={width,height,data:new Uint8ClampedArray(buffer)};
    if(mode==='chroma'){
      const {decodeChromaPixels}=await import('./chroma.js');
      const readQr=(image,opts)=>zxing.readBarcodes(image,opts);
      // A color QR on a dark website often has a clearly separated white card.
      // Cropping that card first greatly reduces work across three RGB planes.
      const {findLightCard,cropRgba}=await getSpecialtyPreprocessor();
      const card=findLightCard(pixels);
      if(card&&card.width>100&&card.height>100&&card.width*card.height<width*height*.88){
        const isolated=cropRgba(pixels,card);
        result=await decodeChromaPixels(isolated,readQr)||'';
      }
      if(!result)result=await decodeChromaPixels(pixels,readQr)||'';
    }else if(mode==='standard'){
      const {retryRotated=false,retryBinarizer=false,specialty=null,specialtyPhase=0,...readOptions}=options||{};
      let hits=await zxing.readBarcodes(pixels,readOptions);
      if(!hits.some(hit=>hit.text)&&retryBinarizer){
        const binarizer=readOptions.binarizer==='LocalAverage'?'GlobalHistogram':'LocalAverage';
        hits=await zxing.readBarcodes(pixels,{...readOptions,binarizer});
      }
      if(!hits.some(hit=>hit.text)&&retryRotated){
        // Orthogonal pixel rotations change the input geometry seen by the decoder.
        for(const clockwise of [true,false]){
          hits=await zxing.readBarcodes(rotatePixels(pixels,clockwise),{...readOptions,tryRotate:false});
          if(hits.some(hit=>hit.text))break;
        }
      }
      if(!hits.some(hit=>hit.text)&&(specialty==='maxicode'||specialty==='rmqr')){
        const {specialtyCandidates}=await getSpecialtyPreprocessor();
        // Split expensive rMQR variants across frames to avoid camera timeouts.
        const candidates=specialtyCandidates(pixels,specialty,specialtyPhase);
        const start=specialtyPhase%2*2;
        for(const candidate of candidates.slice(start,start+2)){
          const more=await zxing.readBarcodes(candidate.image,{
            ...readOptions,...candidate.options,
            tryDownscale:false,tryDenoise:false,tryRotate:specialty==='rmqr',
            tryHarder:specialty==='rmqr'&&!candidate.options.isPure
          });
          if(more.some(hit=>hit.text)){hits=more;break}
        }
      }
      result=hits.filter(hit=>typeof hit.text==='string'&&hit.text.length).map(hit=>({text:hit.text,format:hit.format})).slice(0,2);
    }
  }catch{
    // Camera failures never render an error on each frame; the next frame may succeed.
  }
  self.postMessage({id,result});
};
