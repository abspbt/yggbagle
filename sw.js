// 歪嘴雞烘焙後台 PWA — Service Worker
// 策略：cache-first + 背景更新（stale-while-revalidate）

const CACHE_VERSION = 'v1.0.5';
const CACHE_NAME = 'ykj-pwa-' + CACHE_VERSION;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/data.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/logo.png'
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
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // 尊重 no-store：完全不碰 Cache Storage，直接打網路
  if (req.cache === 'no-store') {
    event.respondWith(fetch(req));
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const networkFetch = fetch(req)
        .then((networkResponse) => {
          if (networkResponse.ok || networkResponse.type === 'opaque') {
            cache.put(req, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cached);

      // cache-first：有快取先回應，背景同時更新
      return cached || networkFetch;
    })
  );
});
