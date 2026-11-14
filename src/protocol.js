import {parseMicroProgram} from './microvm.js?v=26';
/** ScanDeck wire formats. No code execution happens in this module. */
export const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$*+-./:';
export const QR_LIMIT = 4296; // Version 40, level L, alphanumeric mode (theoretical maximum).
export const MAX_SOURCE_BYTES = 256_000;
export const LEGACY_SNAKE = 's=[27,26,25],f=45,I=180;T=()=>{h=d&1?s[0]&56|s[0]+d&7:s[0]+d&63;s.unshift(h);h==f?f=A(s):s.pop();s.indexOf(h,1)>0&&O();R(s,f)}';

export function base43Encode(data) {
  let out = String(data.length & 1);
  for (let i = 0; i < data.length; i += 2) {
    const v = (data[i] << 8) | (i + 1 < data.length ? data[i + 1] : 0);
    out += ALPHABET[v % 43] + ALPHABET[Math.floor(v / 43) % 43] + ALPHABET[Math.floor(v / 1849)];
  }
  return out;
}
export function base43Decode(value) {
  if (!/^[01]/.test(value)) throw new Error('Invalid package padding.');
  const odd = Number(value[0]);
  const input = value.slice(1);
  if (input.length % 3) throw new Error('Incomplete code data.');
  if (input.length > 60_000) throw new Error('Code data is too large.');
  const result = new Uint8Array(input.length / 3 * 2 - odd);
  for (let i = 0, j = 0; i < input.length; i += 3) {
    const a = ALPHABET.indexOf(input[i]), b = ALPHABET.indexOf(input[i + 1]), c = ALPHABET.indexOf(input[i + 2]);
    if (a < 0 || b < 0 || c < 0) throw new Error('Invalid code characters.');
    const n = a + 43 * b + 1849 * c;
    if (n > 65535) throw new Error('Invalid code data.');
    if (j < result.length) result[j++] = n >> 8;
    if (j < result.length) result[j++] = n & 255;
  }
  return result;
}
export async function inflateRaw(bytes) {
  if (!('DecompressionStream' in globalThis)) throw new Error('This browser does not support decompression. Update your browser.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks = []; let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SOURCE_BYTES) { await reader.cancel(); throw new Error('Game content exceeds the safety size limit.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const all = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(all);
}
export async function deflateRaw(text) {
  if (!('CompressionStream' in globalThis)) throw new Error('This browser does not support compression. Update your browser.');
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > MAX_SOURCE_BYTES) throw new Error('The source is too large.');
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
}
// Base64 is more compact than base43 for Codablock F and DotCode, which encode ASCII.
export function base64Encode(bytes){
  let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
export function base64Decode(text){
  if(typeof text!=='string'||text.length>80_000||!text.length||
     !/^[A-Za-z0-9+/]+={0,2}$/.test(text)||text.length%4!==0)
    throw Error('Invalid compressed game encoding.');
  return Uint8Array.from(atob(text),ch=>ch.charCodeAt(0));
}
// Z85 stores 4 compressed bytes in 5 printable characters, avoiding base64 padding.
export const Z85='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';
export function base85Encode(bytes){
  const padding=(4-bytes.length%4)%4;
  let out=String(padding);
  for(let i=0;i<bytes.length;i+=4){
    let n=0;
    for(let j=0;j<4;j++)n=n*256+(bytes[i+j]||0);
    let group='';
    for(let j=0;j<5;j++){group=Z85[n%85]+group;n=Math.floor(n/85)}
    out+=group;
  }
  return out;
}
export function base85Decode(value){
  if(typeof value!=='string'||value.length<1||value.length>85000||
     !/^[0-3]/.test(value)||(value.length-1)%5)
    throw Error('Invalid compact game encoding.');
  const padding=Number(value[0]),data=value.slice(1);
  const total=data.length/5*4-padding;
  if(total<0)throw Error('Invalid compact game padding.');
  const result=new Uint8Array(total);
  for(let i=0,j=0;i<data.length;i+=5){
    let n=0;
    for(let k=0;k<5;k++){
      const index=Z85.indexOf(data[i+k]);
      if(index<0)throw Error('Invalid compact game characters.');
      n=n*85+index;
    }
    if(n>4294967295)throw Error('Invalid compact game number.');
    for(let k=3;k>=0;k--){
      const pos=j+k;
      if(pos<result.length)result[pos]=n%256;
      n=Math.floor(n/256);
    }
    j+=4;
  }
  return result;
}
export async function packDenseHtml(html){
  const source=String(html).trim();
  if(!/<(?:canvas|html|body|svg|div|script)\b/i.test(source))
    throw Error('Paste an HTML game, not plain text.');
  return 'SDC:'+base85Encode(await deflateRaw(source));
}
export async function packDenseScript(script){
  const source=String(script).trim();
  packScript(source);
  return 'SDB:'+base85Encode(await deflateRaw(source));
}

export async function packCompactHtml(html){
  const source=String(html).trim();
  if(!/<(?:canvas|html|body|svg|div|script)\b/i.test(source))
    throw Error('Paste a full HTML game, not plain text.');
  return 'SDH:'+base64Encode(await deflateRaw(source));
}
export async function packCompactScript(script){
  const source=String(script).trim();
  packScript(source);
  return 'SDZ:'+base64Encode(await deflateRaw(source));
}
export async function packHtml(html) {
  if (!/<(?:canvas|html|body|svg|div|script)\b/i.test(html)) throw new Error('Paste an HTML game, not plain text.');
  const packed = `SD1:${base43Encode(await deflateRaw(html))}`;
  if (packed.length > QR_LIMIT) throw new Error(`This game needs ${packed.length} QR characters. The maximum is ${QR_LIMIT}. Reduce the HTML.`);
  return packed;
}
export function packScript(script) {
  const source = script.trim();
  if (!source || /[^\x20-\x7e]/.test(source)) throw new Error('Code 128 supports printable ASCII. Put the script on a single line.');
  if (!source.includes('(') && !source.includes('=')) throw new Error('Enter a JavaScript microgame program.');
  if (/<\/script/i.test(source)) throw new Error('Do not put a closing script tag in the code.');
  return `SDS:${source}`;
}
export function packMicroVm(text){
  const program=String(text||'').trim();
  parseMicroProgram(program);
  return program;
}
export function packMicroQuiz(text) {
  const value=text.trim().startsWith('MQ:')?text.trim():'MQ:'+text.trim();
  if(value.length>15 || !/^MQ:(?:Q[0-9][+*-][0-9]=[0-9]{1,2}|M[0-9A-F]{4}[1-9])$/.test(value))
    throw new Error('Micro QR needs tiny bytecode: M36509 for maze or Q2+2=4 for math.');
  if(value[3]==='M' && (parseInt(value.slice(4,8),16)&32769))
    throw new Error('The maze must keep its entrance and exit open.');
  return value;
}
export function packEanLevel(input){
 const raw=String(input||'').trim();
 if(!/^299000[0-9]{6}(?:[0-9])?$/.test(raw))throw Error('EAN-13 needs a 12-digit timing level starting with 299000.');
 const stem=raw.slice(0,12),target=Number(stem.slice(6,10)),step=Number(stem.slice(10,12));
 if(target<800||target>2999||step<1)throw Error('EAN-13 target must be 0800-2999 ms and step 01-99.');
 let sum=0;for(let i=0;i<12;i++)sum+=Number(stem[i])*(i%2?3:1);
 const code=stem+((10-sum%10)%10);
 if(raw.length===13&&raw!==code)throw Error('Invalid EAN-13 check digit.');
 return code;
}
export async function decodeGame(raw) {
  const trimmed = raw.trim();
  const value = trimmed.startsWith('SDJ:') || trimmed.startsWith('SDS:') ? trimmed : trimmed.replace(/\s+/g, '');
  if (!value) throw new Error('No game code was provided.');
  if(/^299000[0-9]{7}$/.test(value)){
    const payload=packEanLevel(value);
    return {title:'Perfect Timing',type:'EAN-13 / TIMING LEVEL',kind:'eanlevel',source:payload,payload,size:payload.length};
  }
  if(value.startsWith('LO:')){
    if(!/^LO:[0-9A-F]{4}$/.test(value)||value==='LO:0000')
      throw new Error('Invalid Lights Out level. Use LO: followed by four uppercase hex digits.');
    return {title:'Lights Out',type:'LO / CODE 128',kind:'lights',source:value.slice(3),payload:value,size:value.length};
  }
  if(value.startsWith('V1')){
    const program=packMicroVm(value);
    return {title:'Pocket Reflex',type:'MICRO VM / MICRO QR',kind:'microvm',source:program,payload:program,size:program.length};
  }
  if(value.startsWith('MQ:')) {
    const code=packMicroQuiz(value);
    const isMaze=code[3]==='M';
    return {title:isMaze?'Pocket Maze':'Micro Math',type:'MQ / MICRO QR',kind:isMaze?'maze':'bytecode',source:code.slice(3),payload:code,size:code.length};
  }
  if(value.startsWith('SDC:')){
    const html=await inflateRaw(base85Decode(value.slice(4)));
    if(!/<(?:script|canvas|body|html|svg|div)\b/i.test(html))
      throw Error('Compressed payload is not an HTML game.');
    const heading=html.match(/<h[1-3][^>]*>([^<]{1,60})<\/h[1-3]>/i);
    return {title:heading?heading[1].trim():'Custom game',type:'SDC / DOTCODE',
      kind:'html',source:html,payload:value,size:new TextEncoder().encode(html).length};
  }
  if(value.startsWith('SDB:')){
    const script=await inflateRaw(base85Decode(value.slice(4)));
    if(!script||script.length>16_000||/[^\x20-\x7e]/.test(script)||/<\/script/i.test(script))
      throw Error('Invalid compressed JavaScript game.');
    return {title:'Standalone Barcode Game',type:'SDB / CODABLOCK F',
      kind:'standalone',source:script,payload:value,size:script.length};
  }
  if(value.startsWith('SDH:')){
    const html=await inflateRaw(base64Decode(value.slice(4)));
    if(!/<(?:script|canvas|body|html|svg|div)\b/i.test(html))
      throw Error('Compressed payload is not an HTML game.');
    const heading=html.match(/<h[1-3][^>]*>([^<]{1,60})<\/h[1-3]>/i);
    return {title:heading?heading[1].trim():'Custom game',type:'SDH / DOTCODE',kind:'html',
      source:html,payload:value,size:new TextEncoder().encode(html).length};
  }
  if(value.startsWith('SDY:')){
    // Alphanumeric QR/rMQR transport for compressed full JavaScript.
    const script=await inflateRaw(base43Decode(value.slice(4)));
    if(!script||script.length>16_000||/[^\x20-\x7e]/.test(script)||/<\/script/i.test(script))
      throw Error('Invalid compressed JavaScript game.');
    return {title:'Standalone Barcode Game',type:'SDY / RMQR',kind:'standalone',
      source:script,payload:value,size:script.length};
  }
  if(value.startsWith('SDZ:')){
    const script=await inflateRaw(base64Decode(value.slice(4)));
    if(!script||script.length>16_000||/[^\x20-\x7e]/.test(script)||/<\/script/i.test(script))
      throw Error('Invalid compressed JavaScript game.');
    return {title:'Standalone Barcode Game',type:'SDZ / DOTCODE',kind:'standalone',
      source:script,payload:value,size:script.length};
  }
  if (value.startsWith('IP3:') || value.startsWith('SD1:')) {
    const legacy = value.startsWith('IP3:');
    const html = await inflateRaw(base43Decode(value.slice(4)));
    if (!/<(?:script|canvas|body|html|svg|div)\b/i.test(html)) throw new Error('The package does not look like a game.');
    const heading=html.match(/<h[1-3][^>]*>([^<]{1,60})<\/h[1-3]>/i);
    const title=legacy?'Ironpass Micro':heading?heading[1].trim():'Custom game';
    return { title, type: legacy ? 'IP3 / QR' : 'SD1 / 2D', kind: 'html', source: html, payload: value, size: new TextEncoder().encode(html).length };
  }
  if (value.startsWith('SDS:')) {
    const script = value.slice(4);
    if (!script || script.length > 16_000 || /[^\x20-\x7e]/.test(script) || /<\/script/i.test(script)) throw new Error('Invalid standalone game code.');
    return { title: 'Standalone Barcode Game', type: 'SDS / CODE 128', kind: 'standalone', source: script, payload: value, size: script.length };
  }
  if (value.startsWith('SDJ:')) {
    const script = value.slice(4);
    if (script.length > 16_000) throw new Error('The microgame program is too large.');
    if (/[^\x20-\x7e]/.test(script) || /<\/script/i.test(script)) throw new Error('Invalid microgame characters.');
    return { title: 'Custom Microgame', type: 'SDJ / CODE 128', kind: 'micro', source: script, payload: value, size: script.length };
  }
  // Original public experiment: exact source match. This is not a universal raw-JS executor.
  if (value === LEGACY_SNAKE) return { title: 'Snake', type: 'LEGACY / CODE 128', kind: 'snake', source: value, payload: value, size: value.length };
  throw new Error('This code does not contain a compatible ScanDeck game.');
}