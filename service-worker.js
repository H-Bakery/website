// Service Worker for Bäckerei Heusser PWA
// Version: 1.0.0

const CACHE_NAME = 'bakery-heusser-v1'
const RUNTIME_CACHE = 'runtime-cache-v1'
const IMAGE_CACHE = 'image-cache-v1'

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/products',
  '/about',
  '/bestellen',
  '/news',
  '/imprint',
  '/offline.html',
  '/_next/static/css/app.css',
  '/_next/static/chunks/main.js',
  '/_next/static/chunks/framework.js',
  '/favicon.ico',
  '/og-image.svg',
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install')

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets')
        // Try to cache each asset individually to avoid failing on missing files
        return Promise.allSettled(
          STATIC_ASSETS.map((url) =>
            cache
              .add(url)
              .catch((err) =>
                console.warn(`[ServiceWorker] Failed to cache ${url}:`, err)
              )
          )
        )
      })
      .then(() => self.skipWaiting())
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate')

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return (
                cacheName !== CACHE_NAME &&
                cacheName !== RUNTIME_CACHE &&
                cacheName !== IMAGE_CACHE
              )
            })
            .map((cacheName) => {
              console.log('[ServiceWorker] Removing old cache:', cacheName)
              return caches.delete(cacheName)
            })
        )
      })
      .then(() => self.clients.claim())
  )
})

// Fetch event - serve from cache when possible
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!request.url.startsWith('http')) {
    return
  }

  // Handle images with cache-first strategy
  if (
    request.destination === 'image' ||
    /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches
        .open(IMAGE_CACHE)
        .then((cache) => {
          return cache.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
            }

            return fetch(request).then((fetchResponse) => {
              // Only cache successful responses
              if (fetchResponse.ok) {
                cache.put(request, fetchResponse.clone())
              }
              return fetchResponse
            })
          })
        })
        .catch(() => {
          // Return offline placeholder image if available
          return caches.match('/assets/offline-image.svg')
        })
    )
    return
  }

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response before caching
          const responseToCache = response.clone()

          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache)
          })

          return response
        })
        .catch(() => {
          // Fall back to cache if network fails
          return caches.match(request)
        })
    )
    return
  }

  // Handle navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return response
        })
        .catch(() => {
          // Try cache first
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
            }
            // Fall back to offline page
            return caches.match('/offline.html')
          })
        })
    )
    return
  }

  // Default strategy: Cache first, then network
  event.respondWith(
    caches
      .match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version and update cache in background
          fetch(request).then((fetchResponse) => {
            if (fetchResponse.ok) {
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, fetchResponse)
              })
            }
          })
          return cachedResponse
        }

        // No cache match, fetch from network
        return fetch(request).then((fetchResponse) => {
          // Cache successful responses
          if (fetchResponse.ok) {
            const responseToCache = fetchResponse.clone()
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache)
            })
          }
          return fetchResponse
        })
      })
      .catch(() => {
        // Both cache and network failed
        console.error('[ServiceWorker] Fetch failed for:', request.url)

        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/offline.html')
        }
      })
  )
})

// Background sync for form submissions
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag)

  if (event.tag === 'order-sync') {
    event.waitUntil(
      // Sync pending orders when connection is restored
      syncPendingOrders()
    )
  }
})

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received')

  let title = 'Bäckerei Heusser'
  let options = {
    body: 'Neue Angebote verfügbar!',
    icon: '/favicon-192x192.png',
    badge: '/favicon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'explore',
        title: 'Angebote ansehen',
        icon: '/assets/icons/checkmark.png',
      },
      {
        action: 'close',
        title: 'Schließen',
        icon: '/assets/icons/xmark.png',
      },
    ],
  }

  if (event.data) {
    const data = event.data.json()
    title = data.title || title
    options = { ...options, ...data.options }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click:', event.action)

  event.notification.close()

  if (event.action === 'explore') {
    event.waitUntil(clients.openWindow('/products'))
  } else {
    event.waitUntil(clients.openWindow('/'))
  }
})

// Helper function to sync pending orders
async function syncPendingOrders() {
  try {
    // Get pending orders from IndexedDB or localStorage
    const pendingOrders = await getPendingOrders()

    if (pendingOrders.length > 0) {
      // Send orders to server
      const response = await fetch('/api/orders/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orders: pendingOrders }),
      })

      if (response.ok) {
        // Clear pending orders
        await clearPendingOrders()
        console.log('[ServiceWorker] Orders synced successfully')
      }
    }
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error)
  }
}

// Placeholder functions for order management
async function getPendingOrders() {
  // Implementation would retrieve from IndexedDB
  return []
}

async function clearPendingOrders() {
  // Implementation would clear from IndexedDB
  return true
}
