/* ------------------------------------------------------------------ */
/*  Database client — server-only singleton.                           */
/*  SQLite in dev; the same Drizzle schema targets Postgres in prod.   */
/* ------------------------------------------------------------------ */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "db", "upnova.dev.db");

// survive Next.js hot-reload without leaking connections
const globalForDb = globalThis as unknown as { __upnovaDb?: ReturnType<typeof create> };

function create() {
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export const db = globalForDb.__upnovaDb ?? (globalForDb.__upnovaDb = create());
export * as tables from "./schema";
