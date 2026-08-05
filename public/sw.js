const CACHE_NAME = 'traslados-v1';
const urlsToCache = [
  '/', '/index.html', '/src/css/styles.css',
  '/src/js/firebase-config.js', '/src/js/auth.js',
  '/src/js/owner.js', '/src/js/manager.js', '/src/js/driver.js',
  '/src/js/utils.js',
  '/src/pages/dashboard-owner.html',
  '/src/pages/dashboard-manager.html',
  '/src/pages/dashboard-driver.html'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache)));
  self.skipWaiting();
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => 
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
});