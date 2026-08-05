const CACHE_NAME = 'traslados-v1';
const urlsToCache = [
  '/',                     // raíz
  '/index.html',
  '/src/css/styles.css',
  '/src/js/firebase-config.js',
  '/src/js/auth.js',
  // … cualquier otro recurso que necesites
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting(); // opcional
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});