/**
 * Service Worker v1 — v0.16.0
 * Cache-first static assets, network-first API, offline detection
 */

const CACHE_NAME = 'mash-cache-v1'
const STATIC_CACHE_NAME = 'mash-static-v1'
const API_CACHE_NAME = 'mash-api-v1'

/**
 * Static assets to cache on install
 */
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
]

/**
 * API routes that should use network-first strategy
 */
const API_ROUTES = [
  '/api/',
]

/**
 * Routes that should never be cached
 */
const NO_CACHE_ROUTES = [
  '/api/v1/auth/',
  '/ws/',
]

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('[SW] Static assets cached')
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error)
      })
  )
})

/**
 * Activate event - clean old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name.startsWith('mash-') && 
                     name !== CACHE_NAME && 
                     name !== STATIC_CACHE_NAME && 
                     name !== API_CACHE_NAME
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name)
              return caches.delete(name)
            })
        )
      })
      .then(() => {
        console.log('[SW] Claiming clients')
        return self.clients.claim()
      })
  )
})

/**
 * Fetch event - handle requests
 */
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }
  
  // Skip WebSocket and no-cache routes
  if (shouldSkipCache(url)) {
    return
  }
  
  // API routes - network first
  if (isApiRoute(url)) {
    event.respondWith(networkFirst(request, API_CACHE_NAME))
    return
  }
  
  // Static assets - cache first
  event.respondWith(cacheFirst(request, STATIC_CACHE_NAME))
})

/**
 * Check if URL should skip cache
 */
function shouldSkipCache(url) {
  return NO_CACHE_ROUTES.some(route => url.pathname.startsWith(route)) ||
         url.protocol === 'ws:' ||
         url.protocol === 'wss:'
}

/**
 * Check if URL is an API route
 */
function isApiRoute(url) {
  return API_ROUTES.some(route => url.pathname.startsWith(route))
}

/**
 * Cache-first strategy
 */
async function cacheFirst(request, cacheName) {
  try {
    const cachedResponse = await caches.match(request)
    
    if (cachedResponse) {
      // Return cached response and update cache in background
      updateCache(request, cacheName)
      return cachedResponse
    }
    
    // Not in cache, fetch from network
    const networkResponse = await fetch(request)
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.error('[SW] Cache-first failed:', error)
    
    // Return offline fallback if available
    const offlineResponse = await caches.match('/offline.html')
    if (offlineResponse) {
      return offlineResponse
    }
    
    return new Response('Offline', { status: 503 })
  }
}

/**
 * Network-first strategy
 */
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request)
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url)
    
    // Network failed, try cache
    const cachedResponse = await caches.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return error response
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * Update cache in background
 */
async function updateCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse)
    }
  } catch (error) {
    // Silently fail - we already have cached version
  }
}

/**
 * Background sync for offline operations
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag)
  
  if (event.tag === 'board-sync') {
    event.waitUntil(syncBoardOperations())
  }
  
  if (event.tag === 'message-sync') {
    event.waitUntil(syncMessages())
  }
})

/**
 * Sync board operations
 */
async function syncBoardOperations() {
  try {
    // Get pending operations from IndexedDB
    const operations = await getPendingBoardOperations()
    
    if (operations.length === 0) {
      return
    }
    
    // Send to server
    const response = await fetch('/api/v1/board/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations }),
    })
    
    if (response.ok) {
      // Clear pending operations
      await clearPendingBoardOperations()
      console.log('[SW] Board operations synced')
    }
  } catch (error) {
    console.error('[SW] Board sync failed:', error)
    throw error // Retry later
  }
}

/**
 * Sync messages
 */
async function syncMessages() {
  try {
    const messages = await getPendingMessages()
    
    if (messages.length === 0) {
      return
    }
    
    const response = await fetch('/api/v1/chat/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    })
    
    if (response.ok) {
      await clearPendingMessages()
      console.log('[SW] Messages synced')
    }
  } catch (error) {
    console.error('[SW] Message sync failed:', error)
    throw error
  }
}

/**
 * Push notification handling
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push received')
  
  let data = { title: 'Mash', body: 'Нове повідомлення' }
  
  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      data.body = event.data.text()
    }
  }
  
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || 'default',
    renotify: true,
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

/**
 * Notification click handling
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag)
  
  event.notification.close()
  
  const urlToOpen = event.notification.data?.url || '/'
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus()
          }
        }
        
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})

/**
 * Message handling from main thread
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {}
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break
      
    case 'CLEAR_CACHE':
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name))
      })
      break
      
    case 'GET_VERSION':
      event.ports[0]?.postMessage({ version: CACHE_NAME })
      break
  }
})

/**
 * Placeholder functions for IndexedDB operations
 * These will be implemented in the actual IndexedDB module
 */
async function getPendingBoardOperations() {
  // Will be replaced with actual IndexedDB call
  return []
}

async function clearPendingBoardOperations() {
  // Will be replaced with actual IndexedDB call
}

async function getPendingMessages() {
  // Will be replaced with actual IndexedDB call
  return []
}

async function clearPendingMessages() {
  // Will be replaced with actual IndexedDB call
}

console.log('[SW] Service worker loaded')
