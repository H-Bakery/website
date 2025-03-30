// let basePath = process.env.production == undefined ? '' : '/website'
const basePath = process.env.BASE_PATH ?? '' // get `basePath` for your use-case

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  reactStrictMode: false,
  output: 'export',
  env: {
    basePath,
  },
  transpilePackages: [
    '@fullcalendar/core',
    '@fullcalendar/react',
    '@fullcalendar/daygrid',
    '@fullcalendar/timegrid',
    '@fullcalendar/interaction',
    '@fullcalendar/resource-timegrid',
  ],
}

module.exports = nextConfig
