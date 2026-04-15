const CACHE_NAME = 'biuro-zawodow-app-shell-v1';
const APP_SHELL = ['/', '/favicon.ico', '/placeholder.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

function shouldHandleAsStaticAsset(request) {
  if (request.method !== 'GET') {
    return false;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return false;
  }

  if (request.mode === 'navigate') {
    return false;
  }

  const destination = request.destination;
  return ['style', 'script', 'image', 'font'].includes(destination);
}

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseClone = response.clone();
          void caches.open(CACHE_NAME).then(cache => cache.put('/', responseClone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/');
          return cached ?? Response.error();
        })
    );
    return;
  }

  if (!shouldHandleAsStaticAsset(request)) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        return cached;
      }

      return fetch(request).then(response => {
        const responseClone = response.clone();
        void caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        return response;
      });
    })
  );
});
