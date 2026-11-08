'use client'

import { useEffect } from 'react'
import {
  SERVICE_WORKER_PATH,
  SW_CACHE_PREFIX,
  readServiceWorkerEnvironment,
  serviceWorkerUrl,
  shouldRegisterServiceWorker,
} from '../../lib/pwa'

/**
 * Meldet `public/sw.js` an - nur im Produktions-Build (`lib/pwa.ts`).
 *
 * Sonst (Entwicklung, Notschalter `NEXT_PUBLIC_DISABLE_SW=1`) wird ein früher
 * registrierter Worker dieser App wieder abgemeldet und sein Cache gelöscht:
 * Wer auf `localhost:4201` erst `next start` und dann `next dev` fährt, bekäme
 * sonst alte Chunks aus dem Cache.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    const env = readServiceWorkerEnvironment()
    if (!env.supported) return

    if (shouldRegisterServiceWorker(env)) {
      navigator.serviceWorker
        .register(serviceWorkerUrl(), { scope: '/' })
        .catch((error: unknown) => {
          // Ohne Worker läuft die App ganz normal, nur ohne Offline-Seite.
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
