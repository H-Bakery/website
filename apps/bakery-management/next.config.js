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
  // Kein `rewrites()` für /api mehr (F4): `next build` schreibt Rewrites ins
  // Routen-Manifest, ein erst bei `next start` gesetztes API_URL wirkte nie.
  // Die Weiterleitung /api/* -> API_URL macht jetzt src/proxy.ts zur Laufzeit.
}

const plugins = [
  // Add more Next.js plugins if needed.
  withNx,
]

module.exports = composePlugins(...plugins)(nextConfig)
