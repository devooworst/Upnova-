import { execSync } from "child_process";

let buildCommit = "unknown";
try {
  buildCommit = execSync("git rev-parse --short HEAD", { cwd: process.cwd() }).toString().trim();
} catch {}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // inlined at BUILD time — the definitive answer to "which code is
    // actually serving me?" on /debug/session
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit,
  },
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
