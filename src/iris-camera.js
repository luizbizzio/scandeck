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
