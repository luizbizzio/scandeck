/* Camera preprocessor for symbols with weak detection in ZXing.
   Locate a pale barcode card on a dark camera scene, then give the decoder
   both an unmodified crop and a clean monochrome candidate.
   No symbol payloads or game names are used for detection. */
const light=(data,i)=>{
  const r=data[i],g=data[i+1],b=data[i+2];
  return r>187&&g>187&&b>187&&Math.max(r,g,b)-Math.min(r,g,b)<65;
};
export function findLightCard(image){
  const {width:w,height:h,data}=image||{};
  if(!w||!h||data?.length!==w*h*4||w*h>3_000_000)return null;
  const stride=Math.max(2,Math.ceil(Math.max(w,h)/450));
  const gw=Math.ceil(w/stride),gh=Math.ceil(h/stride),total=gw*gh;
  const lightMask=new Uint8Array(total),visited=new Uint8Array(total);
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){
    const px=Math.min(w-1,Math.floor((x+.5)*stride));
    const py=Math.min(h-1,Math.floor((y+.5)*stride));
    lightMask[y*gw+x]=light(data,(py*w+px)*4)?1:0;
  }
  const queue=new Int32Array(total);let best=null;
  for(let root=0;root<total;root++){
    if(!lightMask[root]||visited[root])continue;
    queue[0]=root;visited[root]=1;let read=0,end=1;
    let minX=gw,minY=gh,maxX=0,maxY=0;
    while(read<end){
      const v=queue[read++],x=v%gw,y=v/gw|0;
      if(x<minX)minX=x;if(x>maxX)maxX=x;
      if(y<minY)minY=y;if(y>maxY)maxY=y;
      if(x>0&&lightMask[v-1]&&!visited[v-1])visited[v-1]=1,queue[end++]=v-1;
      if(x<gw-1&&lightMask[v+1]&&!visited[v+1])visited[v+1]=1,queue[end++]=v+1;
      if(y>0&&lightMask[v-gw]&&!visited[v-gw])visited[v-gw]=1,queue[end++]=v-gw;
      if(y<gh-1&&lightMask[v+gw]&&!visited[v+gw])visited[v+gw]=1,queue[end++]=v+gw;
    }
    const bw=(maxX-minX+1)*stride,bh=(maxY-minY+1)*stride;
    if(end<120||bw<80||bh<55||bw*bh<w*h*.015||bw*bh>w*h*.97)continue;
    if(!best||end>best.count)best={count:end,x:minX*stride,y:minY*stride,
      width:bw,height:bh};
  }
  if(!best)return null;
  const pad=Math.max(3,Math.round(Math.min(best.width,best.height)*.022));
  const x=Math.max(0,best.x-pad),y=Math.max(0,best.y-pad);
  const right=Math.min(w,best.x+best.width+pad),bottom=Math.min(h,best.y+best.height+pad);
  return {x,y,width:right-x,height:bottom-y};
}
export function cropRgba(image,region){
  const {width:w,data}=image;
  const x=Math.max(0,Math.floor(region.x)),y=Math.max(0,Math.floor(region.y));
  const width=Math.max(1,Math.floor(region.width)),height=Math.max(1,Math.floor(region.height));
  const out=new Uint8ClampedArray(width*height*4);
  for(let row=0;row<height;row++){
    const from=((y+row)*w+x)*4;
    out.set(data.subarray(from,from+width*4),row*width*4);
  }
  return {width,height,data:out};
}
export function thresholdRgba(image){
  const {width,height,data}=image;
  const histogram=new Uint32Array(256);
  for(let i=0;i<data.length;i+=16)histogram[(data[i]*77+data[i+1]*150+data[i+2]*29)>>8]++;
  let total=0,sum=0;
  for(let i=0;i<256;i++){total+=histogram[i];sum+=histogram[i]*i}
  if(!total)return image;
  let wb=0,sb=0,maxVariance=-1,threshold=127;
  for(let i=0;i<256;i++){
    wb+=histogram[i];if(!wb)continue;
    const wf=total-wb;if(!wf)break;
    sb+=i*histogram[i];
    const between=wb*wf*(sb/wb-(sum-sb)/wf)**2;
    if(between>maxVariance){maxVariance=between;threshold=i}
  }
  const out=new Uint8ClampedArray(data.length);
  for(let i=0;i<data.length;i+=4){
    const dark=((data[i]*77+data[i+1]*150+data[i+2]*29)>>8)<=threshold;
    const v=dark?0:255;out[i]=out[i+1]=out[i+2]=v;out[i+3]=255;
  }
  return {width,height,data:out};
}
export function specialtyCandidates(image,format){
  if(format!=='maxicode'&&format!=='rmqr')return [];
  const card=findLightCard(image);
  if(!card)return [];
  const crop=cropRgba(image,card);
  if(crop.width<75||crop.height<55||crop.width*crop.height>1_600_000)return [];
  return [
    {image:crop,options:{isPure:format==='maxicode',binarizer:'LocalAverage'}},
    {image:thresholdRgba(crop),options:{isPure:true,binarizer:'FixedThreshold'}}
  ];
}
