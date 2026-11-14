/* JAB Code camera image locator for the experimental Sythos 8-colour profile.
 * The JAB decoder requires known corners, so find a white symbol card,
 * recover its non-white module bounds, and try a small range of legal sizes.
 * No payload or game-name lookup is used in detection. */
import {findLightCard,cropRgba} from './specialty-candidates.js';
const utf8=new TextDecoder('utf-8',{fatal:true});
function isWhite(r,g,b){return r>232&&g>232&&b>232}
function boxOfInk(image){
 const {width:w,height:h,data}=image;
 // Detect the opaque square ink area on a white card, preserving dark & white modules.
 let left=w,right=-1,top=h,bottom=-1,n=0;
 const step=Math.max(1,Math.floor(Math.min(w,h)/700));
 // Ignore the camera background just beyond a cropped white code card.
 const inset=Math.max(1,Math.floor(Math.min(w,h)*.025));
 for(let y=inset;y<h-inset;y+=step)for(let x=inset;x<w-inset;x+=step){
  const i=(y*w+x)*4;
  if(isWhite(data[i],data[i+1],data[i+2]))continue;
  left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);n++;
 }
 if(n<60||right<left||bottom<top)return null;
 const width=right-left+step,height=bottom-top+step;
 if(Math.abs(width-height)/Math.max(width,height)>.14||width<48)return null;
 return {left,top,width,height};
}
function coloredBounds(image){
 const {width:w,height:h,data}=image;
 const step=Math.max(1,Math.ceil(Math.max(w,h)/480));
 let left=w,right=-1,top=h,bottom=-1,n=0;
 for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
  const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
  if(Math.max(r,g,b)-Math.min(r,g,b)<78||Math.max(r,g,b)<110)continue;
  n++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
 }
 if(n<45||right<=left||bottom<=top)return null;
 const span=Math.max(right-left+step,bottom-top+step);
 if(span<48||Math.abs(right-left-(bottom-top))/span>.18)return null;
 const cx=(left+right+step)/2,cy=(top+bottom+step)/2;
 return {cx,cy,span};
}
function corners(box){
 const l=box.left,t=box.top,r=l+box.width,b=t+box.height;
 return {topLeft:{x:l,y:t},topRight:{x:r,y:t},
  bottomRight:{x:r,y:b},bottomLeft:{x:l,y:b}};
}
function bytesToText(data){
 const text=utf8.decode(data);
 return /^(?:SDS:|SD1:|SDM:|SDC:|SDH:|SDJ:|SDZ:|SDB:|IP3:|V1)/.test(text)?text:'';
}
export function decodeJabPixels(lib,image,{phase=0}={}){
 const {width,height,data}=image||{};
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<65||height<65||
    width*height>2_100_000||data?.length!==width*height*4)return '';
 const color=coloredBounds(image);
 if(!color)return '';
 const card=findLightCard(image);
 const regions=[];
 if(card&&card.width>95&&card.height>95&&card.width*card.height<width*height*.96)
  regions.push(cropRgba(image,card));
 regions.push(image);
 // One JAB version per frame on the first attempt. The Codebreaker is v2.
 // Wrong versions trigger a costly LDPC reduction on cold start, so distribute
 // the others across following frames rather than timing out before v2 is tried.
 const versions=phase%4===0?[2]:phase%4===1?[2,1,3]:phase%4===2?[2,4,5]:[2,6,7,8];
 // Image geometry is determined by actual colored modules, not a stored game identifier.
 for(const region of regions){
  const ink=boxOfInk(region);
  const candidates=[];
  if(ink)candidates.push(ink);
  const colored=coloredBounds(region);
  if(colored){
   // Colored modules typically cover most of the outermost symbol cells.
   // Expand from their extent by one candidate module on either side.
   for(const modules of [25,29,21,33,37,41,45]){
    const side=colored.span*(1+2/modules);
    if(side>Math.min(region.width,region.height)*1.05)continue;
    candidates.push({left:colored.cx-side/2,top:colored.cy-side/2,width:side,height:side});
   }
  }
  // Low-cost byte mode checksum/LDPC failure rejects incorrect geometry.
  for(const rect of candidates.slice(0,phase%2===0?4:5)){
   const quad=corners(rect);
   for(const version of versions){
    try{
     const text=bytesToText(lib.decodeJABCode(region,quad,version));
     if(text)return text;
    }catch{}
   }
  }
 }
 return '';
}
