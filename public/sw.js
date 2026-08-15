// Service Worker para Traslados Vans
const CACHE_NAME = 'traslados-v4';

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
            console.log('No se pudo cachear:', url, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// NO interceptar peticiones a servicios externos
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // Dejar pasar directo a internet: Google Maps, APIs, CDNs externos
  if (
    url.includes('maps.googleapis.com') ||
    url.includes('googleapis.com') ||
    url.includes('openstreetmap.org') ||
    url.includes('unpkg.com') ||
    url.includes('cdn.sheetjs.com') ||
    url.includes('gstatic.com')
  ) {
    return;
  }

  // Para el resto: caché primero, luego red
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(() => {
        return caches.match('/index.html');
      });
    })
  );
});