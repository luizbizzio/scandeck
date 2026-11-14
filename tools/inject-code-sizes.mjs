// Generate build-time card sizes so they appear without JavaScript or a network request.
import {readFileSync,writeFileSync} from 'node:fs';
import {decodeGame} from '../src/protocol.js';
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
const catalog={};
for(const id of Object.keys(sizes)){
 const name=id==='ironpass-micro-v3-qr'?'ironpass-micro-v3':id;
 const payload=readFileSync(new URL('../assets/'+name+'.txt',import.meta.url),'utf8').trim();
 const game=await decodeGame(payload);
 if(!['html','standalone','bytecode','maze','lights','microvm','micro','eanlevel'].includes(game.kind))
  throw Error('Unsupported catalog game '+name);
 catalog[name]=game;
}
// A base64-encoded JSON data block cannot contain HTML tags or terminate the script element.
const embedded=Buffer.from(JSON.stringify(catalog),'utf8').toString('base64');
const tag='<script type="application/x-scandeck-catalog" id="play-catalog">'+embedded+'</script>';
const marker='<script type="module" src="src/app.js';
if(!html.includes(marker))throw Error('Could not find the game loader in HTML.');
const finished=html.replace(marker,tag+'\n  '+marker);
writeFileSync(path,finished);
console.log('Injected exact sizes into '+count+' game cards and '+Object.keys(catalog).length+' predecoded games');
