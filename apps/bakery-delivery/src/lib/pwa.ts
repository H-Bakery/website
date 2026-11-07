// Service Worker der Fahrer-App (`public/sw.js`): wann er registriert wird.
// Rein, ohne React, getestet in pwa.spec.ts.

/** Muss zu CACHE_PREFIX in `public/sw.js` passen (pwa.spec.ts prüft das). */
export const SW_CACHE_PREFIX = 'heusser-fahrer-'
export const SERVICE_WORKER_PATH = '/sw.js'

export interface ServiceWorkerEnvironment {
  nodeEnv: string | undefined
  /** `NEXT_PUBLIC_DISABLE_SW=1` beim Build: Notschalter, meldet ab. */
  disabled: boolean
  supported: boolean
  secure: boolean
  version: string | undefined
}

export function readServiceWorkerEnvironment(): ServiceWorkerEnvironment {
  const hasWindow = typeof window !== 'undefined'
  return {
    nodeEnv: process.env.NODE_ENV,
    disabled: process.env.NEXT_PUBLIC_DISABLE_SW === '1',
    supported:
      hasWindow &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator,
    // HTTPS (Caddy) oder localhost - sonst gibt es keinen Service Worker.
    secure: hasWindow && window.isSecureContext === true,
    version: process.env.NEXT_PUBLIC_SW_VERSION,
  }
}

/**
 * Nur im Produktions-Build: in `next dev` lieferte ein Worker alte Chunks
 * aus dem Cache, und in jest gibt es keinen.
 */
export function shouldRegisterServiceWorker(
  env: ServiceWorkerEnvironment
): boolean {
  return (
    env.nodeEnv === 'production' && !env.disabled && env.supported && env.secure
  )
}

/** Je Build eine eigene Worker-URL - der neue Worker löscht den alten Cache. */
export function serviceWorkerUrl(version: string | undefined): string {
  return version
    ? `${SERVICE_WORKER_PATH}?v=${encodeURIComponent(version)}`
    : SERVICE_WORKER_PATH
}

/**
 * Was die Seite schon geladen hat (Chunks, CSS, Kartensymbole) - der Worker
 * legt es nach, damit auch die vor ihm geladenen Dateien offline da sind.
 */
export function loadedShellUrls(
  entries: Array<{ name: string }>,
  origin: string
): string[] {
  const urls = new Set<string>()
  for (const entry of entries) {
    let url: URL
    try {
      url = new URL(entry.name)
    } catch {
      continue
    }
    if (url.origin !== origin) continue
    if (
      url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/leaflet/')
    ) {
      urls.add(url.pathname + url.search)
    }
  }
  return Array.from(urls)
}
