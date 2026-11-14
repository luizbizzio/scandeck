n=0;f=()=>{for(i=n+3,k='';i--;)k+='RGB'[Math.random()*3|0];return t.innerHTML=k};f();onclick=e=>n<5&&(t.innerHTML=e.target.innerHTML==k[0]?(k=k.slice(1))?'?':++n==5?'WIN':f():(n=5,'BOOM'))
