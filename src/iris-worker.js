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
