// Service worker — coquille applicative résiliente hors-ligne.
// Ne touche jamais aux requêtes /api/ (autre origine) : la résilience des
// appels API est gérée par la file applicative (lib/offline), pas ici.

const CACHE_VERSION = 'v1'
const CACHE_NAME = `extincpro-shell-${CACHE_VERSION}`
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL]))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?|ttf)$/.test(url.pathname)
  )
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Autre origine (API backend) ou méthode non-GET : ne jamais intercepter.
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return

  if (url.pathname.startsWith('/api/')) return

  if (isStaticAsset(url)) {
    // Cache-first : ces assets sont hashés/immuables.
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request)
        if (cached) return cached
        try {
          const res = await fetch(event.request)
          if (res.ok) cache.put(event.request, res.clone())
          return res
        } catch {
          return cached || Response.error()
        }
      })
    )
    return
  }

  if (event.request.mode === 'navigate') {
    // Network-first avec repli sur la dernière version en cache, puis la
    // page de secours minimale si rien n'a jamais été mis en cache.
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        try {
          const res = await fetch(event.request)
          if (res.ok) cache.put(event.request, res.clone())
          return res
        } catch {
          const cached = await cache.match(event.request)
          return cached || (await cache.match(OFFLINE_URL))
        }
      })()
    )
  }
})
