// Minimal Service Worker for PWA Installability
// Version bumped to force cache invalidation
const CACHE_NAME = 'scrollkurai-v2';
const urlsToCache = [
    '/manifest.json'
];

// Install - cache only manifest, not HTML
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force immediate activation
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch - NETWORK FIRST strategy to prevent stale content
self.addEventListener('fetch', (event) => {
    // For navigation requests (HTML), always go to network first
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // For other requests, try network first, fallback to cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Don't cache if not a successful response
                if (!response || response.status !== 200) {
                    return response;
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// Activate - Clear old caches immediately
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
        }).then(() => self.clients.claim()) // Take control immediately
    );
});
