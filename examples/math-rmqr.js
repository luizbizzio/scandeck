document.write('<input id=a><button id=b>GO');n=Math.random()*99|0;t=7;onclick=()=>b.innerText=a.value==n?'WIN':--t?t+(a.value<n?'UP':'DN'):'LOSE'
