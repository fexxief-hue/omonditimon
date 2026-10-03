const CACHE_NAME = 'lbfc-shell-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/style.css',
  '/css/pwa.css',
  '/css/match-countdown.css',
  '/js/app.js?v=match-countdown-1',
  '/js/pwa.js?v=1',
  '/assets/app-icon-192.png',
  '/assets/app-icon-512.png',
  '/assets/apple-touch-icon.png',
  '/assets/los-blancos-badge.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('lbfc-shell-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async response => {
          if (response.ok) {
            const copy = response.clone();
            const cache = await caches.open(CACHE_NAME);
            await cache.put('/index.html', copy);
          }
          return response;
        })
        .catch(async () => (await caches.match('/index.html')) || Response.error())
    );
    return;
  }

  if (!url.pathname.startsWith('/css/') && !url.pathname.startsWith('/js/') && !url.pathname.startsWith('/assets/')) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
