// App shell + car badges are cached; NASCAR live timing/schedule feeds are never cached (always network).
const V='nascar-live-v1';
const SHELL=['./','index.html','style.css','phone.css','app.js','tracks.js','testrace.js','roster.js','manifest.json','fonts/InterVariable.woff2','icons/icon-192.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!=='nascar-badges').map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
  if(u.hostname==='cf.nascar.com'&&u.pathname.startsWith('/data/images/carbadges/')){ // badges: cache first
    e.respondWith(caches.open('nascar-badges').then(c=>c.match(e.request).then(r=>r||fetch(e.request).then(n=>{if(n.ok||n.type==='opaque')c.put(e.request,n.clone());return n}))));return}
  if(u.origin!==location.origin)return;                       // live feeds etc.: untouched, straight to network
  e.respondWith(fetch(e.request).then(n=>{if(n.ok)caches.open(V).then(c=>c.put(e.request,n.clone()));return n}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))))}); // network-first shell, offline fallback
