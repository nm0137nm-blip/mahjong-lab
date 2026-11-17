// Mahjong LAB offline cache v0.4: Network-first online, cache-first offline.
const CACHE = 'mahjong-lab-iphone-v04';
const FILES = ['./', './index.html'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('mahjong-lab-iphone-') && key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const root=new URL('./',self.location.href).pathname;
  if(url.origin!==self.location.origin||!url.pathname.startsWith(root))return;
  event.respondWith(fetch(event.request).then(async response=>{
    if(response.ok && (url.pathname.endsWith('/')||url.pathname.endsWith('/index.html'))) {
      const cache=await caches.open(CACHE);await cache.put(event.request,response.clone());
    }
    return response;
  }).catch(async()=>{
    const cached=await caches.match(event.request);
    return cached || caches.match('./index.html');
  }));
});
