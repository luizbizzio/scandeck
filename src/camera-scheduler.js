// Prefer common barcodes in Auto. Experimental color readers still run,
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
  let nextPdf=startTime+2800,nextChroma=startTime+9000,nextIris=startTime+14500;
  return {
    next(now){
      // At least four regular barcode frames between every specialized pass.
      if(quickReads<4){quickReads++;return 'standard'}
      if(now>=nextChroma&&nextChroma<=nextIris){
        nextChroma=now+18000;quickReads=0;return 'chroma'
      }
      if(now>=nextIris){
        nextIris=now+25000;quickReads=0;return 'iris'
      }
      if(now>=nextChroma){
        nextChroma=now+18000;quickReads=0;return 'chroma'
      }
      if(now>=nextPdf){
        nextPdf=now+4200;quickReads=0;return 'pdf417'
      }
      quickReads++;
      return 'standard';
    },
    report(kind,finishedAt,decodeMs){
      // On slow phones keep exceptionally expensive color decoding rare in Auto.
      // Dedicated IRIS and ChromaQR focus never uses these throttles.
      if(kind==='chroma'&&decodeMs>2400)
        nextChroma=Math.max(nextChroma,finishedAt+30000);
      if(kind==='iris'&&decodeMs>1900)
        nextIris=Math.max(nextIris,finishedAt+34000);
      if(kind==='pdf417'&&decodeMs>1800)
        nextPdf=Math.max(nextPdf,finishedAt+7000);
    }
  };
}
