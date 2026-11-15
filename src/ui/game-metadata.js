/* Catalog metadata and decoded-game labels. No scanner dependencies. */
let codeSizesRequest=null;
function formatCodeSize(bytes){
  return bytes<1024?bytes.toLocaleString('en-US')+' B':(bytes/1024).toFixed(1)+' KB';
}
export async function loadCodeSizes(){
  // Production HTML already contains exact values supplied by the build.
  const rows=[...document.querySelectorAll('.code-metadata[data-code-asset]')];
  if(rows.every(row=>row.querySelector('[data-payload-size]').textContent!=='...'&&row.querySelector('[data-png-size]').textContent!=='...'))return;
  if(!codeSizesRequest){
    codeSizesRequest=fetch('assets/code-sizes.json?v=83',{cache:'no-store'})
      .then(response=>{if(!response.ok)throw Error('Code size manifest unavailable');return response.json()})
      .catch(error=>{codeSizesRequest=null;throw error});
  }
  try{
    const info=await codeSizesRequest;
    for(const row of document.querySelectorAll('.code-metadata[data-code-asset]')){
      const item=info[row.dataset.codeAsset];
      if(!item||!Number.isInteger(item.payloadBytes)||!Number.isInteger(item.pngBytes)||item.payloadBytes<1||item.pngBytes<1)continue;
      row.querySelector('[data-payload-size]').textContent=formatCodeSize(item.payloadBytes);
      row.querySelector('[data-png-size]').textContent=formatCodeSize(item.pngBytes);
    }
  }catch(error){
    for(const row of document.querySelectorAll('.code-metadata[data-code-asset]')){
      row.querySelector('[data-payload-size]').textContent='N/A';
      row.querySelector('[data-png-size]').textContent='N/A';
    }
  }
}

export function getEmbeddingStatus(game){
  if(game.kind==='html')return {status:'full',label:'Full',format:'HTML game',
    description:'The full HTML game and its JavaScript are stored inside the code.'};
  if(['microvm','bytecode','maze','lights','eanlevel','codebreaker'].includes(game.kind))
    return {status:'bytecode',label:'Bytecode',format:game.kind==='eanlevel'?'EAN-13 numeric level':game.kind==='codebreaker'?'GS1 Codebreaker rules':'VM instructions',
      description:'The symbol contains game instructions, not JavaScript. ScanDeck provides the interpreter and interface.'};
  return {status:'partial',label:'Partial',format:'JavaScript only',
    description:'The complete JavaScript game is stored in the code, but ScanDeck provides its HTML interface.'};
}
