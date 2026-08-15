const CACHE_NAME = 'traslados-v3';

const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/auth.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        urlsToCache.map(url => {
          return fetch(url).then(response => {
            if (response.ok) {
              return cache.put(url, response);
            }
          }).catch(err => {
            console.log(`No se pudo cachear ${url}:`, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
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
  self.clientsClaim();
});

// ✅ NO interceptar peticiones a Google Maps ni servicios externos
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // Si es petición a Google Maps, APIs externas, o recursos de terceros → ir directo a la red
  if (
    url.includes('maps.googleapis.com') ||
    url.includes('googleapis.com') ||
    url.includes('google.com/maps') ||
    url.includes('openstreetmap.org') ||
    url.includes('unpkg.com') ||
    url.includes('cdn.sheetjs.com') ||
    url.includes('tile.openstreetmap')
  ) {
    return; // No interceptar, dejar que vaya directo a internet
  }

  // Para el resto: intentar caché primero, luego red
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});