/**
 * @fileoverview Die öffentliche Basis-URL des Shops — eine Stelle, vier Verbraucher.
 * @module apps/bakery-shop/lib/site
 *
 * `robots.ts`, `sitemap.ts`, `opengraph-image.tsx` und die JSON-LD-Bausteine in
 * `structured-data.tsx` brauchen alle dieselbe absolute URL. Vier eigene
 * Konstanten wären vier Gelegenheiten, auseinanderzulaufen — deshalb steht sie
 * hier genau einmal.
 *
 * **Es wird keine Domain erfunden.** Die Reihenfolge ist:
 *
 * 1. `NEXT_PUBLIC_SHOP_URL` — die gewünschte Produktionsdomain, explizit gesetzt.
 * 2. `VERCEL_PROJECT_PRODUCTION_URL` — von Vercel automatisch gesetzt, zeigt auf
 *    die Produktionsdomain des Projekts (auch aus einem Preview-Build heraus).
 * 3. `VERCEL_URL` — die Deployment-URL des aktuellen Builds (Preview).
 * 4. `http://localhost:4200` — der Dev-Server.
 *
 * Solange (1) nicht gesetzt ist, liefert der Shop auf Vercel also die von Vercel
 * vergebene Domain aus — korrekt, nur nicht hübsch. **Vor dem Livegang
 * `NEXT_PUBLIC_SHOP_URL` setzen**, sonst stehen die Vercel-Adressen in
 * `sitemap.xml`, `robots.txt` und im JSON-LD.
 *
 * Die Variablen werden bewusst als Literal gelesen (`process.env.NAME`, nicht
 * `process.env[name]`): nur so ersetzt der Next-Bundler den Wert, wenn eines
 * dieser Module doch einmal in einer Client-Komponente landet.
 */

/** Fallback im Dev-Betrieb — der Port aus `apps/bakery-shop/project.json`. */
const LOCAL_DEV_URL = 'http://localhost:4200'

/** Leerstring für alles, was keine brauchbare Zeichenkette ist. */
function trimmed(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Ergänzt ein fehlendes Schema (Vercel liefert `VERCEL_URL` ohne `https://`)
 * und entfernt abschließende Schrägstriche, damit `shopUrl()` nie `//` erzeugt.
 */
function normalizeBase(value: string): string {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
  return withScheme.replace(/\/+$/, '')
}

/**
 * Die absolute Basis-URL des Shops, ohne abschließenden Schrägstrich.
 *
 * Pro Aufruf gelesen, nicht beim Import eingefroren — so wirkt eine im Test
 * oder zur Laufzeit gesetzte Variable auch wirklich.
 *
 * @example
 * shopBaseUrl() // 'https://shop.example.de'
 */
export function shopBaseUrl(): string {
  const candidates = [
    trimmed(process.env.NEXT_PUBLIC_SHOP_URL),
    trimmed(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    trimmed(process.env.VERCEL_URL),
  ]

  for (const candidate of candidates) {
    if (candidate.length > 0) return normalizeBase(candidate)
  }
  return LOCAL_DEV_URL
}

/**
 * Baut eine absolute Shop-URL aus einem Pfad.
 *
 * @param path Pfad mit oder ohne führenden Schrägstrich; `'/'` ergibt die
 * Startseite mit abschließendem Schrägstrich (kanonische Form für die Sitemap).
 *
 * @example
 * shopUrl('/products/kornbrot-500g') // 'https://shop.example.de/products/kornbrot-500g'
 * shopUrl('/')                       // 'https://shop.example.de/'
 */
export function shopUrl(path = '/'): string {
  const base = shopBaseUrl()
  if (path === '' || path === '/') return `${base}/`
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Die Hauptseite der Bäckerei (`apps/bakery-landing`, GitHub Pages).
 *
 * Der Shop verweist darauf für Impressum, Datenschutz und alles Werbliche — und
 * das JSON-LD nennt sie als `sameAs`, damit Suchmaschinen Shop und Website als
 * *einen* Betrieb führen statt als zwei.
 *
 * Der Punycode-Name ist die ASCII-Form von `bäckerei-heusser.de`.
 *
 * Dieselbe Ableitung steht heute noch einmal in `src/components/shop-footer.tsx`
 * (`WEBSITE_URL`) — die Datei gehört einem anderen Zuständigkeitsbereich und
 * konnte hier nicht umgestellt werden. Wer den Footer das nächste Mal anfasst,
 * sollte ihn von hier importieren.
 */
export function landingUrl(): string {
  const configured = trimmed(process.env.NEXT_PUBLIC_LANDING_URL)
  return normalizeBase(
    configured.length > 0 ? configured : 'https://xn--bckerei-heusser-0kb.de'
  )
}
