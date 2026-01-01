const CACHE_NAME = 'scrollkurai-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network-first for app shell and never cache modules
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const dest = event.request.destination;

  // Always bypass cache for HTML, scripts, styles, workers, vite tooling and source modules
  const bypass = (
    dest === 'document' || dest === 'script' || dest === 'style' || dest === 'worker' ||
    url.pathname.startsWith('/@vite') ||
    url.pathname.includes('/node_modules/.vite') ||
    url.pathname.includes('.vite/deps') ||
    url.pathname.startsWith('/src/')
  );

  if (bypass) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
