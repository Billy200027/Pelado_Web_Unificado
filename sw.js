// Para sitios HTTPS/localhost: abre una vez con conexión antes de usar sin red.
const CACHE='pelado-web-2026-10-21-v9';
const FILES=['./','index.html','variables.css','style.css?v=20261021-import-v9','logo.svg','core.js?v=20261021-import-v9','variables.js?v=20261021-import-v9','remote-config.js','display.js?v=20261021-import-v9','app.js?v=20261021-import-v9','excel-insights.js?v=20261021-import-v9','excel.js?v=20261021-import-v9','daily-import.js?v=20261021-import-v9','xlsx.full.min.js','jspdf.umd.min.js','jspdf.plugin.autotable.min.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pelado-web-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 // Solo la aplicación estática. Nunca almacenar API, documentos subidos o solicitudes de terceros.
 const paths=FILES.map(p=>new URL(p,self.registration.scope).href);
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match(new URL('index.html',self.registration.scope))));return;}
 if(paths.includes(event.request.url))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
