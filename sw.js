const CACHE='eps-pilot-v41.6-shell-v1';
const SHELL=['/','/index.html','/styles.css?v=41.6','/app.js?v=41.6','/react.production.min.js','/react-dom.production.min.js','/assets/eps-pilot-logo.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url); if(u.origin!==location.origin || u.pathname.startsWith('/api/'))return;
 e.respondWith(caches.match(e.request).then(cached=>fetch(e.request).then(r=>{if(r.ok&&['GET'].includes(e.request.method)){const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}return r}).catch(()=>cached||caches.match('/index.html'))));
});
