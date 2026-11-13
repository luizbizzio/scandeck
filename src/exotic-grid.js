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
  for(let y=pt+insetY;y<pb-insetY;y+=stride){
    // A tilted white page has dark triangles inside its bounding rectangle.
    // Do not mistake those background corners for the barcode itself.
    let first=pr,last=pl,bright=0;
    for(let x=pl;x<pr;x+=stride)if(gray(x,y)>185){
      first=Math.min(first,x);last=Math.max(last,x);bright++;
    }
    if(bright<Math.max(3,Math.floor((pr-pl)/stride*.05)))continue;
    for(let x=Math.max(pl+insetX,first+stride);x<Math.min(pr-insetX,last-stride);x+=stride)
      if(gray(x,y)<120){
        minX=Math.min(minX,x);minY=Math.min(minY,y);
        maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);dark++;
      }
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
    for(const angle of [0,-.035,.035]){
      const co=Math.cos(angle),si=Math.abs(Math.sin(angle));
      const divisor=co*co-si*si;
      const basisWidth=(inkWidth*co-inkHeight*si)/divisor;
      const basisHeight=(inkHeight*co-inkWidth*si)/divisor;
      if(basisWidth<=0||basisHeight<=0)continue;
      for(const scale of angle===0?[1,1.008,.992,1.018,.982]:[1,1.008,.992]){
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


/* Recover a projective barcode grid from a bright, four-corner card.
   No payload template or pre-decoded game is used. The symbol checksum
   validates every sampled matrix independently. */
export function samplePerspectiveGrid(image,dimensions,margin,BitMatrix,decode){
  const {width:w,height:h,data}=image,[cols,rows]=dimensions||[];
  if(!w||!h||!data||cols<5||rows<5||w*h>2_000_000)return '';
  const stride=Math.max(2,Math.ceil(Math.max(w,h)/650));
  const gw=Math.ceil(w/stride),gh=Math.ceil(h/stride),n=gw*gh;
  const bright=new Uint8Array(n),seen=new Uint8Array(n),stack=new Int32Array(n);
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){
    const px=Math.min(w-1,x*stride+stride/2|0),py=Math.min(h-1,y*stride+stride/2|0);
    const i=(py*w+px)*4;
    bright[y*gw+x]=data[i]*77+data[i+1]*150+data[i+2]*29>193*256?1:0;
  }
  const candidates=[];
  for(let origin=0;origin<n;origin++){
    if(!bright[origin]||seen[origin])continue;
    seen[origin]=1;stack[0]=origin;
    let read=0,end=1;
    let tl=null,tr=null,br=null,bl=null;
    let loSum=Infinity,hiSum=-Infinity,loDiff=Infinity,hiDiff=-Infinity;
    while(read<end){
      const k=stack[read++],x=k%gw,y=(k/gw)|0;
      const px=Math.min(w-1,(x+.5)*stride),py=Math.min(h-1,(y+.5)*stride);
      const sum=px+py,diff=px-py;
      if(sum<loSum){loSum=sum;tl=[px,py]}
      if(sum>hiSum){hiSum=sum;br=[px,py]}
      if(diff>hiDiff){hiDiff=diff;tr=[px,py]}
      if(diff<loDiff){loDiff=diff;bl=[px,py]}
      const neighbors=[k-gw,k+gw,k-1,k+1];
      for(let i=0;i<4;i++){
        if(i===0&&y===0||i===1&&y===gh-1||i===2&&x===0||i===3&&x===gw-1)continue;
        const next=neighbors[i];
        if(bright[next]&&!seen[next]){seen[next]=1;stack[end++]=next}
      }
    }
    if(end<400||!tl||!tr||!br||!bl)continue;
    const width=Math.hypot(tr[0]-tl[0],tr[1]-tl[1]);
    const height=Math.hypot(bl[0]-tl[0],bl[1]-tl[1]);
    if(width<cols*.53&&height<cols*.53||width<55||height<55)continue;
    if(Math.abs((tr[0]-tl[0])*(bl[1]-tl[1])-(tr[1]-tl[1])*(bl[0]-tl[0]))<2500)continue;
    candidates.push({size:end,quad:[tl,tr,br,bl],width,height});
  }
  candidates.sort((a,b)=>b.size-a.size);
  const gray=(x,y)=>{
    const i=((y|0)*w+(x|0))*4;
    return (data[i]*77+data[i+1]*150+data[i+2]*29)>>8;
  };
  for(const item of candidates.slice(0,2)){
    const [tl,tr,br,bl]=item.quad;
    // Homography mapping the source card square into its camera quadrilateral.
    const dx1=tr[0]-br[0],dx2=bl[0]-br[0],dx3=tl[0]-tr[0]+br[0]-bl[0];
    const dy1=tr[1]-br[1],dy2=bl[1]-br[1],dy3=tl[1]-tr[1]+br[1]-bl[1];
    const det=dx1*dy2-dx2*dy1;
    if(Math.abs(det)<1)continue;
    const g=(dx3*dy2-dx2*dy3)/det,hp=(dx1*dy3-dx3*dy1)/det;
    const a=tr[0]-tl[0]+g*tr[0],b=bl[0]-tl[0]+hp*bl[0],c=tl[0];
    const d=tr[1]-tl[1]+g*tr[1],e=bl[1]-tl[1]+hp*bl[1],f=tl[1];
    for(const rot of [0,2,1,3]){
      const actualRatio=item.width/item.height;
      const targetRatio=(rot%2?(rows+2*margin)/(cols+2*margin):(cols+2*margin)/(rows+2*margin));
      if(actualRatio/targetRatio>2.1||targetRatio/actualRatio>2.1)continue;
      for(const zoom of [1,1.035,.97,1.1]){
        const matrix=new BitMatrix(cols,rows);
        for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
          const pu=(x+margin+.5)/(cols+2*margin),pv=(y+margin+.5)/(rows+2*margin);
          const u0=rot===0?pu:rot===1?1-pv:rot===2?1-pu:pv;
          const v0=rot===0?pv:rot===1?pu:rot===2?1-pv:1-pu;
          const u=.5+(u0-.5)*zoom,v=.5+(v0-.5)*zoom;
          const den=g*u+hp*v+1;
          const ix=Math.round((a*u+b*v+c)/den),iy=Math.round((d*u+e*v+f)/den);
          if(ix>=0&&iy>=0&&ix<w&&iy<h&&gray(ix,iy)<128)matrix.set(x,y);
        }
        try{const hit=decode(matrix);if(hit?.text)return hit.text}catch{}
      }
    }
  }
  return '';
}
