const CACHE = 'busterbuild-sales-20261002-sqmprice1';
const STATIC_SHELL = [
  './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data/sanitary-products.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request) {
  return fetch(request, { cache: 'no-store' })
    .then(response => {
      if (response && response.ok && request.method === 'GET') {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    })
    .catch(() => caches.match(request));
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const path = url.pathname;

  // Always fetch the live app/config HTML/JS first so Firebase changes appear immediately.
  if (
    request.mode === 'navigate' ||
    path.endsWith('/sales-app/') ||
    path.endsWith('/sales-app/index.html') ||
    path.endsWith('/sales-app/app.js') ||
    path.endsWith('/sales-app/firebase-config.js') ||
    path.endsWith('/sales-app/sw.js') ||
    path.endsWith('/sales-app/styles.css')
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Catalogue JSON should also prefer the newest server copy.
  if (path.includes('/data/') || path.endsWith('.json')) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }))
  );
});
