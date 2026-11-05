/* eslint-disable no-restricted-globals */
/**
 * Service Worker der Heusser Verwaltung (roadmap D7, Task F3).
 *
 * Er cacht NUR die App-Hülle:
 *   - `/_next/static/*`  (gehashte Chunks, CSS, Schriften - unveränderlich)
 *   - `/icons/*`, `/favicon.ico`
 *   - `/offline.html`    (die Seite „Keine Verbindung zum Server")
 *
 * Nie gecacht werden `/api/*` (Vorbestellungen, Umsätze, Kunden) und HTML-Seiten
 * - die tragen Daten. Seitenaufrufe gehen immer zuerst ans Netz; nur wenn der
 * Server nicht antwortet, kommt die Offline-Seite. Alles andere (RSC-Abrufe,
 * Manifest, fremde Hosts) reicht der Worker unberührt durch.
 *
 * Registriert wird er nur im Produktions-Build, aus
 * `src/components/pwa/ServiceWorkerRegistration.tsx`, unter `/sw.js?v=<Build>`.
 * Neuer Build ⇒ neue URL ⇒ neuer Worker ⇒ der alte Cache wird gelöscht.
 */

// Muss zu SW_CACHE_PREFIX in src/lib/pwa.ts passen (pwa.spec.ts prüft das).
const CACHE_PREFIX = 'heusser-verwaltung-'
const VERSION = new URL(self.location.href).searchParams.get('v') || 'lokal'
const CACHE_NAME = CACHE_PREFIX + 'shell-' + VERSION
const OFFLINE_URL = '/offline.html'
const OFFLINE_TEXT = 'Keine Verbindung zum Server – bitte WLAN prüfen'

/** Icons sind Komfort; fehlt eins, scheitert die Installation daran nicht. */
const OPTIONAL_PRECACHE = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.ico',
]

/** Obergrenze für gecachte Dateien - ältere fliegen zuerst. */
const MAX_ENTRIES = 400

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      // `reload`: am HTTP-Cache vorbei, damit die Offline-Seite frisch ist.
      await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))
      await Promise.allSettled(
        OPTIONAL_PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: 'reload' }))
        )
      )
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Daten nie anfassen - auch nicht, wenn ein /api-Link direkt geöffnet wird.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (isShellAsset(url)) {
    event.respondWith(cacheFirst(request))
  }
})

function isShellAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.ico' ||
    url.pathname === OFFLINE_URL
  )
}

/**
 * Seiten: immer das Netz. Die Antwort wird NICHT gecacht. Antwortet der Server
 * nicht (kein WLAN, Box aus) oder meldet der Proxy davor 502–504 (Caddy läuft,
 * Next nicht), kommt die Offline-Seite.
 */
async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
    if (response.status >= 502 && response.status <= 504) {
      return (await offlineResponse()) || response
    }
    return response
  } catch {
    return (
      (await offlineResponse()) ||
      new Response(OFFLINE_TEXT, {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    )
  }
}

async function offlineResponse() {
  const cache = await caches.open(CACHE_NAME)
  return cache.match(OFFLINE_URL)
}

/** Statische Hülle: Cache zuerst, sonst Netz und ablegen. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone())
    await trimCache(cache)
  }
  return response
}

async function trimCache(cache) {
  const keys = await cache.keys()
  const excess = keys.length - MAX_ENTRIES
  for (let i = 0; i < excess; i += 1) {
    if (new URL(keys[i].url).pathname !== OFFLINE_URL) {
      await cache.delete(keys[i])
    }
  }
}
