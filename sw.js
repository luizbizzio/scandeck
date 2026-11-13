/* Offline shell cache. Game code is never sent to a remote endpoint. */
const CACHE='scandeck-v20';
const FILES=['./','index.html','style.css','app.js','protocol.js','runtime.js','maze.js','code128.js','assets/favicon.svg','assets/snake-code128.svg','assets/ironpass-micro-v3.txt','assets/ironpass-micro-v3-qr.png','assets/catch-datamatrix.svg','assets/catch-datamatrix.png','assets/catch-datamatrix.txt','assets/memory-aztec.svg','assets/memory-aztec.png','assets/memory-aztec.txt','assets/breakout-pdf417.svg','assets/breakout-pdf417.png','assets/breakout-pdf417.txt','assets/tap-maxicode.svg','assets/tap-maxicode.png','assets/tap-maxicode.txt','assets/math-microqr.svg','assets/math-microqr.png','assets/math-microqr.txt','assets/math-rmqr.svg','assets/math-rmqr.png','assets/math-rmqr.txt','assets/iris-chroma.svg','assets/iris-chroma.png','assets/iris-chroma.txt','assets/chromaqr-wire.svg','assets/chromaqr-wire.png','assets/chromaqr-wire.txt','vendor/zxing-wasm/index.js','vendor/zxing-wasm/zxing_full.wasm','vendor/qrcode-generator.js','iris-worker.js','chroma.js','vendor/iris/bits.js','vendor/iris/blocks.js','vendor/iris/color.js','vendor/iris/frame.js','vendor/iris/markers.js','vendor/iris/params.js','vendor/iris/render-svg.js','vendor/iris/robust.js','vendor/iris/rs.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(e.request);
      if (response.ok) await cache.put(e.request, response.clone());
      return response;
    } catch (_) {
      const cached = await cache.match(e.request);
      if (cached) return cached;
      throw new Error('Offline and this file has not been saved.');
    }
  })());
});