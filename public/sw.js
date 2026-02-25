// Minimal service worker for PWA installability.
// Network-first strategy: always try network, no offline caching.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
