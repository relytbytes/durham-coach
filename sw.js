/* Cadence service worker — offline app shell + runtime caching */
const CACHE = 'cadence-v1';
const CORE = ['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png',
  'favicon-32.png','favicon-16.png','favicon.svg','apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // the app itself: network-first so updates land, cache fallback for offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put('index.html', cp));
        return r;
      }).catch(() => caches.match('index.html'))
    );
    return;
  }
  // same-origin assets: cache-first
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put(req, cp));
        return r;
      }))
    );
    return;
  }
  // fonts + leaflet: cache after first use so offline keeps the look; weather/food APIs stay network-only
  if (url.host.includes('fonts.g') || url.host.includes('unpkg.com')) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put(req, cp));
        return r;
      }).catch(() => caches.match(req)))
    );
  }
});
