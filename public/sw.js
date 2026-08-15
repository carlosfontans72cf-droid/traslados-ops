// Service Worker - Versión limpia
const CACHE_NAME = 'traslados-v5';

self.addEventListener('install', (event) => {
  // Forzar activación inmediata
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      // Eliminar TODOS los caches anteriores
      return Promise.all(
        keys.map(key => {
          console.log('Eliminando caché viejo:', key);
          return caches.delete(key);
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// NO interceptar NADA de Google, CDNs ni APIs externas
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // Estas URLs van DIRECTO a internet, sin caché
  if (
    url.includes('maps.googleapis.com') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('google.com/maps') ||
    url.includes('openstreetmap.org') ||
    url.includes('tile.openstreetmap') ||
    url.includes('unpkg.com') ||
    url.includes('cdn.sheetjs.com') ||
    url.includes('nominatim.openstreetmap') ||
    url.includes('router.project-osrm')
  ) {
    // No hacer nada, dejar que el navegador maneje la petición
    return;
  }
  
  // Para recursos propios de la app: solo caché de archivos estáticos
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});