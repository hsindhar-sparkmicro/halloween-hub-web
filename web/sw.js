// The build replaces CACHE and SHELL with a content version and full asset list.
const CACHE='halloween-hub-preview-v1';
const SHELL=['./','./index.html','./app.js','./style.css'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('halloween-hub-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url),scope=new URL(self.registration.scope);
 if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname)||/\.(mp4|webm)$/.test(url.pathname))return;
 if(event.request.headers.has('range')){
  if(/\.(mp3|wav|ogg)$/i.test(url.pathname))event.respondWith(audioRange(event.request));
  return;
 }
 if(event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).catch(()=>caches.match(new URL('./index.html',scope).href)));return;
 }
 event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(event.request))||fetch(event.request)));
});

// Browsers request audio in byte ranges, including when playing offline.
async function audioRange(request){
 const cache=await caches.open(CACHE),cached=await cache.match(request.url);
 const match=/^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range'));
 if(!cached||!match||(!match[1]&&!match[2]))return fetch(request);
 const bytes=await cached.arrayBuffer(),total=bytes.byteLength;
 const start=match[1]?Number(match[1]):Math.max(0,total-Number(match[2]));
 const end=match[1]&&match[2]?Math.min(total-1,Number(match[2])):total-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=total||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${total}`}});
 const headers=new Headers(cached.headers);
 headers.delete('content-encoding');headers.set('Content-Range',`bytes ${start}-${end}/${total}`);
 headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');
 return new Response(bytes.slice(start,end+1),{status:206,headers});
}
