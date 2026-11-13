// Small, testable camera heuristics. Avoid allocating full-resolution pixels on every scan.
const DENSE=new Set(['code128','pdf417','rmqr','codablockf','dotcode']);
export function captureDimensions(width,height,mode='auto'){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)
    return {width:1,height:1};
  const dense=DENSE.has(mode);
  const maxEdge=dense?1920:mode==='auto'?1280:mode==='iris'||mode==='chromaqr'?1680:1440;
  const maxPixels=dense?1_900_000:mode==='chromaqr'||mode==='iris'?1_650_000:1_350_000;
  const scale=Math.min(1,maxEdge/Math.max(width,height),Math.sqrt(maxPixels/(width*height)));
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
export function focusedCrop(width,height,mode){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
    throw new Error('Invalid camera frame');
  let roiWidth,roiHeight,maxWidth,scale;
  if(mode==='maxicode'){
    roiWidth=roiHeight=Math.min(width,height)*.82;
    maxWidth=900;scale=1.35;
  }else if(mode==='pdf417'){
    roiWidth=width*.96;roiHeight=height*.76;
    maxWidth=1700;scale=1.1;
  }else{
    // rMQR may appear horizontal or vertical when a phone is turned.
    roiWidth=width*(width>=height?.96:.80);
    roiHeight=height*(height>width?.96:.80);
    maxWidth=1600;scale=1.15;
  }
  const s=Math.min(scale,maxWidth/roiWidth,1400/roiHeight,Math.sqrt(1_650_000/(roiWidth*roiHeight)));
  return {left:(width-roiWidth)/2,top:(height-roiHeight)/2,
    width:roiWidth,height:roiHeight,
    outputWidth:Math.max(1,Math.floor(roiWidth*s)),
    outputHeight:Math.max(1,Math.floor(roiHeight*s))};
}
export function scanPause(mode){
  if(mode==='iris'||mode==='chromaqr')return 360;
  if(mode==='codablockf'||mode==='dotcode')return 300;
  return 180;
}
