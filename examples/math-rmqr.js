document.write('<input id=a><button id=b>GO');n=Date.now()%99;t=7;b.onclick=()=>b.innerText=a.value==n?'WIN':--t?t+(a.value<n?'UP':'DN'):'LOSE'
