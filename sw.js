/* Offline shell cache. Game code is never sent to a remote endpoint. */
const CACHE='scandeck-v17';
const FILES=['./','index.html','style.css','app.js','protocol.js','runtime.js','maze.js','code128.js','assets/favicon.svg','assets/snake-code128.svg','assets/ironpass-micro-v3.txt','assets/ironpass-micro-v3-qr.png','assets/catch-datamatrix.svg','assets/catch-datamatrix.png','assets/catch-datamatrix.txt','assets/memory-aztec.svg','assets/memory-aztec.png','assets/memory-aztec.txt','assets/breakout-pdf417.svg','assets/breakout-pdf417.png','assets/breakout-pdf417.txt','assets/tap-maxicode.svg','assets/tap-maxicode.png','assets/tap-maxicode.txt','assets/math-microqr.svg','assets/math-microqr.png','assets/math-microqr.txt','assets/math-rmqr.svg','assets/math-rmqr.png','assets/math-rmqr.txt','assets/colorpath-jab.svg','assets/colorpath-jab.txt','assets/colorpath-scan.svg','assets/colorpath-scan.png','assets/colorpath-scan.txt','assets/colormatch-ultra.svg','assets/colormatch-ultra.png','assets/colormatch-ultra.txt','assets/colormatch-scan.svg','assets/colormatch-scan.png','assets/colormatch-scan.txt','vendor/zxing-wasm/index.js','vendor/zxing-wasm/zxing_full.wasm','vendor/qrcode-generator.js'];
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