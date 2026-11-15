/* Responsive code previews for the game library. */
export function initializeTightCodePreviews(){
  // Keep the paper close to the actual symbol, preserving the PNG's existing quiet zone.
  // The outer gallery preview stays 228px high. ResizeObserver also handles a hidden
  // library tab becoming visible and responsive width changes.
  const tightPreviews=[...document.querySelectorAll('.tight-code-preview')];
  function fitTightCodePaper(preview){
    const img=preview.querySelector('.game-code-paper img'),paper=img?.parentElement;
    if(!img?.naturalWidth||!img.naturalHeight||!paper||!preview.clientWidth)return;
    const availableWidth=Math.max(1,preview.clientWidth-40);
    const scale=Math.min(150/img.naturalHeight,availableWidth/img.naturalWidth);
    paper.style.width=Math.ceil(img.naturalWidth*scale+16)+'px';
    paper.style.height=Math.ceil(img.naturalHeight*scale+16)+'px';
  }
  if(tightPreviews.length){
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(entries=>{
      for(const entry of entries)fitTightCodePaper(entry.target);
    });
    for(const preview of tightPreviews){
      const img=preview.querySelector('img');
      if(img.complete)fitTightCodePaper(preview);
      else img.addEventListener('load',()=>fitTightCodePaper(preview),{once:true});
      observer?.observe(preview);
    }
    if(!observer)addEventListener('resize',()=>tightPreviews.forEach(fitTightCodePaper));
  }
}
