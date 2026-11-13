// Generate build-time card sizes so they appear without JavaScript or a network request.
import {readFileSync,writeFileSync} from 'node:fs';
const path=process.argv[2];
if(!path)throw Error('Pass the target HTML filename.');
const sizes=JSON.parse(readFileSync(new URL('../assets/code-sizes.json',import.meta.url),'utf8'));
const format=bytes=>bytes<1024?bytes.toLocaleString('en-US')+' B':(bytes/1024).toFixed(1)+' KB';
let count=0;
const html=readFileSync(path,'utf8').replace(/<div class="code-metadata" data-code-asset="([a-z0-9-]+)"[^>]*>[\s\S]*?<\/div>/g,(card,id)=>{
 const data=sizes[id];
 if(!data)throw Error('Missing card size for '+id);
 count++;
 return card.replace(/(<strong data-payload-size>)[^<]*(<\/strong>)/,(_,a,b)=>a+format(data.payloadBytes)+b)
            .replace(/(<strong data-png-size>)[^<]*(<\/strong>)/,(_,a,b)=>a+format(data.pngBytes)+b);
});
if(count!==12||html.includes('<strong data-payload-size>...</strong>')||html.includes('<strong data-png-size>...</strong>'))throw Error('Missing built card sizes');
writeFileSync(path,html);
console.log('Injected exact sizes into '+count+' game cards');
