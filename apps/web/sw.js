/* LuckyTodo service worker — cache shell for offline launch */
const CACHE = 'luckytodo-shell-v20261009h';
const SHELL = [
  './',
  './index.html',
  './app.js',
  './src/styles.js',
  './src/api.js',
  './src/db.js',
  './src/reminders.js',
  './src/native.js',
  './public/manifest.webmanifest',
  './public/logo.png',
  './public/logo-horizontal.png',
  './public/icon-192.png',
  './public/icon-512.png',
  './public/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API
  if (url.pathname.startsWith('/api/')) return;

  // JS/HTML/CSS: network-first so updates aren't stuck behind stale shell cache
  const path = url.pathname;
  const networkFirst =
    path.endsWith('.js') ||
    path.endsWith('.html') ||
    path.endsWith('/') ||
    path.endsWith('index.html');

  if (networkFirst) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
