/**
 * FairDrop Waiting Room Shell Service Worker
 * Caches static shell, scripts, and fonts to ensure offline resiliency during flash crowd events.
 */

const CACHE_NAME = 'fairdrop-waiting-shell-v1';
const SHELL_ASSETS = [
  '/',
  '/waiting',
  '/manifest.json',
  '/favicon.ico',
];

// Install: pre-cache waiting room shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching shell assets warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: cleanup stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for dynamic navigation, Cache-first for immutable static bundles
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Bypass API calls, SSE streams, and non-GET requests
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.pathname.includes('/stream') ||
    url.pathname.includes('/auth') ||
    url.pathname.includes('/drop')
  ) {
    return;
  }

  // Next.js static assets: cache-first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.match(/\.(js|css|woff2|png|svg|webp)$/)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // HTML page navigations (e.g. /waiting): Network-first with offline cached shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallbackWaiting = await caches.match('/waiting');
          if (fallbackWaiting) return fallbackWaiting;
          return caches.match('/');
        })
    );
  }
});
