let basePath = process.env.production == undefined ? '' : '/website' 

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  basePath: basePath,
  webpack5: true,
}

module.exports = nextConfig
