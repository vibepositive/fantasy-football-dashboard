const CACHE_NAME = 'mettlers-shell-v5';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './activity.css',
  './trade-v2.css',
  './live-scores.css',
  './waiver-intel.css',
  './mobile.css',
  './mobile-layout-fix.css',
  './app.js',
  './waiver-intel.js',
  './live-scores.js',
  './trade-v2.js',
  './activity.js',
  './manifest.webmanifest',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => undefined);
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('./')))
  );
});
