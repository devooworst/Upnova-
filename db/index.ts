/* ------------------------------------------------------------------ */
/*  Database client — server-only singleton.                           */
/*  SQLite in dev; the same Drizzle schema targets Postgres in prod.   */
/*                                                                     */
/*  Self-initialization (the "Internal error on login" fix):           */
/*  better-sqlite3 silently creates an EMPTY file when the dev DB is   */
/*  missing (fresh clone / reset workspace), so every query used to    */
/*  die with "no such table: users" — masked as a generic 500. Now:    */
/*    1. missing schema  → apply db/bootstrap.sql (committed snapshot) */
/*    2. zero users      → run the demo seed (dev/demo only; disable   */
/*                         with UPNOVA_AUTOSEED=0 — a Postgres prod    */
/*                         deployment never hits this path at all)     */
/*  Nothing here bypasses authentication: it only guarantees the       */
/*  schema and seed accounts EXIST so real auth can run against them.  */
/* ------------------------------------------------------------------ */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readFileSync } from "fs";
import path from "path";
import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "db", "upnova.dev.db");

// survive Next.js hot-reload without leaking connections
const globalForDb = globalThis as unknown as { __upnovaDb?: ReturnType<typeof create> };

function create() {
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const hasSchema = sqlite
    .prepare("select name from sqlite_master where type='table' and name='users'")
    .get();
  if (!hasSchema) {
    console.warn(`[upnova] dev database missing at ${DB_PATH} — creating schema from db/bootstrap.sql`);
    sqlite.exec(readFileSync(path.join(process.cwd(), "db", "bootstrap.sql"), "utf8"));
  }

  if (process.env.UPNOVA_AUTOSEED !== "0") {
    const { c } = sqlite.prepare("select count(*) as c from users").get() as { c: number };
    if (c === 0) {
      console.warn("[upnova] empty database — seeding the demo world (set UPNOVA_AUTOSEED=0 to disable)");
      // lazy import: only ever loaded on the empty-DB path
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("./seed").seed();
    }
  }

  return drizzle(sqlite, { schema });
}

export const db = globalForDb.__upnovaDb ?? (globalForDb.__upnovaDb = create());
export * as tables from "./schema";
