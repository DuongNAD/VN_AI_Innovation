/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['music-metadata'],
  // Hide the floating "N" Next.js dev-tools badge in `next dev`
  devIndicators: false,
  // Pin the workspace root to this app so Turbopack ignores stray lockfiles
  // higher up the repo. import.meta.dirname keeps it portable across machines
  // (the previous hardcoded d:/ path only worked on one Windows machine).
  turbopack: {
    root: import.meta.dirname,
  },
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
