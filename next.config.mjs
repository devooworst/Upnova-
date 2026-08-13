import { execSync } from "child_process";

let buildCommit = "unknown";
if (process.env.VERCEL_GIT_COMMIT_SHA) {
  // Vercel build containers may not carry .git — the platform provides the SHA
  buildCommit = process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
} else {
  try {
    buildCommit = execSync("git rev-parse --short HEAD", { cwd: process.cwd() }).toString().trim();
  } catch {}
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // inlined at BUILD time — the definitive answer to "which code is
    // actually serving me?" on /debug/session
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit,
  },
  reactStrictMode: true,
  // Uploaded images live on Vercel Blob in production — absolute URLs on
  // the store's subdomain. next/image REJECTS remote hostnames that
  // aren't allow-listed (the optimizer 400s, <img> onError fires, and
  // avatars silently fall back to initials — "my photo didn't save").
  // Local disk uploads are relative /uploads/… paths and need no entry.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  // demo: HTML must never be cached by browsers/proxies — a stale login
  // page from a previous build caused ghost bugs. Hashed static assets
  // keep their own immutable caching.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          // security hardening — additive, never behavior-changing.
          // (No frame-blocking headers: the app legitimately runs embedded.)
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=()" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
  experimental: {
    // native/wasm database drivers must stay external to the server
    // bundle: better-sqlite3 (geo.db reference data), PGlite (local
    // Postgres — wasm + data assets break when webpack inlines them),
    // and the Neon serverless driver (kept external for parity).
    serverComponentsExternalPackages: ["better-sqlite3", "@electric-sql/pglite", "@neondatabase/serverless"],
    // local PGlite is single-connection: parallel static-export workers
    // would each open db/pgdata and abort. One worker locally; Vercel
    // (DATABASE_URL = Neon over HTTP) parallelizes freely.
    ...(process.env.DATABASE_URL ? {} : { cpus: 1 }),
  },
};

export default nextConfig;
