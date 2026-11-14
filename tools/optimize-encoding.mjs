// Byte-for-byte safe DEFLATE search; never rewrite the actual game source.
import {deflateRawSync,inflateRawSync,constants} from 'node:zlib';
export function bestDeflateRaw(input){
 const bytes=Buffer.isBuffer(input)?input:Buffer.from(input);
 let best=null;
 for(const strategy of [constants.Z_DEFAULT_STRATEGY,constants.Z_FILTERED,constants.Z_RLE,constants.Z_FIXED]){
  for(const windowBits of [9,10,11,12,13,14,15]){
   try{
    const candidate=deflateRawSync(bytes,{level:9,windowBits,memLevel:9,strategy});
    if(!best||candidate.length<best.length)best=candidate;
   }catch{}
  }
 }
 if(!best||!inflateRawSync(best).equals(bytes))throw Error('Lossless game compression failed');
 return best;
}
