s=0;document.write('<button id=b>ROLL</button><p id=p>0');b.onclick=()=>{r=Math.random()*6|0;s=r?s+r+1:0;p.textContent=s?'SCORE '+s:'BUST'}
