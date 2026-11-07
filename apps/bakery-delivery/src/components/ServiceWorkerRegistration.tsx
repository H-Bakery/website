'use client'

import { useEffect } from 'react'
import {
  loadedShellUrls,
  readServiceWorkerEnvironment,
  SERVICE_WORKER_PATH,
  serviceWorkerUrl,
  shouldRegisterServiceWorker,
  SW_CACHE_PREFIX,
} from '../lib/pwa'

/**
 * Meldet `public/sw.js` an - nur im Produktions-Build (`lib/pwa.ts`). Damit
 * startet die App auch im Funkloch und zeigt die gespeicherte Tour.
 *
 * Sonst (Entwicklung, Notschalter `NEXT_PUBLIC_DISABLE_SW=1`) wird ein früher
 * registrierter Worker dieser App abgemeldet und sein Cache gelöscht - sonst
 * bekäme `next dev` nach einem `next start` auf demselben Port alte Chunks.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    const env = readServiceWorkerEnvironment()
    if (!env.supported) return

    if (shouldRegisterServiceWorker(env)) {
      navigator.serviceWorker
        .register(serviceWorkerUrl(env.version), { scope: '/' })
        .then(() => navigator.serviceWorker.ready)
        .then((registration) => {
          const urls = loadedShellUrls(
            performance.getEntriesByType('resource'),
            window.location.origin
          )
          registration.active?.postMessage({ type: 'cache-urls', urls })
        })
        .catch((error: unknown) => {
          // Ohne Worker läuft die App ganz normal, nur nicht beim Neuladen
          // im Funkloch.
          console.warn('Service Worker nicht registriert:', error)
        })
      return
    }

    void unregisterOwnServiceWorkers()
  }, [])

  return null
}

async function unregisterOwnServiceWorkers(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      registrations
        .filter((registration) => {
          const script =
            registration.active ??
            registration.waiting ??
            registration.installing
          return (
            script !== null &&
            new URL(script.scriptURL).pathname === SERVICE_WORKER_PATH
          )
        })
        .map((registration) => registration.unregister())
    )
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith(SW_CACHE_PREFIX))
          .map((key) => caches.delete(key))
      )
    }
  } catch {
    // Aufräumen ist Komfort - scheitert es, bleibt alles wie es war.
  }
}
