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
/*                                                                     */
/*  Schema drift guard (the "no such column: affiliation" fix):        */
/*  preview instances restore OLDER db files than the code they run —  */
/*  a table can exist while missing columns the code queries, so the   */
/*  bootstrap path (which only fires when `users` is absent) never     */
/*  helps. On EVERY open we now diff the live schema against the       */
/*  committed db/bootstrap.sql snapshot and converge NON-DESTRUCTIVELY:*/
/*  missing tables are created, missing columns are ADDed (existing    */
/*  rows get the column's DEFAULT). Nothing is dropped, no data is     */
/*  rewritten, sessions are untouched. Dev/demo-only by nature — a     */
/*  production Postgres deployment uses real migrations instead.       */
/*                                                                     */
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

/* split a CREATE TABLE body on top-level commas (paren- and quote-aware) */
function splitColumns(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = "";
  for (const ch of body) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") quote = ch;
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function healSchemaDrift(sqlite: Database.Database) {
  let bootstrap: string;
  try {
    bootstrap = readFileSync(path.join(process.cwd(), "db", "bootstrap.sql"), "utf8");
  } catch {
    return; // no snapshot available — nothing to converge against
  }
  const statements = bootstrap
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));
  const tableStmts = statements.filter((s) => /^CREATE TABLE/i.test(s));
  const indexStmts = statements.filter((s) => /^CREATE (UNIQUE )?INDEX/i.test(s));

  // 1) missing TABLES — every snapshot statement is IF NOT EXISTS, so this
  //    is a no-op for tables that already exist (their data is untouched)
  for (const stmt of tableStmts) {
    try {
      sqlite.exec(stmt + ";");
    } catch (err) {
      console.warn("[upnova] drift guard: table statement failed:", (err as Error).message);
    }
  }

  // 2) missing COLUMNS — the actual "no such column: affiliation" case:
  //    the table predates a schema change. ALTER TABLE ADD COLUMN gives
  //    existing rows the column DEFAULT; if the exact definition can't be
  //    added (SQLite ALTER limits), degrade gracefully rather than fail.
  let healed = 0;
  for (const stmt of tableStmts) {
    const nameMatch = stmt.match(/CREATE TABLE IF NOT EXISTS\s+[`"]?([A-Za-z0-9_]+)[`"]?/i);
    if (!nameMatch) continue;
    const table = nameMatch[1];
    const open = stmt.indexOf("(");
    const close = stmt.lastIndexOf(")");
    if (open < 0 || close <= open) continue;
    const defs = splitColumns(stmt.slice(open + 1, close)).filter(
      (d) => !/^(FOREIGN KEY|PRIMARY KEY|UNIQUE|CHECK|CONSTRAINT)\b/i.test(d)
    );
    const existing = new Set(
      (sqlite.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map((c) => c.name)
    );
    for (const def of defs) {
      const col = def.split(/\s+/)[0].replace(/[`"]/g, "");
      if (existing.has(col)) continue;
      // ladder: exact definition → without NOT NULL → bare "name type"
      const bare = def
        .split(/\s+/)
        .slice(0, 2)
        .join(" ");
      const candidates = [def, def.replace(/\s+NOT NULL/gi, ""), bare];
      let added = false;
      for (const candidate of candidates) {
        try {
          sqlite.exec(`ALTER TABLE "${table}" ADD COLUMN ${candidate};`);
          added = true;
          break;
        } catch {
          /* try the next, simpler definition */
        }
      }
      if (added) {
        healed++;
        console.warn(`[upnova] drift guard: added missing column ${table}.${col}`);
      } else {
        console.warn(`[upnova] drift guard: could NOT add ${table}.${col} — queries on it will fail`);
      }
    }
  }

  // 3) missing INDEXES — after columns exist; IF NOT EXISTS makes this safe
  for (const stmt of indexStmts) {
    try {
      sqlite.exec(stmt + ";");
    } catch {
      /* an index on a column we couldn't add — already warned above */
    }
  }

  if (healed > 0) {
    console.warn(
      `[upnova] schema drift healed: ${healed} missing column(s) added from db/bootstrap.sql — no data was modified`
    );
  }
}

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

  // converge an OLDER db file to the schema this code expects (add-only)
  healSchemaDrift(sqlite);

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
