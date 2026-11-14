p=s=z=0;y=-32;v=0;a=4;c.onclick=()=>z?(z=p=s=0,y=-32,a=4):p^=1;tick=d=>{if(z)return;y+=a*d;a+=.009*d;if(y>360)y=-32,v=Math.random()*2|0,s++;if(y>285&&y<335&&v==p)z=1}
