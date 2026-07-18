/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['music-metadata'],
  async redirects() {
    return [
      // Legacy citizen paths → /user/*
      {
        source: '/chat',
        destination: '/user/chat',
        permanent: false,
      },
      {
        source: '/checklist',
        destination: '/user/checklist',
        permanent: false,
      },
      {
        source: '/result',
        destination: '/user/result',
        permanent: false,
      },
      {
        source: '/form/:applicationId',
        destination: '/user/form/:applicationId',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
