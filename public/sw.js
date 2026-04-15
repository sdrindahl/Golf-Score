const CACHE_NAME = 'golf-tracker-v2'
const urlsToCache = [
  '/',
  '/offline.html',
]

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache).catch((err) => {
          console.log('Cache addAll error:', err)
        })
      })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch event
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Don't cache manifest.json, sw.js, or API calls - always fetch fresh
  if (url.pathname.includes('manifest.json') || 
      url.pathname.includes('sw.js') ||
      url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/') || new Response('Offline')
      })
    )
    return
  }

  // HTML pages: Network-first (always try to get latest)
  if (request.headers.get('accept')?.includes('text/html') || 
      url.pathname === '/' || 
      !url.pathname.includes('.')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache error responses
          if (!response || response.status !== 200) {
            return response
          }
          // Only cache basic responses
          if (response.type !== 'basic') {
            return response
          }
          // Clone and cache the response
          const responseToCache = response.clone()
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseToCache)
            })
            .catch((err) => {
              console.log('Cache put error:', err)
            })
          return response
        })
        .catch((err) => {
          console.log('Fetch error:', err)
          // Network failed, try cache
          return caches.match(request) || caches.match('/')
        })
    )
    return
  }

  // Assets (JS, CSS, images, fonts): Cache-first
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response
        }

        return fetch(request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response
            }

            // Clone and cache the response
            const responseToCache = response.clone()
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache)
              })

            return response
          })
          .catch(() => {
            // Return offline fallback for assets
            return caches.match('/') || new Response('Offline')
          })
      })
  )
})

