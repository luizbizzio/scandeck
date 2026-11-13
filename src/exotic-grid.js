/* Detect a centered, mostly frontal symbol from its actual camera pixels.
   Shape hints contain geometry only, never payloads or game identifiers. */
export function sampleKnownGrid(image,dimensions,BitMatrix,decode){
  const {width:w,height:h,data}=image,[cols,rows]=dimensions||[];
  if(!w||!h||!data||cols<5||rows<5||w*h>3_000_000)return '';
  // A light card isolates the code from dark browser/room surroundings.
  const step=Math.max(2,Math.round(Math.max(w,h)/450));
  const xHits=new Uint16Array(Math.ceil(w/step));
  const yHits=new Uint16Array(Math.ceil(h/step));
  const gray=(x,y)=>{
    const i=(y*w+x)*4;
    return (data[i]*77+data[i+1]*150+data[i+2]*29)>>8;
  };
  for(let y=0,yi=0;y<h;y+=step,yi++)for(let x=0,xi=0;x<w;x+=step,xi++){
    if(gray(x,y)>185){xHits[xi]++;yHits[yi]++}
  }
  const span=(counts,limit)=>{
    let peak=0;for(const n of counts)peak=Math.max(peak,n);
    if(!peak)return [0,limit];
    const min=Math.max(1,Math.floor(peak*.15));
    let left=limit,right=0;
    for(let i=0;i<counts.length;i++)if(counts[i]>=min){
      left=Math.min(left,i*step);right=Math.max(right,(i+1)*step);
    }
    return right>left?[Math.max(0,left),Math.min(limit,right)]:[0,limit];
  };
  const [pl,pr]=span(xHits,w),[pt,pb]=span(yHits,h);
  const insetX=Math.max(1,Math.floor((pr-pl)*.008));
  const insetY=Math.max(1,Math.floor((pb-pt)*.008));
  let minX=w,minY=h,maxX=0,maxY=0,dark=0;
  const stride=Math.max(1,Math.floor(Math.max(w,h)/1400));
  for(let y=pt+insetY;y<pb-insetY;y+=stride)
    for(let x=pl+insetX;x<pr-insetX;x+=stride)
      if(gray(x,y)<120){
        minX=Math.min(minX,x);minY=Math.min(minY,y);
        maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);dark++;
      }
  if(dark<cols*rows*.03||maxX<=minX||maxY<=minY)return '';
  const inkWidth=maxX-minX+stride,inkHeight=maxY-minY+stride;
  const centerX=(minX+maxX+stride)/2,centerY=(minY+maxY+stride)/2;
  // Test the strongest aligned hypothesis first; the strict checksum prevents
  // accepting a similar-looking image or inferring a result from the hint.
  const quarterTurns=inkWidth>inkHeight?[0,2,1,3]:[0,2,1,3];
  for(const rot of quarterTurns){
    const physicalCols=rot%2?rows:cols,physicalRows=rot%2?cols:rows;
    const sx=inkWidth/physicalCols,sy=inkHeight/physicalRows;
    // If the two axes imply incompatible cell sizes, another symbol or a
    // strongly tilted image is in the frame; leave it to the generic reader.
    if(sx<.65||sy<.65||Math.max(sx,sy)>Math.min(sx,sy)*2.5)continue;
    // A few degrees of phone tilt are common even with a flat screen.
    // Reconstruct the unrotated rectangle from its axis-aligned ink bounds.
    for(const angle of [0,-.035,.035,-.07,.07]){
      const co=Math.cos(angle),si=Math.abs(Math.sin(angle));
      const divisor=co*co-si*si;
      const basisWidth=(inkWidth*co-inkHeight*si)/divisor;
      const basisHeight=(inkHeight*co-inkWidth*si)/divisor;
      if(basisWidth<=0||basisHeight<=0)continue;
      for(const scale of angle===0?[1,1.018,.982,1.045,.955]:[1,1.018,.982]){
        const wide=basisWidth*scale,high=basisHeight*scale;
        const m=new BitMatrix(cols,rows);
        for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
          const u=(x+.5)/cols,v=(y+.5)/rows;
          const tx=rot===0?u:rot===1?1-v:rot===2?1-u:v;
          const ty=rot===0?v:rot===1?u:rot===2?1-v:1-u;
          const dx=(tx-.5)*wide,dy=(ty-.5)*high;
          const ix=Math.max(0,Math.min(w-1,Math.floor(centerX+dx*co-dy*Math.sin(angle))));
          const iy=Math.max(0,Math.min(h-1,Math.floor(centerY+dx*Math.sin(angle)+dy*co)));
          if(gray(ix,iy)<128)m.set(x,y);
        }
        try{const hit=decode(m);if(hit?.text)return hit.text}catch{}
      }
    }
  }
  return '';
}
