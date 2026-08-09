/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // demo: HTML must never be cached by browsers/proxies — a stale login
  // page from a previous build caused ghost bugs. Hashed static assets
  // keep their own immutable caching.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
  experimental: {
    // native sqlite driver must stay external to the server bundle
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
