//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next')

/**
 * Version des Service Workers (PWA, F3): je Build eine neue, damit der Browser
 * nach einem Deploy den neuen Worker holt und der den alten Cache abräumt.
 * `SW_VERSION` (z. B. der Git-Commit) überschreibt den Zeitstempel.
 */
// In process.env abgelegt, damit die Build-Worker, die Next danach startet,
// denselben Wert sehen statt eines eigenen Zeitstempels.
process.env.SW_VERSION = process.env.SW_VERSION || Date.now().toString(36)
const SW_VERSION = process.env.SW_VERSION

/**
 * Gelöschte Seiten (B12) → ihr Nachfolger, damit alte Lesezeichen auf dem
 * Laden-Tablet nicht ins Leere führen. `src/lib/oldPageRedirects.spec.ts`
 * prüft, dass jedes Ziel im Pilotbetrieb erlaubt ist und keine Weiterleitung
 * eine vorhandene Seite verdeckt. Die Liste steht hier und nicht in einer
 * eigenen Datei: `nx build` kopiert nur `next.config.js` nach
 * `dist/apps/bakery-management`, wo `next start` auf der Box sie liest.
 *
 * `deep: true` leitet auch Unterseiten weiter (`/admin/orders/5` →
 * `/admin/preorders`; alte Ids gibt es dort nicht, also ohne Id). Nicht bei
 * `/admin/delivery`: darunter liegt die Sammelstelle.
 * @type {ReadonlyArray<{ from: string, to: string, deep: boolean }>}
 */
const OLD_PAGE_REDIRECTS = [
  { from: '/admin/baking-list', to: '/admin/backzettel', deep: true },
  { from: '/admin/bakery/daily-prep', to: '/admin/backzettel', deep: true },
  {
    from: '/admin/bakery/saturday-production',
    to: '/admin/backzettel',
    deep: true,
  },
  { from: '/admin/production', to: '/admin/backzettel', deep: true },
  { from: '/admin/orders', to: '/admin/preorders', deep: true },
  { from: '/admin/delivery', to: '/admin/delivery/preorders', deep: false },
]

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  env: {
    NEXT_PUBLIC_SW_VERSION: SW_VERSION,
  },
  async headers() {
    return [
      {
        // Der Worker selbst darf nie aus dem HTTP-Cache kommen, sonst sieht
        // der Browser ein Update erst nach Ablauf.
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/offline.html',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ]
  },
  // B12: alte Seiten, die durch Backzettel und Sammelstelle ersetzt sind
  // (roadmap §5.1). Redirects laufen vor src/proxy.ts, gelten also auch im
  // Pilotbetrieb; Ziel und Rollenprüfung übernimmt dann die neue Seite.
  async redirects() {
    return OLD_PAGE_REDIRECTS.map(({ from, to, deep }) => ({
      // `:path*` passt auch auf die Seite selbst (null Segmente).
      source: deep ? `${from}/:path*` : from,
      destination: to,
      permanent: false,
    }))
  },
  // Kein `rewrites()` für /api mehr (F4): `next build` schreibt Rewrites ins
  // Routen-Manifest, ein erst bei `next start` gesetztes API_URL wirkte nie.
  // Die Weiterleitung /api/* -> API_URL macht jetzt src/proxy.ts zur Laufzeit.
}

const plugins = [
  // Add more Next.js plugins if needed.
  withNx,
]

module.exports = composePlugins(...plugins)(nextConfig)
