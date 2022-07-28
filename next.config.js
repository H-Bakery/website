let basePath = process.env.production == undefined ? '' : '/website' 

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  basePath: basePath,
  webpack5: true,
}

module.exports = nextConfig
