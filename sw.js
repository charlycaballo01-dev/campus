/* Service Worker de "Mi Campus Virtual" (C.A.E.R.)
   Se encarga de que la app cargue más rápido y funcione como app instalada.
   No reemplaza a firebase-messaging-sw.js (ese sigue encargándose de las notificaciones push);
   los dos conviven sin problema. */

// IMPORTANTE: cambiá este número cada vez que subas una versión nueva del sitio (v2, v3, v4...).
// Es lo que hace que el teléfono de cada alumno se olvide de la versión vieja que tenía guardada
// y purgue esa caché en cuanto activa la nueva. Si dejás el mismo número, la caché vieja queda
// pegada para siempre y algunos alumnos pueden seguir viendo contenido antiguo.
const CACHE_NAME = 'mi-campus-virtual-v2';

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
// la versión más nueva cuando hay internet, pero la app no se rompe sin señal).
// "cache: no-store" hace que el pedido a la red ignore también la caché HTTP normal del
// navegador (no solo la de este Service Worker), para que con internet SIEMPRE se traiga el
// archivo más nuevo del servidor.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
