/* Pure-grid rescue for MaxiCode camera images.
   ZXing's MaxiCode reader has no general object detector and scans one
   bounding-box hypothesis. Try nearby 30x33 hex-cell samplings with the
   independent Sythos Reed-Solomon/MaxiCode decoder. */
export function recoverMaxiGrid(image,BitMatrix,decodeMaxiCode){
 const {width:w,height:h,data}=image||{};
 if(!w||!h||data?.length!==w*h*4||w*h>1_700_000)return '';
 let minX=w,maxX=-1,minY=h,maxY=-1;
 const gray=(x,y)=>{
   const i=(y*w+x)*4;
   return (data[i]*77+data[i+1]*150+data[i+2]*29)>>8;
 };
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   if(gray(x,y)>122)continue;
   if(x<minX)minX=x;if(x>maxX)maxX=x;
   if(y<minY)minY=y;if(y>maxY)maxY=y;
 }
 if(maxX-minX<90||maxY-minY<80)return '';
 const bw=maxX-minX+1,bh=maxY-minY+1;
 for(const zoom of [1,1.012,.988,1.032,.968]){
   for(const shiftY of [0,-.28,.28]){
     for(const shiftX of [0,-.28,.28]){
       const m=new BitMatrix(30,33);
       for(let row=0;row<33;row++){
         const y=Math.round(minY+(row+.5+shiftY)*bh/33);
         if(y<0||y>=h)continue;
         for(let col=0;col<30;col++){
           const x=Math.round(minX+(col+.5+(row%2)*.5+shiftX)*bw/30*zoom+bw*(1-zoom)/2);
           if(x>=0&&x<w&&gray(x,y)<136)m.set(col,row);
         }
       }
       try{const found=decodeMaxiCode(m);if(found?.text)return found.text}catch{}
     }
   }
 }
 return '';
}
