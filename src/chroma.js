// ChromaQR RGB channel multiplexing adapted from w-henderson/ChromaQR (MIT).
// The payload is carried only in three overlaid QR codes; no links or fallback data.
const hashPayload=text=>{
  let h=2166136261;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(16).padStart(8,'0');
};
export function splitChromaPayload(payload){
  const wire='CQ1:'+payload.length+':'+hashPayload(payload)+':'+payload;
  const len=Math.ceil(wire.length/3);
  return [wire.slice(0,len),wire.slice(len,2*len),wire.slice(2*len)];
}
export function joinChromaPayload(parts){
  if(parts.length!==3||parts.some(part=>typeof part!=='string'))return null;
  const combined=parts.join('');
  const match=/^CQ1:([0-9]{1,5}):([a-f0-9]{8}):/.exec(combined);
  if(!match)return null;
  const raw=combined.slice(match[0].length);
  return raw.length===Number(match[1])&&hashPayload(raw)===match[2]&&/^(?:SD1:|SDS:|SDJ:|MQ:|IP3:)/.test(raw)?raw:null;
}
export function encodeChroma(qrcode,payload){
  const chunks=splitChromaPayload(payload);
  for(let version=1;version<=40;version++){
    try{
      const layers=chunks.map(text=>{
        const qr=qrcode(version,'M');
        qr.addData(text,'Byte');qr.make();
        return qr;
      });
      const modules=layers[0].getModuleCount();
      if(!layers.every(qr=>qr.getModuleCount()===modules))throw Error('QR channel dimensions differ');
      return {layers,modules};
    }catch(error){
      if(version===40)throw Error('ChromaQR payload exceeds supported QR capacity: '+error.message);
    }
  }
  throw Error('ChromaQR generation failed');
}
export function chromaSvg(symbol){
  const {layers,modules}=symbol,margin=4,size=modules+2*margin;
  const colorPaths=new Map();
  for(let y=0;y<modules;y++)for(let x=0;x<modules;x++){
    const rgb=layers.map(layer=>layer.isDark(y,x)?0:255);
    if(rgb.every(v=>v===255))continue;
    const color='#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
    const list=colorPaths.get(color)||[];
    list.push('M'+(x+margin)+' '+(y+margin)+'h1v1h-1z');
    colorPaths.set(color,list);
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+size+' '+size+'" width="640" height="640" shape-rendering="crispEdges"><rect width="'+size+'" height="'+size+'" fill="#fff"/>'+[...colorPaths].map(([color,paths])=>'<path fill="'+color+'" d="'+paths.join('')+'"/>').join('')+'</svg>';
}
export function chromaPixels(symbol,scale=10){
  const {layers,modules}=symbol,margin=4,side=(modules+2*margin)*scale;
  const data=new Uint8Array(side*side*3).fill(255);
  for(let y=0;y<modules;y++)for(let x=0;x<modules;x++){
    const rgb=layers.map(layer=>layer.isDark(y,x)?0:255);
    if(rgb.every(v=>v===255))continue;
    for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){
      const off=(((y+margin)*scale+dy)*side+(x+margin)*scale+dx)*3;
      data[off]=rgb[0];data[off+1]=rgb[1];data[off+2]=rgb[2];
    }
  }
  return {width:side,height:side,data};
}
// The ordinary ZXing QR decoder reads each extracted grayscale color plane.
// Camera white balance and display interpolation can move the channel thresholds.
// Try the original midpoint first, then an image-adaptive Otsu threshold if needed.
export async function decodeChromaPixels(image,readBarcode){
  const {width,height,data}=image,total=width*height;
  if(width<21||height<21||total>2_000_000)return null;
  const stride=data.length===total*4?4:data.length===total*3?3:0;
  if(!stride)return null;
  const parts=[];
  const step=Math.max(1,Math.floor(total/160_000));
  for(let channel=0;channel<3;channel++){
    const histogram=new Uint32Array(256);
    let lo=255,hi=0,count=0,sum=0;
    for(let j=0;j<total;j+=step){
      const v=data[j*stride+channel];
      if(v<lo)lo=v;
      if(v>hi)hi=v;
      histogram[v]++;count++;sum+=v;
    }
    if(hi-lo<35)return null;
    let backgroundCount=0,backgroundSum=0,best=-1,otsu=(lo+hi)/2;
    for(let threshold=lo;threshold<hi;threshold++){
      backgroundCount+=histogram[threshold];backgroundSum+=threshold*histogram[threshold];
      const foregroundCount=count-backgroundCount;
      if(!backgroundCount||!foregroundCount)continue;
      const diff=backgroundSum/backgroundCount-(sum-backgroundSum)/foregroundCount;
      const score=backgroundCount*foregroundCount*diff*diff;
      if(score>best){best=score;otsu=threshold}
    }
    const midpoint=(lo+hi)/2;
    const thresholds=Math.abs(midpoint-otsu)>7?[midpoint,otsu]:[midpoint];
    const plane=new Uint8ClampedArray(total*4);
    let chunk='';
    for(const pivot of thresholds){
      for(let j=0;j<total;j++){
        const value=data[j*stride+channel]>pivot?255:0,o=j*4;
        plane[o]=value;plane[o+1]=value;plane[o+2]=value;plane[o+3]=255;
      }
      const found=await readBarcode({width,height,data:plane},{formats:['QRCode'],maxNumberOfSymbols:1,tryHarder:pivot!==thresholds[0],tryRotate:true,tryInvert:false,tryDownscale:false});
      chunk=found?.find(x=>x.text)?.text||'';
      if(chunk)break;
    }
    if(!chunk)return null;
    parts.push(chunk);
  }
  return joinChromaPayload(parts);
}
