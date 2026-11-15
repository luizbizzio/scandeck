/* ScanDeck Codebreaker bytecode carried in GS1 AI (91): private company-internal data.
 * The barcode contains rules and attempt count, not JavaScript or a URL.
 * Accept the raw, HRI and AIM-prefixed forms returned by different GS1 readers.
 */
export function decodeCodebreakerDataBar(value){
  const raw=String(value??'').trim().replace(/^\]e[0-9]/i,'');
  const match=/^(?:91|\(91\)|\[91\])SDCB([1-9])$/.exec(raw);
  if(!match)return null;
  const tries=Number(match[1]);
  return {payload:'91SDCB'+tries,source:'SDCB'+tries,tries};
}
export function packCodebreakerDataBar(value='SDCB7'){
  const raw=String(value??'').trim().toUpperCase();
  const parsed=decodeCodebreakerDataBar(raw.startsWith('SDCB')?'91'+raw:raw);
  if(!parsed)throw new Error('GS1 DataBar Codebreaker needs SDCB1 to SDCB9 (number of guesses).');
  return parsed.payload;
}
