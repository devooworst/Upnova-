/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // native sqlite driver must stay external to the server bundle
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
