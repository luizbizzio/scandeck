// Prefer common barcodes in Auto. Experimental image readers still run,
// but never dominate the camera loop or accumulate decode debt over time.
const QUICK_FORMATS=[
  ['QRCode','DataMatrix','Aztec','Code128','EAN13'],
  ['QRCode','DataMatrix','DataBarExpStk'],
  ['QRCode','MicroQRCode','MicroPDF417'],
  ['QRCode','Code128','EAN13'],
  ['QRCode','DataMatrix','Aztec']
];
export function autoQuickFormats(index){
  return QUICK_FORMATS[((index%QUICK_FORMATS.length)+QUICK_FORMATS.length)%QUICK_FORMATS.length];
}
export function createAutoScanScheduler(startTime=0){
  let quickReads=0;
  let nextDot=startTime+4500,nextPdf=startTime+12000,nextChroma=startTime+5000,nextIris=startTime+7000;
  return {
    next(now){
      // At least four regular barcode frames between every specialized pass.
      if(quickReads<4){quickReads++;return 'standard'}
      // Earliest scheduled deadline wins. DotCode must not starve color readers.
      const due=[
        ['dotcode',nextDot],['pdf417',nextPdf],['chroma',nextChroma],['iris',nextIris]
      ].filter(([,time])=>now>=time).sort((a,b)=>a[1]-b[1]);
      if(due.length){
        const kind=due[0][0];quickReads=0;
        if(kind==='dotcode')nextDot=now+7000;
        else if(kind==='pdf417')nextPdf=now+18000;
        else if(kind==='chroma')nextChroma=now+15000;
        else nextIris=now+18000;
        return kind;
      }
      quickReads++;
      return 'standard';
    },
    report(kind,finishedAt,decodeMs,skipped=false){
      // Recheck grayscale scenes cheaply without running a heavy color decoder.
      if(skipped){
        if(kind==='chroma')nextChroma=Math.min(nextChroma,finishedAt+6500);
        if(kind==='iris')nextIris=Math.min(nextIris,finishedAt+8500);
        return;
      }
      // Keep expensive color decoding rare on slow phones even with shorter normal intervals.
      // Dedicated IRIS and ChromaQR focus never uses these throttles.
      if(kind==='chroma'&&decodeMs>1800)
        nextChroma=Math.max(nextChroma,finishedAt+30000);
      if(kind==='iris'&&decodeMs>1600)
        nextIris=Math.max(nextIris,finishedAt+35000);
      if(kind==='pdf417'&&decodeMs>1000)
        nextPdf=Math.max(nextPdf,finishedAt+22000);
      if(kind==='dotcode'&&decodeMs>1500)
        nextDot=Math.max(nextDot,finishedAt+11000);
    }
  };
}

/* Very cheap RGBA pre-check: avoid launching the expensive color decoder
   on a monochrome scene. Use a low threshold to retain small colored codes. */
export function hasColorSignal(frame){
  const data=frame?.data;
  if(!data||data.length<4||data.length%4)return false;
  const pixels=data.length/4,step=Math.max(1,Math.floor(pixels/1800));
  let count=0,samples=0;
  for(let p=0;p<pixels;p+=step){
    const i=p*4,r=data[i],g=data[i+1],b=data[i+2];
    const max=Math.max(r,g,b),min=Math.min(r,g,b);
    if(max>=85&&max-min>=40)count++;
    samples++;
  }
  return count>=Math.max(4,Math.floor(samples*.003));
}
