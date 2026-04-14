const CACHE_NAME = 'greenline-v3';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/learn.html',
  '/crypto-learn.html',
  '/brand/favicon/favicon.svg',
  'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never cache API/function calls
  if (url.pathname.startsWith('/.netlify/')) return;

  const isHTML = e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html');
  const isStatic = /\.(svg|png|css|js)$/i.test(url.pathname);

  if (isHTML) {
    // Network-first for HTML
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (e.request.method === 'GET' && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else if (isStatic) {
    // Cache-first for static assets
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (e.request.method === 'GET' && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return res;
        }).catch(() => caches.match(e.request));
      })
    );
  } else {
    // Default: network-first
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (e.request.method === 'GET' && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
