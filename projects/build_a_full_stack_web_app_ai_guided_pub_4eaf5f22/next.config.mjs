/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['music-metadata'],
  turbopack: {
    // root removed
  },
};

export default nextConfig;