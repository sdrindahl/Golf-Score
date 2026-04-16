
const CACHE_NAME = 'golf-tracker-v2'
let currentVersion = null

// Only cache files that exist. Remove /offline.html if not present.
const urlsToCache = [
  '/',
  '/offline.html',
]

// Fetch and store current version
async function getCurrentVersion() {
  try {
    const response = await fetch('/version.json', { cache: 'no-store' })
    if (response.ok) {
      const data = await response.json()
      return data.version
    }
  } catch (err) {
    console.log('Error fetching version:', err)
  }
  return null
}

// Check for updates and notify clients
async function checkForUpdates() {
  const newVersion = await getCurrentVersion()
  if (newVersion && currentVersion && newVersion !== currentVersion) {
    console.log(`New version available: ${newVersion}`)
    // Notify all clients about the update
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          version: newVersion,
          oldVersion: currentVersion
        })
      })
    })
    currentVersion = newVersion
  }
}


// Install event - cache assets
self.addEventListener('install', (event) => {
  // Don't use await here, use promise directly in waitUntil
  const installPromise = getCurrentVersion().then((version) => {
    currentVersion = version
    console.log(`Installing service worker, version: ${currentVersion}`)
    return caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache).catch((err) => {
          console.log('Cache addAll error:', err)
        })
      })
  })
  event.waitUntil(installPromise)
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

  // Only handle GET requests
  if (request.method !== 'GET') return

  // Don't cache manifest.json, sw.js, or API calls - always fetch fresh
  if (url.pathname.includes('manifest.json') || url.pathname.includes('sw.js') || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } })
      )
    )
    return
  }

  // HTML pages: Network-first
  if (request.headers.get('accept')?.includes('text/html') || url.pathname === '/' || !url.pathname.includes('.')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache)
          }).catch((err) => {
            console.log('Cache put error:', err)
          })
          return response
        })
        .catch((err) => {
          console.log('Fetch error:', err)
          return caches.match(request).then((cached) =>
            cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } })
          )
        })
    )
    return
  }

  // Assets: Cache-first
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) return response
        return fetch(request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') return response
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache)
            })
            return response
          })
          .catch(() =>
            new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } })
          )
      })
  )
})

