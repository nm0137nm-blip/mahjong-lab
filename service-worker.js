// Mahjong LAB iPhone edition - all game assets are embedded in index.html.
const CACHE = 'mahjong-lab-iphone-v1';
const FILES = ['./', './index.html'];
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
 if (event.request.method !== 'GET') return;
 const url = new URL(event.request.url);
 if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location.href).pathname)) return;
 event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(res => {
   if (res.ok && (url.pathname.endsWith('/index.html') || url.pathname.endsWith('/'))) {
     const copy = res.clone(); caches.open(CACHE).then(c => c.put(event.request, copy));
   }
   return res;
 }).catch(() => caches.match('./index.html'))));
});
