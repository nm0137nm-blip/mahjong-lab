// Mahjong LAB PWA — v2.5.8: evidence-based coaching preview.
const CACHE='mahjong-lab-iphone-tenhou-v1';
const SHELL=['./','./index.html'];
const RESOURCES=[
 './src/coach/phoenix-coach.mjs?v=258',
 './src/coach/strategy-curriculum.mjs?v=258',
 './src/coach/relative-instructions.mjs?v=258',
 './src/mortal/mjai-bridge.mjs?v=2561',
 './src/mortal/mortal-client.mjs?v=2561',
 './src/mortal/sha256.mjs?v=2561',
 './src/mortal/s42-analytics.mjs?v=2561',
 './src/mortal/mortal-worker.mjs?v=2561',
 './assets/mortal/encoder.js',
 './assets/mortal/encoder_bg.wasm',
 './assets/ort/ort.min.mjs',
 './assets/ort/ort-wasm-simd-threaded.mjs',
 './assets/ort/ort-wasm-simd-threaded.wasm'
];
const MODULE_URLS=new Set(RESOURCES.map(x=>new URL(x,self.registration.scope).href));
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(SHELL.map(file=>new Request(new URL(file,self.registration.scope),{cache:'reload'})));
    // Large WASM files should not prevent the playable base application
    // from updating if Safari denies optional cache storage.
    for(const file of RESOURCES){
      try{await cache.add(new Request(new URL(file,self.registration.scope),{cache:'reload'}));}catch(e){console.warn('[MahjongLAB] optional local module not cached',file);}
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
  const isModule=MODULE_URLS.has(url.href);
  if(!isShell&&!isModule)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(isModule){
      const hit=await cache.match(request);
      if(hit)return hit;
      const r=await fetch(new Request(request,{cache:'reload'}));
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
