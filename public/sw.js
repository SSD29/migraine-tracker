// App-shell cache so the tracker opens offline. All user data lives in IndexedDB, not here.
// Paths are relative to this file, so it works under a sub-path such as GitHub Pages.
const CACHE = 'migraine-tracker-v3';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg', './apple-touch-icon.png', './icon-192.png', './icon-512.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Network first, falling back to cache, so updates arrive when online. Pages skip the
  // browser's HTTP cache (GitHub Pages sends max-age=600) so a new version shows on next open.
  event.respondWith(
    fetch(req, req.mode === 'navigate' ? { cache: 'no-cache' } : undefined)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
  );
});
