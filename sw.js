/* Offline shell cache. Game code is never sent to a remote endpoint. */
const CACHE='scandeck-v26';
const FILES=["./","index.html","style.css","app.js","protocol.js","runtime.js","microvm.js","maze.js","code128.js","chroma.js","iris-worker.js","exotic-worker.js","assets/favicon.svg","assets/ironpass-micro-v3.txt","assets/ironpass-micro-v3-qr.png","assets/snake-qr.png","assets/snake-qr.txt","assets/snake-codablockf.png","assets/snake-codablockf.txt","assets/neon-dodge-dotcode.png","assets/neon-dodge-dotcode.txt","assets/taprush-code128.png","assets/taprush-code128.txt","assets/catch-datamatrix.png","assets/catch-datamatrix.txt","assets/memory-aztec.png","assets/memory-aztec.txt","assets/breakout-pdf417.png","assets/breakout-pdf417.txt","assets/tap-maxicode.png","assets/tap-maxicode.txt","assets/reflex-microqr.png","assets/reflex-microqr.txt","assets/math-rmqr.png","assets/math-rmqr.txt","assets/iris-wire.png","assets/iris-wire.txt","assets/chromaqr-chroma.png","assets/chromaqr-chroma.txt","vendor/zxing-wasm/index.js","vendor/zxing-wasm/zxing_full.wasm","vendor/qrcode-generator.js","vendor/sythos-barcode.esm.js","vendor/sythos.LICENSE","vendor/iris/bits.js","vendor/iris/blocks.js","vendor/iris/color.js","vendor/iris/frame.js","vendor/iris/markers.js","vendor/iris/params.js","vendor/iris/render-svg.js","vendor/iris/robust.js","vendor/iris/rs.js"];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
// Game examples are immutable within this app version: serve their verified bytes instantly.
// JS/CSS/HTML always revalidate, avoiding mixed old/new modules after a deploy.
self.addEventListener('fetch', e => {
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const pathname=new URL(e.request.url).pathname;
    const gameAsset=/\/assets\/[^/]+\.(?:png|txt)$/.test(pathname);
    if(gameAsset){
      const cached=await cache.match(e.request);
      if(cached)return cached;
    }
    try{
      const dynamic=/\.(?:js|css|html)$/.test(pathname)||pathname.endsWith('/');
      const response=await fetch(e.request,dynamic?{cache:'no-store'}:undefined);
      if(response.ok)await cache.put(e.request,response.clone());
      return response;
    }catch(error){
      const cached=await cache.match(e.request);
      if(cached)return cached;
      throw Error('Offline and this file has not been saved.');
    }
  })());
});
