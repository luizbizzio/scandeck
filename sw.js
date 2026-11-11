/* Offline shell cache. Game code is never sent to a remote endpoint. */
const CACHE='scandeck-v4';
const FILES=['./','index.html','style.css','app.js','protocol.js','runtime.js','code128.js','assets/favicon.svg','assets/snake-code128.svg','assets/ironpass-micro-v3.txt','assets/ironpass-micro-v3-qr.png'];
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