document.write('<input id=a><button id=b>GO');n=new Date%99;t=7;b.onclick=()=>b.innerText=a.value==n?'WIN':--t?t+(a.value<n?'UP':'DOWN'):'LOSE'
