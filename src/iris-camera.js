/* Isolate an IRIS disk's pale card from a busy/dark camera frame.
   RGB markers and the surrounding quiet margin are retained. */
import {findLightCard,cropRgba} from './specialty-candidates.js';
export function cropIrisCard(rgb){
 const {width,height,data}=rgb||{};
 if(!width||!height||data?.length!==width*height*3||width*height>2_000_000)return null;
 const rgba=new Uint8ClampedArray(width*height*4);
 for(let i=0,j=0;i<data.length;i+=3,j+=4){
   rgba[j]=data[i];rgba[j+1]=data[i+1];rgba[j+2]=data[i+2];rgba[j+3]=255;
 }
 const image={width,height,data:rgba};
 const card=findLightCard(image);
 if(!card)return null;
 const extend=Math.max(5,Math.round(Math.min(card.width,card.height)*.055));
 const x=Math.max(0,card.x-extend),y=Math.max(0,card.y-extend);
 const candidate=cropRgba(image,{x,y,
   width:Math.min(width-x,card.width+2*extend),
   height:Math.min(height-y,card.height+2*extend)});
 if(candidate.width*candidate.height>1_600_000)return null;
 const pixels=new Uint8Array(candidate.width*candidate.height*3);
 for(let i=0,j=0;i<candidate.data.length;i+=4,j+=3){
   pixels[j]=candidate.data[i];pixels[j+1]=candidate.data[i+1];pixels[j+2]=candidate.data[i+2];
 }
 return {width:candidate.width,height:candidate.height,data:pixels};
}

// Find the saturated IRIS disk itself when its white quiet zone is clipped.
// Three calibration markers live outside the disc, so this fallback relies
// on the robust pupil/ring decoder rather than requiring all three markers.
export function cropIrisDisk(rgb){
 const {width:w,height:h,data}=rgb||{};
 if(!w||!h||w*h>2_000_000||data?.length!==w*h*3)return null;
 const stride=Math.max(2,Math.ceil(Math.max(w,h)/450));
 let left=w,right=0,top=h,bottom=0,n=0;
 for(let y=Math.floor(h*.05);y<h*.95;y+=stride)for(let x=Math.floor(w*.05);x<w*.95;x+=stride){
   const i=(y*w+x)*3,r=data[i],g=data[i+1],b=data[i+2];
   const hi=Math.max(r,g,b),lo=Math.min(r,g,b);
   if(hi>155&&hi-lo>92&&lo<185){
     if(x<left)left=x;if(x>right)right=x;
     if(y<top)top=y;if(y>bottom)bottom=y;
     n++;
   }
 }
 const bw=right-left,bh=bottom-top;
 if(n<80||bw<Math.min(w,h)*.14||bh<Math.min(w,h)*.14||
    Math.max(bw,bh)>Math.min(w,h)*1.2||bw/bh<.55||bw/bh>1.85)return null;
 const side=Math.ceil(Math.max(bw,bh)*1.08);
 const pad=Math.max(8,Math.round(side*.08)),outSide=side+pad*2;
 if(outSide*outSide>1_600_000)return null;
 const out=new Uint8Array(outSide*outSide*3).fill(255);
 const x0=Math.round((left+right-side)/2),y0=Math.round((top+bottom-side)/2);
 for(let y=0;y<side;y++){
   const sy=y0+y;if(sy<0||sy>=h)continue;
   const start=Math.max(0,-x0),end=Math.min(side,w-x0);
   if(end<=start)continue;
   const dst=((y+pad)*outSide+start+pad)*3,from=(sy*w+x0+start)*3;
   out.set(data.subarray(from,from+(end-start)*3),dst);
 }
 return {width:outSide,height:outSide,data:out};
}
