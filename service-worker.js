/* GEMEL INVEST PWA Service Worker (GitHub Pages) */
const CACHE_NAME = 'gemel-invest-pwa-v1';

// App shell (cache without query string)
const APP_SHELL = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.webmanifest',
  './assets/logo-login-clean.svg',
  './assets/icons/icon-72.png',
  './assets/icons/icon-96.png',
  './assets/icons/icon-128.png',
  './assets/icons/icon-144.png',
  './assets/icons/icon-152.png',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-384.png',
  './assets/icons/icon-512.png',
  './assets/companies/achshara.png',
  './assets/companies/afenix.png',
  './assets/companies/aig.png',
  './assets/companies/ayalon.png',
  './assets/companies/beytuyashir.png',
  './assets/companies/clal.png',
  './assets/companies/harel.png',
  './assets/companies/megdl.png',
  './assets/companies/menora.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : Promise.resolve()));
      await self.clients.claim();
    })()
  );
});

// Cache strategy:
// - Same-origin GET requests: cache-first (ignoring query string) with network fallback + update cache.
// - Navigation requests: serve cached index.html first (offline-friendly), else network.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // SPA-ish navigation fallback to index.html
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match('./index.html');
      try {
        const fresh = await fetch(req);
        // Update cache in background
        cache.put('./index.html', fresh.clone()).catch(()=>{});
        return fresh;
      } catch (_) {
        return cached || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Ignore query-string (your BUILD=Date.now() busting)
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) {
      // Update cache in background (stale-while-revalidate)
      fetch(req).then(r => {
        if (r && r.ok) cache.put(req, r.clone()).catch(()=>{});
      }).catch(()=>{});
      return cached;
    }

    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(()=>{});
      return fresh;
    } catch (_) {
      return Response.error();
    }
  })());
});
