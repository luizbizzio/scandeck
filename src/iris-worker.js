// Camera and image IRIS decoding runs off the UI thread.
// Vendored AllTerrainDeveloper/iris, MIT, pinned in vendor/iris.
import { decodeColor } from '../vendor/iris/color.js';
import { decodeColorMarkers } from '../vendor/iris/markers.js';
import { decodeColorRobust } from '../vendor/iris/robust.js';
import {cropIrisCard} from './iris-camera.js';

self.onmessage=({data:job})=>{
  const {id,width,height,buffer}=job;
  let text='';
  try{
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>2_000_000)
      throw Error('Invalid camera image');
    const grid={width,height,data:new Uint8Array(buffer)};
    if(grid.data.length!==width*height*3)throw Error('Invalid RGB data');
    // Exact centered render: fast decoder. A camera photo needs geometry recovery.
    if(Math.abs(width-height)<Math.max(width,height)*.04){
      try{text=decodeColor(grid).text}catch{}
    }
    if(!text){try{text=decodeColorMarkers(grid)?.text||''}catch{}}
    if(!text){
      const card=cropIrisCard(grid);
      if(card){
        try{text=decodeColor(card)?.text||''}catch{}
        if(!text){try{text=decodeColorMarkers(card)?.text||''}catch{}}
        if(!text){try{text=decodeColorRobust(card,{budgetMs:850})?.text||''}catch{}}
      }
    }
    if(!text){try{text=decodeColorRobust(grid,{budgetMs:1100})?.text||''}catch{}}
  }catch{}
  self.postMessage({id,text});
};
