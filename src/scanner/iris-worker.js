// Camera and image IRIS decoding runs off the UI thread.
// Vendored AllTerrainDeveloper/iris, MIT, pinned in vendor/iris.
import { decodeColor } from '../../vendor/iris/color.js';
import { decodeColorMarkers } from '../../vendor/iris/markers.js';
import { decodeColorRobust } from '../../vendor/iris/robust.js';
import {cropIrisCard,cropIrisDisk} from './iris-camera.js';

self.onmessage=({data:job})=>{
  const {id,width,height,buffer}=job;
  let text='';
  try{
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>2_000_000)
      throw Error('Invalid camera image');
    const rgba=new Uint8ClampedArray(buffer);
    if(rgba.length!==width*height*4)throw Error('Invalid RGBA data');
    const rgb=new Uint8Array(width*height*3);
    for(let src=0,dst=0;src<rgba.length;src+=4,dst+=3){
      rgb[dst]=rgba[src];rgb[dst+1]=rgba[src+1];rgb[dst+2]=rgba[src+2];
    }
    const grid={width,height,data:rgb};
    // In camera captures the symbol occupies only part of the sensor.
    // Running the pure decoder on the entire square camera image first
    // repeatedly wastes time and assumes the code is already aligned.
    const card=cropIrisCard(grid);
    if(card){
      try{text=decodeColorMarkers(card)?.text||''}catch{}
      if(!text){try{text=decodeColorRobust(card,{budgetMs:650})?.text||''}catch{}}
      if(!text&&Math.abs(card.width-card.height)<Math.max(card.width,card.height)*.08){
        try{text=decodeColor(card)?.text||''}catch{}
      }
    }
    // Partially cropped white margins cannot provide all three RGB calibration
    // markers. Recover the saturated disk and use pupil/ring geometry instead.
    if(!text){
      const disk=cropIrisDisk(grid);
      if(disk){
        try{text=decodeColorRobust(disk,{budgetMs:850})?.text||''}catch{}
        if(!text){try{text=decodeColorMarkers(disk)?.text||''}catch{}}
      }
    }
    // Fallback for full-white backgrounds where the white-card locator cannot
    // distinguish quiet zone from page or screen. Bound the robust search.
    if(!text){try{text=decodeColorMarkers(grid)?.text||''}catch{}}
    if(!text&&!card&&Math.abs(width-height)<Math.max(width,height)*.04){
      try{text=decodeColor(grid)?.text||''}catch{}
    }
    if(!text&&!card){try{text=decodeColorRobust(grid,{budgetMs:600})?.text||''}catch{}}
  }catch{}
  self.postMessage({id,text});
};
