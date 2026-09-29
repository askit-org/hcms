// Bump the version whenever caching rules change — old caches are deleted on activate.
const CACHE_NAME = 'hcms-pwa-v2';
const OFFLINE_URL = '/offline.html';

// Only public, non-user-specific assets are ever cached.
const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg',
  '/favicon.ico'
];

const CACHEABLE_PREFIXES = ['/_next/static/', '/icons/'];
const CACHEABLE_PATHS = new Set([OFFLINE_URL, '/manifest.webmanifest', '/favicon.ico', '/favicon.svg']);

function isCacheable(request, url) {
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  if (request.mode === 'navigate') return false;
  if (request.headers.has('Authorization')) return false;
  if (request.headers.has('RSC') || request.headers.has('Next-Router-State-Tree') || url.searchParams.has('_rsc')) return false;
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return false;
  return CACHEABLE_PATHS.has(url.pathname) || CACHEABLE_PREFIXES.some((p) => url.pathname.startsWith(p));
}

function clearAllCaches() {
  return caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))));
}

// Service Worker Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Some assets failed to precache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Service Worker Activate Event — drop every cache from previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
          return undefined;
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Messages from the app (e.g. logout / "clear data on this device")
self.addEventListener('message', (event) => {
  if (event.origin && event.origin !== self.location.origin) return;
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    event.waitUntil(clearAllCaches());
  }
});

// Fetch Interception Strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Navigations always go to the network (pages are never cached); show offline.html only when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const offlinePage = await caches.match(OFFLINE_URL);
        return offlinePage || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } });
      })
    );
    return;
  }

  // Everything outside the allow-list (API calls, RSC payloads, authenticated requests…) is untouched
  if (!isCacheable(request, url)) {
    return;
  }

  const putInCache = (response) => {
    if (response && response.status === 200 && response.type === 'basic') {
      const responseClone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
    }
    return response;
  };

  // Hashed build assets are immutable: cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then(putInCache))
    );
    return;
  }

  // Other allow-listed public assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then(putInCache).catch(() => cachedResponse);
      return cachedResponse || fetchPromise;
    })
  );
});

// Web Push Notification Listener
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification from HCMS',
      icon: data.icon || '/icons/icon-192x192.png',
      badge: '/icons/apple-touch-icon.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'HCMS by Askit Studio', options)
    );
  } catch (err) {
    console.error('[SW] Error showing push notification:', err);
  }
});

// Notification Click Listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
