/* Service Worker de "Mi Campus Virtual" (C.A.E.R.)
   Se encarga de que la app cargue más rápido y funcione como app instalada.
   No reemplaza a firebase-messaging-sw.js (ese sigue encargándose de las notificaciones push);
   los dos conviven sin problema. */

const CACHE_NAME = 'mi-campus-virtual-v1';

const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Estrategia: red primero, si falla usa caché (así los alumnos siempre ven
// la versión más nueva cuando hay internet, pero la app no se rompe sin señal)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
