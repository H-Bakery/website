// @ts-nocheck

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next')
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  output: 'export',
  // trailingSlash: true, // Temporarily disabled due to build issues
  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
  },
  // Disable React StrictMode to prevent map double initialization in development
  reactStrictMode: false,

  // Performance optimizations
  compress: true,
  poweredByHeader: false,

  // Security and caching headers
  // Note: With output: 'export', these only apply during `next dev` / `next start`.
  // For static hosting, configure caching in your web server (nginx, Apache, etc.).
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production'
    return [
      // Static assets: aggressive caching in prod, no-cache in dev
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: isDev
              ? 'no-store, must-revalidate'
              : 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Next.js chunks: aggressive caching in prod (content-hashed), no-cache in dev
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: isDev
              ? 'no-store, must-revalidate'
              : 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Security headers for all routes
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },

  // Webpack optimizations - simplified for static export
  webpack: (config, { isServer }) => {
    // Exclude API files from static export
    config.module.rules.push({
      test: /\.ts$/,
      exclude: [/\/apps\/bakery-api\//, /\/libs\/api\//],
    })

    // Use Next.js default chunk optimization for static export
    // The complex splitChunks config was causing Html import issues

    return config
  },
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
}

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
  withBundleAnalyzer,
]

module.exports = composePlugins(...plugins)(nextConfig)
