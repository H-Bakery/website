//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next')

/**
 * Server-side base URL of the bakery API. The management app proxies all
 * `/api/*` requests to this host (see `rewrites` below), so the browser only
 * ever talks to the same origin. Configure via `API_URL` (see .env.example).
 */
const API_URL = process.env.API_URL || 'http://localhost:5000'

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ]
  },
}

const plugins = [
  // Add more Next.js plugins if needed.
  withNx,
]

module.exports = composePlugins(...plugins)(nextConfig)
