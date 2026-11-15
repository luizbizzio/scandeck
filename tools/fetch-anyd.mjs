import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
// AnyDCode MIT WebAssembly rMQR reader. Host the binary locally so the
// camera does not make third-party network requests or need cross-origin access.
const url='https://karpeleslab.github.io/anydcode/anyd.wasm';
const path=new URL('../vendor/anyd.wasm',import.meta.url);
const response=await fetch(url,{signal:AbortSignal.timeout(40000)});
if(!response.ok)throw Error('AnyDCode WASM download failed: '+response.status);
const bytes=Buffer.from(await response.arrayBuffer());
if(bytes.length<100_000||bytes.length>20_000_000||bytes.toString('hex',0,4)!=='0061736d')
 throw Error('AnyDCode download is not a valid WebAssembly module');
const hash=createHash('sha256').update(bytes).digest('hex');
if(hash!=='662c134126ec3286b1d02894eb78aec056d613e0ad694037351c58f290d1b4f9')
 throw Error('AnyDCode WASM checksum changed; review the update before shipping it');
mkdirSync(new URL('../vendor/',import.meta.url),{recursive:true});
writeFileSync(path,bytes);
console.log('AnyDCode rMQR decoder: '+bytes.length+' bytes, SHA-256 '+hash);
