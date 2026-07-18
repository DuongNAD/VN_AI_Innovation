/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['music-metadata'],
  // Pin the workspace root to this app so Turbopack ignores stray lockfiles
  // higher up the repo. import.meta.dirname keeps it portable across machines
  // (the previous hardcoded d:/ path only worked on one Windows machine).
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
