// Mahjong LAB PWA — v2.5.1b: fully local gameplay; S42 model saved only in device IndexedDB.
const CACHE='mahjong-lab-iphone-v251b';
const SHELL=['./','./index.html'];
const RESOURCES=[
 './src/mortal/mjai-bridge.mjs',
 './src/mortal/mortal-client.mjs',
 './src/mortal/s42-analytics.mjs',
 './src/mortal/mortal-worker.mjs',
 './assets/mortal/encoder.js',
 './assets/mortal/encoder_bg.wasm',
 './assets/ort/ort.min.mjs',
 './assets/ort/ort-wasm-simd-threaded.mjs',
 './assets/ort/ort-wasm-simd-threaded.wasm'
];
const PATHS=new Set(RESOURCES.map(x=>new URL(x,self.registration.scope).pathname));
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Large WASM files should not prevent the playable base application
    // from updating if Safari denies optional cache storage.
    for(const file of RESOURCES){
      try{await cache.add(file);}catch(e){console.warn('[MahjongLAB] optional local module not cached',file);}
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('mahjong-lab-iphone-')&&key!==CACHE).map(x=>caches.delete(x)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url),root=new URL('./',self.registration.scope).pathname;
  if(url.origin!==self.location.origin||!url.pathname.startsWith(root))return;
  const isShell=(url.pathname===root||url.pathname===root+'index.html');
  const isModule=PATHS.has(url.pathname);
  if(!isShell&&!isModule)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(isModule){
      const hit=await cache.match(request);
      if(hit)return hit;
      const r=await fetch(request);
      if(r.ok)await cache.put(request,r.clone());
      return r;
    }
    try{
      const r=await fetch(request);
      if(r.ok)await cache.put(request,r.clone());
      return r;
    }catch(e){return await cache.match(request)||await cache.match('./index.html')||Response.error();}
  })());
});
