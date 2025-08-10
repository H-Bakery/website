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

  // Configure headers for caching
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
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

  // Webpack optimizations
  webpack: (config, { isServer }) => {
    // Exclude API files from static export
    config.module.rules.push({
      test: /\.ts$/,
      exclude: [/\/apps\/bakery-api\//, /\/libs\/api\//],
    })

    // Optimize chunks
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            framework: {
              name: 'framework',
              chunks: 'all',
              test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
              priority: 40,
              enforce: true,
            },
            lib: {
              test: (module) => {
                return (
                  module.size &&
                  module.size() > 160000 &&
                  module.identifier &&
                  /node_modules[/\\]/.test(module.identifier())
                )
              },
              name: (module) => {
                if (module.identifier) {
                  const hash = require('crypto').createHash('sha1')
                  hash.update(module.identifier())
                  return hash.digest('hex').substring(0, 8)
                }
                return 'lib'
              },
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            commons: {
              name: 'commons',
              chunks: 'all',
              minChunks: 2,
              priority: 20,
            },
            shared: {
              name: (module, chunks) => {
                if (chunks && chunks.length > 0) {
                  return `shared-${require('crypto')
                    .createHash('sha1')
                    .update(chunks.reduce((acc, chunk) => acc + chunk.name, ''))
                    .digest('hex')
                    .substring(0, 8)}`
                }
                return 'shared'
              },
              priority: 10,
              minChunks: 2,
              reuseExistingChunk: true,
            },
          },
          maxAsyncRequests: 25,
          maxInitialRequests: 25,
        },
      }
    }

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
