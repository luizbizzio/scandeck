/* Long-running camera decoders run away from the UI thread.
   Only one request is sent at a time, and closing the camera terminates this worker. */
let decoderPromise=null;
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
      result=await decodeChromaPixels(pixels,(image,opts)=>zxing.readBarcodes(image,opts))||'';
    }else if(mode==='standard'){
      const {retryRotated=false,retryBinarizer=false,...readOptions}=options||{};
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
      result=hits.filter(hit=>typeof hit.text==='string'&&hit.text.length).map(hit=>({text:hit.text,format:hit.format})).slice(0,2);
    }
  }catch{
    // Camera failures never render an error on each frame; the next frame may succeed.
  }
  self.postMessage({id,result});
};
