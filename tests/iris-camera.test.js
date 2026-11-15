import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {cropIrisCard} from '../src/iris-camera.js';
import {decodeColorMarkers} from '../vendor/iris/markers.js';
import {decodeColorRobust} from '../vendor/iris/robust.js';

test('IRIS card detector locates real RGB marker raster in a cluttered photo',()=>{
 const png=PNG.sync.read(readFileSync(new URL('../assets/iris-wire.png',import.meta.url)));
 const expected=readFileSync(new URL('../assets/iris-wire.txt',import.meta.url),'utf8');
 const width=1280,height=960,data=new Uint8Array(width*height*3);
 for(let i=0;i<data.length;i+=3){data[i]=18;data[i+1]=25;data[i+2]=21}
 const size=690,left=(width-size)>>1,top=(height-size)>>1;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const ix=Math.min(png.width-1,Math.floor((x+.5)*png.width/size));
   const iy=Math.min(png.height-1,Math.floor((y+.5)*png.height/size));
   const p=(iy*png.width+ix)*4,k=((top+y)*width+left+x)*3;
   data[k]=png.data[p];data[k+1]=png.data[p+1];data[k+2]=png.data[p+2];
 }
 const source={width,height,data};
 const candidate=cropIrisCard(source);
 assert.ok(candidate,'The pale marker code must be separated from the dark scene');
 assert.ok(candidate.width<1000&&candidate.height<1000);
 const decoded=decodeColorMarkers(candidate)?.text||decodeColorRobust(candidate,{budgetMs:950})?.text||'';
 assert.equal(decoded,expected,'The complete IRIS game must survive the camera-like framing');
});
test('IRIS candidate extraction does not invent a code in dark frames',()=>{
 const width=400,height=300,data=new Uint8Array(width*height*3);
 assert.equal(cropIrisCard({width,height,data}),null);
});
