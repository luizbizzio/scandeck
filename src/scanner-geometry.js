// Small, testable camera heuristics. Avoid allocating full-resolution pixels on every scan.
const DENSE=new Set(['code128','pdf417','micropdf417','rmqr','codablockf','dotcode']);
export function captureDimensions(width,height,mode='auto'){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)
    return {width:1,height:1};
  const dense=DENSE.has(mode);
  // Dedicated 1D/rMQR/Maxi readers need full detail to resolve thin modules.
  const highDetail=['code128','rmqr','maxicode','pdf417','micropdf417'].includes(mode);
  const maxEdge=mode==='code128'?2300:mode==='codablockf'?1920:highDetail?1900:dense?1500:mode==='auto'?960:mode==='iris'||mode==='chromaqr'?1200:1440;
  const maxPixels=mode==='code128'?2_200_000:mode==='rmqr'?2_200_000:mode==='codablockf'?1_950_000:highDetail?1_600_000:dense?1_100_000:mode==='chromaqr'||mode==='iris'?700_000:mode==='auto'?500_000:750_000;
  const scale=Math.min(1,maxEdge/Math.max(width,height),Math.sqrt(maxPixels/(width*height)));
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
export function focusedCrop(width,height,mode,phase=0){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
    throw new Error('Invalid camera frame');
  let roiWidth,roiHeight,maxWidth,scale;
  if(mode==='maxicode'){
    const fraction=phase%4===2?.65:phase%4===3?.52:.86;
    roiWidth=roiHeight=Math.min(width,height)*fraction;
    maxWidth=1150;scale=1.55;
  }else if(mode==='rmqr'){
    // Keep the full view regularly; alternate wide and tall centered crops.
    // The symbol is often much wider than its height, but phone orientation varies.
    const wide=phase%3===1;
    roiWidth=width*(wide?.96:.78);
    roiHeight=height*(wide?.68:.92);
    maxWidth=1900;scale=1.35;
  }else if(mode==='pdf417'||mode==='micropdf417'){
    roiWidth=width*.96;roiHeight=height*.76;
    maxWidth=1700;scale=1.1;
  }else{
    // rMQR may appear horizontal or vertical when a phone is turned.
    roiWidth=width*(width>=height?.96:.80);
    roiHeight=height*(height>width?.96:.80);
    maxWidth=1850;scale=1.15;
  }
  const s=Math.min(scale,maxWidth/roiWidth,1400/roiHeight,Math.sqrt(1_650_000/(roiWidth*roiHeight)));
  return {left:(width-roiWidth)/2,top:(height-roiHeight)/2,
    width:roiWidth,height:roiHeight,
    outputWidth:Math.max(1,Math.floor(roiWidth*s)),
    outputHeight:Math.max(1,Math.floor(roiHeight*s))};
}
// Move the camera's pixel window rather than scaling its tiny barcode modules.
// Full-frame passes remain necessary for symbols that are not perfectly centered.
export function exoticCaptureRegion(width,height,frame){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)
    throw Error('Invalid camera size');
  const scale=frame%4===1?.86:frame%4===2?.70:1;
  const w=Math.max(1,Math.floor(width*scale));
  const h=Math.max(1,Math.floor(height*scale));
  return {left:Math.floor((width-w)/2),top:Math.floor((height-h)/2),
    width:w,height:h};
}
export function scanPause(mode){
  if(mode==='iris'||mode==='chromaqr')return 720;
  if(mode==='codablockf'||mode==='dotcode')return 650;
  return mode==='auto'?290:370;
}
