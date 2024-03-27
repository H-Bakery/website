// let basePath = process.env.production == undefined ? '' : '/website'
const basePath = process.env.BASE_PATH ?? '' // get `basePath` for your use-case

const withTM = require('next-transpile-modules')([
  '@fullcalendar/common',
  '@fullcalendar/daygrid',
  '@fullcalendar/timegrid',
  '@fullcalendar/interaction',
  '@fullcalendar/react',
])

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath,
  reactStrictMode: false,
  swcMinify: true,
  output: 'export',
  env: {
    basePath,
  },
}

module.exports = withTM(nextConfig)
