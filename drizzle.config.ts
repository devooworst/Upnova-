import { defineConfig } from "drizzle-kit";

/* DATABASE_URL=postgres://… → real Postgres (Neon). Otherwise drizzle-kit
   pushes into the local PGlite data directory (db/pgdata).
   DDL prefers Neon's UNPOOLED endpoint (the Vercel integration injects
   DATABASE_URL_UNPOOLED next to the pooled DATABASE_URL) — schema pushes
   through pgbouncer are unreliable. */
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  ...(url && /^postgres(ql)?:\/\//.test(url)
    ? { dbCredentials: { url } }
    : { driver: "pglite", dbCredentials: { url: "./db/pgdata" } }),
});
