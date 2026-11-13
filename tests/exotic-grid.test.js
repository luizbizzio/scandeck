import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {BitMatrix,decodeDotCode,decodeCodablockF} from '@sythos/js_barcode_universal';
import {EXOTIC_SHAPES} from '../src/exotic-shapes.js';
import {sampleKnownGrid,samplePerspectiveGrid} from '../src/exotic-grid.js';

// Simulate a camera that sees a white barcode sheet against a dark background.
function cameraImage(png,scale){
 const w=1300,h=940,data=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<data.length;i+=4)data[i]=19,data[i+1]=27,data[i+2]=23,data[i+3]=255;
 const sw=Math.round(png.width*scale),sh=Math.round(png.height*scale);
 assert.ok(sw<w-40&&sh<h-40,'Simulated barcode must fit');
 const left=Math.floor((w-sw)/2),top=Math.floor((h-sh)/2);
 for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
   const px=Math.min(png.width-1,Math.floor((x+.5)*png.width/sw));
   const py=Math.min(png.height-1,Math.floor((y+.5)*png.height/sh));
   const from=(py*png.width+px)*4,to=((top+y)*w+left+x)*4;
   for(let i=0;i<4;i++)data[to+i]=png.data[from+i];
 }
 return {width:w,height:h,data};
}
for(const [name,format,scale] of [
 ['snake-codablockf','codablockf',.72],
 ['neon-dodge-dotcode','dotcode',.76]
]){
 test(format+' first-party PNG decodes after camera-size scaling and framing',()=>{
  const png=PNG.sync.read(readFileSync(new URL('../assets/'+name+'.png',import.meta.url)));
  const image=cameraImage(png,scale),decode=format==='dotcode'?decodeDotCode:decodeCodablockF;
  const text=sampleKnownGrid(image,EXOTIC_SHAPES[format],BitMatrix,decode);
  const expected=readFileSync(new URL('../assets/'+name+'.txt',import.meta.url),'utf8');
  assert.equal(text,expected,'Raw photographed modules must decode, not just the encoded payload');
 });
}

function cameraAtAngle(png,scale,radians){
 const w=1300,h=940,data=new Uint8ClampedArray(w*h*4);
 const c=Math.cos(radians),s=Math.sin(radians);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const dx=x-w/2,dy=y-h/2;
   const ix=Math.floor((dx*c+dy*s)/scale+png.width/2);
   const iy=Math.floor((-dx*s+dy*c)/scale+png.height/2);
   const to=(y*w+x)*4;
   if(ix>=0&&iy>=0&&ix<png.width&&iy<png.height){
     const from=(iy*png.width+ix)*4;
     data[to]=png.data[from];data[to+1]=png.data[from+1];data[to+2]=png.data[from+2];
   }else{data[to]=19;data[to+1]=27;data[to+2]=23}
   data[to+3]=255;
 }
 return {width:w,height:h,data};
}
for(const [name,format,scale] of [
 ['snake-codablockf','codablockf',.72],
 ['neon-dodge-dotcode','dotcode',.76]
]){
 test(format+' decodes a simulated camera frame tilted 2 degrees',()=>{
  const png=PNG.sync.read(readFileSync(new URL('../assets/'+name+'.png',import.meta.url)));
  const image=cameraAtAngle(png,scale,Math.PI/90);
  const decode=format==='dotcode'?decodeDotCode:decodeCodablockF;
  const text=sampleKnownGrid(image,EXOTIC_SHAPES[format],BitMatrix,decode);
  const expected=readFileSync(new URL('../assets/'+name+'.txt',import.meta.url),'utf8');
  assert.equal(text,expected,'Tilting a code slightly must not prevent validated decoding');
 });
}

function perspectiveCamera(png,quad){
  const width=1300,height=940,data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<data.length;i+=4){data[i]=19;data[i+1]=27;data[i+2]=23;data[i+3]=255}
  const [tl,tr,br,bl]=quad;
  const dx1=tr[0]-br[0],dx2=bl[0]-br[0],dx3=tl[0]-tr[0]+br[0]-bl[0];
  const dy1=tr[1]-br[1],dy2=bl[1]-br[1],dy3=tl[1]-tr[1]+br[1]-bl[1];
  const den=dx1*dy2-dx2*dy1;
  const g=(dx3*dy2-dx2*dy3)/den,h=(dx1*dy3-dx3*dy1)/den;
  const a=tr[0]-tl[0]+g*tr[0],b=bl[0]-tl[0]+h*bl[0],c=tl[0];
  const d=tr[1]-tl[1]+g*tr[1],e=bl[1]-tl[1]+h*bl[1],f=tl[1];
  const left=Math.max(0,Math.floor(Math.min(...quad.map(p=>p[0]))));
  const right=Math.min(width,Math.ceil(Math.max(...quad.map(p=>p[0]))));
  const top=Math.max(0,Math.floor(Math.min(...quad.map(p=>p[1]))));
  const bottom=Math.min(height,Math.ceil(Math.max(...quad.map(p=>p[1]))));
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
    const A=a-x*g,B=b-x*h,C=x-c,D=d-y*g,E=e-y*h,F=y-f;
    const det=A*E-B*D;if(Math.abs(det)<.00001)continue;
    const u=(C*E-B*F)/det,v=(A*F-C*D)/det;
    if(u<0||v<0||u>=1||v>=1)continue;
    const sx=Math.floor(u*png.width),sy=Math.floor(v*png.height);
    const from=(sy*png.width+sx)*4,to=(y*width+x)*4;
    data[to]=png.data[from];data[to+1]=png.data[from+1];data[to+2]=png.data[from+2];data[to+3]=255;
  }
  return {width,height,data};
}
for(const [name,format] of [
  ['snake-codablockf','codablockf'],['neon-dodge-dotcode','dotcode']
]){
  test(format+' recovers all game bytes from a projective trapezoid photo',()=>{
    const png=PNG.sync.read(readFileSync(new URL('../assets/'+name+'.png',import.meta.url)));
    const quad=format==='codablockf'
      ?[[320,290],[1010,242],[970,630],[285,670]]
      :[[445,170],[915,204],[948,784],[390,741]];
    const image=perspectiveCamera(png,quad);
    const read=format==='codablockf'?decodeCodablockF:decodeDotCode;
    const payload=readFileSync(new URL('../assets/'+name+'.txt',import.meta.url),'utf8');
    const recovered=samplePerspectiveGrid(image,EXOTIC_SHAPES[format],
      format==='codablockf'?12:10,BitMatrix,read);
    assert.equal(recovered,payload);
  });
}
