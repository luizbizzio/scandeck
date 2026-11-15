// Byte-for-byte safe DEFLATE search; never rewrite the actual game source.
import {deflateRawSync,inflateRawSync,constants} from 'node:zlib';
import {inlineScriptRanges} from './html-source.mjs';
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

// Minify JavaScript syntax only, without changing UI elements, game rules or
// the JavaScript scope visible to inline browser handlers. Keep original files
// human-readable in examples/ and encode the semantically equivalent program.
export async function compactGameHtml(source,{minifyGlobals=false}={}){
 const {minify}=await import('terser');
 const matches=inlineScriptRanges(source);
 let result=source;
 for(let i=matches.length-1;i>=0;i--){
  const m=matches[i],script=m.source;
  if(!script.trim())continue;
  const optimized=await minify(script,{
   ecma:2020,compress:{passes:minifyGlobals?4:2,toplevel:minifyGlobals,unsafe:false},mangle:{toplevel:minifyGlobals},
   format:{comments:false}
  });
  if(!optimized.code||optimized.code.length>=script.length)continue;
  result=result.slice(0,m.start)+optimized.code+result.slice(m.end);
 }
 return result;
}
