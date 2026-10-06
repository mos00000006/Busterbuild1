/* BusterBuild public website root service-worker cleanup.
   The Sales App service worker belongs ONLY in /sales-app/.
*/
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(k => k.startsWith('busterbuild-sales-'))
          .map(k => caches.delete(k))
      );
    } catch(e) {}

    try {
      await self.registration.unregister();
    } catch(e) {}

    try {
      const clientsList = await self.clients.matchAll({type:'window', includeUncontrolled:true});
      for (const client of clientsList) client.navigate(client.url);
    } catch(e) {}
  })());
});
