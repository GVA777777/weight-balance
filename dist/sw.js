// Bump this version for every release that changes a cached application file.
const CACHE = 'balance-flight-v5';
const ASSETS = ['./','./index.html','./styles.css','./src/app.js','./src/profiles.js','./src/calculate.js','./src/storage.js','./src/graphics.js','./src/print.js','./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache = await caches.open(CACHE);
    try { await cache.addAll(ASSETS); } catch(error) { await caches.delete(CACHE); throw error; }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => event.waitUntil((async()=>{
  await Promise.all((await caches.keys()).filter(key=>key.startsWith('balance-flight-')&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    // Navigation is network first so the installed app can receive a new release.
    if(event.request.mode==='navigate') {
      try {const response=await fetch(event.request);if(response.ok)return response;}catch{}
      return await cache.match('./index.html');
    }
    const cached=await cache.match(event.request);
    return cached ?? fetch(event.request);
  })());
});
