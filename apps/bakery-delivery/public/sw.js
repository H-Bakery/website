/* eslint-disable no-restricted-globals */
/**
 * Service Worker der Fahrer-App.
 *
 * Wozu: der Fahrer tippt „Navigation“, das Handy wechselt zu Google/Apple
 * Maps, und beim Zurückkommen lädt der Browser die Seite neu - gern genau im
 * Funkloch. Ohne Worker kam dann die leere Fehlerseite des Browsers, obwohl
 * Tour und Übergabeliste als Offline-Kopie im localStorage liegen. Mit ihm
 * startet die App aus dem Cache und zeigt die gespeicherte Tour.
 *
 * Er cacht NUR die App-Hülle:
 *   - `/` (das HTML trägt keine Kundendaten: ohne Sitzung im localStorage
 *     steht dort nur „Wird geladen …“, alles Weitere kommt per API)
 *   - `/_next/static/*` (gehashte Chunks, CSS - unveränderlich)
 *   - `/leaflet/*`, `/favicon.ico`
 *
 * Nie angefasst werden `/api/*` und fremde Hosts (die Bäckerei-API, die
 * Kartenkacheln): Daten gehen immer ans Netz, und ihre Offline-Kopie ist die
 * der App (`delivery-api.ts`), nicht dieser Cache.
 *
 * Seitenaufrufe gehen zuerst ans Netz; nur wenn keins da ist (oder ein Proxy
 * 502-504 meldet), kommt die gespeicherte Hülle.
 *
 * Registriert wird er nur im Produktions-Build (`src/lib/pwa.ts`) unter
 * `/sw.js?v=<Build>`. Neuer Build ⇒ neuer Worker ⇒ alter Cache gelöscht.
 */

// Muss zu SW_CACHE_PREFIX in src/lib/pwa.ts passen (pwa.spec.ts prüft das).
const CACHE_PREFIX = 'heusser-fahrer-'
const VERSION = new URL(self.location.href).searchParams.get('v') || 'lokal'
const CACHE_NAME = CACHE_PREFIX + 'shell-' + VERSION
const SHELL_URL = '/'
const OFFLINE_TEXT =
  'Keine Verbindung – die Fahrer-App ist auf diesem Gerät noch nicht gespeichert. Bitte mit Netz einmal öffnen.'

/** Obergrenze für gecachte Dateien - ältere fliegen zuerst. */
const MAX_ENTRIES = 300

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      // Die Hülle samt der Chunks, die sie lädt. `reload`: am HTTP-Cache
      // vorbei. Scheitert das (Server weg), installiert der Worker trotzdem -
      // die Hülle kommt dann beim nächsten Seitenaufruf mit Netz dazu.
      try {
        const response = await fetch(
          new Request(SHELL_URL, { cache: 'reload' })
        )
        if (response.ok) {
          await cache.put(SHELL_URL, response.clone())
          const html = await response.text()
          await cacheAll(cache, staticUrlsIn(html))
        }
      } catch {
        // egal - siehe oben
      }
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

// Die Seite meldet nach dem Start, welche Dateien sie geladen hat - auch die,
// die vor dem ersten Worker kamen (Karte, nachgeladene Chunks).
self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'cache-urls' || !Array.isArray(data.urls)) return
  const urls = data.urls.filter(
    (url) =>
      typeof url === 'string' &&
      isShellAsset(new URL(url, self.location.origin))
  )
  const work = caches.open(CACHE_NAME).then((cache) => cacheAll(cache, urls))
  if (typeof event.waitUntil === 'function') event.waitUntil(work)
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Daten nie anfassen - auch nicht, wenn ein /api-Link direkt geöffnet wird.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request, url))
    return
  }

  if (isShellAsset(url)) {
    event.respondWith(cacheFirst(request))
  }
})

function isShellAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/leaflet/') ||
      url.pathname === '/favicon.ico')
  )
}

/** Gehashte Dateien, die eine HTML-Seite einbindet. */
function staticUrlsIn(html) {
  const found = new Set()
  const pattern = /["'(](\/_next\/static\/[^"'()\s]+)/g
  let match
  while ((match = pattern.exec(html)) !== null) found.add(match[1])
  return [...found]
}

async function cacheAll(cache, urls) {
  await Promise.allSettled(
    urls.map(async (url) => {
      if (await cache.match(url)) return
      const response = await fetch(url)
      if (response.ok) await cache.put(url, response)
    })
  )
  await trimCache(cache)
}

/**
 * Seiten: zuerst das Netz. Die Startseite wird dabei aufgefrischt. Ohne Netz
 * (oder bei 502-504 eines Proxys) kommt die gespeicherte Hülle - die App
 * hat nur diese eine Seite, jede Navigation landet dort.
 */
async function networkFirstNavigation(request, url) {
  try {
    const response = await fetch(request)
    if (response.status >= 502 && response.status <= 504) {
      return (await shellResponse()) || response
    }
    if (response.ok && url.pathname === SHELL_URL && !url.search) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(SHELL_URL, response.clone())
    }
    return response
  } catch {
    return (
      (await shellResponse()) ||
      new Response(OFFLINE_TEXT, {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    )
  }
}

async function shellResponse() {
  const cache = await caches.open(CACHE_NAME)
  return cache.match(SHELL_URL)
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
    if (new URL(keys[i].url).pathname !== SHELL_URL) {
      await cache.delete(keys[i])
    }
  }
}
