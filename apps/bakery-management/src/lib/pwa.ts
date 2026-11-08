/**
 * PWA der Management-App (roadmap §2 D7, Task F3): Name, Farben, Icons und die
 * Regel, wann der Service Worker registriert wird - an genau einer Stelle, damit
 * Manifest (`app/manifest.ts`), Metadaten (`app/layout.tsx`) und Registrierung
 * nicht auseinanderlaufen.
 *
 * Der Service Worker selbst liegt als statische Datei in `public/sw.js`; er
 * cacht nur die App-Hülle (`/_next/static`, Icons, die Offline-Seite), nie
 * `/api` und nie HTML mit Daten.
 */

export const PWA_NAME = 'Heusser Verwaltung'
export const PWA_SHORT_NAME = 'Verwaltung'
export const PWA_DESCRIPTION =
  'Verwaltung der Bäckerei Heusser - Vorbestellungen, Backzettel, Produkte und Berichte'

/**
 * Farbe der Statusleiste je Modus = Hintergrund der MUI-AppBar
 * (`createTheme({ palette: { mode } })` in `Providers.tsx`): hell
 * `primary.main`, dunkel `background.paper` mit dem Elevation-4-Overlay.
 * Ändert sich das Theme, hier nachziehen - `pwa.spec.ts` rechnet nach.
 */
export const PWA_THEME_COLORS = {
  light: '#1976d2',
  dark: '#272727',
} as const

/** Seitenhintergrund (`background.default`) je Modus - Splash-Screen. */
export const PWA_BACKGROUND_COLORS = {
  light: '#ffffff',
  dark: '#121212',
} as const

/** Die Admin-Oberfläche startet dunkel (`defaultMode="dark"` in Providers). */
export const PWA_DEFAULT_MODE = 'dark' as const

export const PWA_ICONS = {
  any192: '/icons/icon-192.png',
  any512: '/icons/icon-512.png',
  maskable192: '/icons/icon-maskable-192.png',
  maskable512: '/icons/icon-maskable-512.png',
  apple: '/icons/apple-touch-icon.png',
} as const

/** Pfad des Service Workers (statisch aus `public/`), Geltungsbereich `/`. */
export const SERVICE_WORKER_PATH = '/sw.js'

/**
 * Präfix der Caches, die `public/sw.js` anlegt (dort als `CACHE_PREFIX`
 * wiederholt - eine statische Datei kann nichts importieren). Nur Caches mit
 * diesem Präfix räumt die Abmeldung ab.
 */
export const SW_CACHE_PREFIX = 'heusser-verwaltung-'

/**
 * Die Offline-Seite, die der Service Worker bei einer gescheiterten Navigation
 * zeigt. Statisch in `public/`, ohne Next.js - sie muss ohne Server laden.
 */
export const OFFLINE_PAGE_PATH = '/offline.html'

/**
 * URL, unter der der Service Worker registriert wird. Die Version kommt aus
 * dem Build (`NEXT_PUBLIC_SW_VERSION`, gesetzt in `next.config.js`): jeder neue
 * Build ändert die URL, der Browser installiert den neuen Worker, und der
 * räumt den Cache des alten ab.
 */
export function serviceWorkerUrl(
  version: string | undefined = process.env.NEXT_PUBLIC_SW_VERSION
): string {
  return version
    ? `${SERVICE_WORKER_PATH}?v=${encodeURIComponent(version)}`
    : SERVICE_WORKER_PATH
}

export interface ServiceWorkerEnvironment {
  /** `process.env.NODE_ENV` - Next setzt beim Build `production`. */
  nodeEnv: string | undefined
  /** `NEXT_PUBLIC_DISABLE_SW` - Notschalter, z. B. bei Fehlersuche auf der Box. */
  disabled?: string | undefined
  /** Hat der Browser `navigator.serviceWorker`? (jsdom: nein) */
  supported: boolean
  /** HTTPS oder localhost - sonst lehnt der Browser ohnehin ab. */
  secureContext: boolean
}

/**
 * Registriert wird nur im Produktions-Build, in einem Browser, der es kann,
 * in einem sicheren Kontext und ohne Notschalter. In `next dev` nie: dort sind
 * die Chunk-Namen nicht gehasht, ein Cache-first-Worker lieferte alten Code.
 */
export function shouldRegisterServiceWorker(
  env: ServiceWorkerEnvironment
): boolean {
  if (env.nodeEnv !== 'production') return false
  if (
    env.disabled &&
    ['1', 'true', 'on', 'yes', 'ja'].includes(env.disabled.trim().toLowerCase())
  ) {
    return false
  }
  return env.supported && env.secureContext
}

/** Liest die Umgebung im Browser; auf dem Server/jsdom ohne Worker-Support. */
export function readServiceWorkerEnvironment(): ServiceWorkerEnvironment {
  const hasWindow = typeof window !== 'undefined'
  return {
    // Wörtlich ausgeschrieben, damit Next die Ausdrücke im Bundle ersetzt.
    nodeEnv: process.env.NODE_ENV,
    disabled: process.env.NEXT_PUBLIC_DISABLE_SW,
    supported:
      hasWindow &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator,
    secureContext: hasWindow && window.isSecureContext === true,
  }
}
