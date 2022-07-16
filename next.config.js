let basePath = process.env.production == undefined ? '' : '/website' 

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  basePath: basePath
}

module.exports = nextConfig
