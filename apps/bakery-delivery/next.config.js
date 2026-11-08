//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next')

/**
 * Version des Service Workers (`public/sw.js?v=…`): je Build eine neue, damit
 * der neue Worker die Hülle des alten Builds aus dem Cache wirft.
 * `SW_VERSION` (z. B. der Git-Commit) überschreibt den Zeitstempel.
 */
process.env.SW_VERSION = process.env.SW_VERSION || Date.now().toString(36)
const SW_VERSION = process.env.SW_VERSION

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  env: {
    NEXT_PUBLIC_SW_VERSION: SW_VERSION,
  },
  // Der Worker selbst darf nie aus einem Cache kommen - sonst bliebe ein
  // alter Build hängen.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ]
  },
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
}

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
]

module.exports = composePlugins(...plugins)(nextConfig)
