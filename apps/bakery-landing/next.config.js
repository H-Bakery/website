//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next')

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Exclude API files from static export
  webpack: (config) => {
    config.module.rules.push({
      test: /\.ts$/,
      exclude: [
        /\/apps\/bakery-api\//,
        /\/libs\/api\//,
      ],
    });
    return config;
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
