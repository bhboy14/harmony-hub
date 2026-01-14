// Service Worker for Offline Support
const CACHE_NAME = 'harmony-haven-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/audio/azan-default.mp3',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests except for prayer times API
  if (!url.origin.includes(self.location.origin) && 
      !url.hostname.includes('aladhan.com')) {
    return;
  }

  // Handle prayer times API with network-first strategy
  if (url.hostname.includes('aladhan.com')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(request);
        })
    );
    return;
  }

  // Handle static assets with cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and update cache in background
        fetch(request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response);
            });
          }
        }).catch(() => {});
        
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request).then((response) => {
        // Cache successful responses for static assets
        if (response.ok && (
          request.url.endsWith('.js') ||
          request.url.endsWith('.css') ||
          request.url.endsWith('.mp3') ||
          request.url.endsWith('.png') ||
          request.url.endsWith('.svg') ||
          request.url.endsWith('.woff2')
        )) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Return offline fallback for HTML pages
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Background sync for prayer times
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-prayer-times') {
    event.waitUntil(syncPrayerTimes());
  }
});

async function syncPrayerTimes() {
  try {
    // Get saved location from storage
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      clients[0].postMessage({ type: 'SYNC_PRAYER_TIMES' });
    }
  } catch (err) {
    console.error('[SW] Failed to sync prayer times:', err);
  }
}

// Push notifications for prayer times
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    if (data.type === 'prayer_time') {
      event.waitUntil(
        self.registration.showNotification(data.title || 'Prayer Time', {
          body: data.body || 'It is time for prayer',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'prayer-notification',
          requireInteraction: true,
        })
      );
    }
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus existing window or open new one
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('/');
    })
  );
});
