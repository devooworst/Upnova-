/* Regenerates db/bootstrap.sql — the schema snapshot db/index.ts applies
   when the dev database file is missing. Run after any schema change:
   npm run db:push && npm run db:bootstrap */
import Database from "better-sqlite3";
import { writeFileSync } from "fs";

const db = new Database("db/upnova.dev.db");
const rows = db
  .prepare(
    "select type, name, sql from sqlite_master where sql is not null and name not like 'sqlite_%' order by case type when 'table' then 0 else 1 end, name"
  )
  .all();
const out = rows
  .map(
    (r) =>
      r.sql
        .replace(/^CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS ")
        .replace(/^CREATE INDEX /i, "CREATE INDEX IF NOT EXISTS ")
        .replace(/^CREATE UNIQUE INDEX /i, "CREATE UNIQUE INDEX IF NOT EXISTS ") + ";"
  )
  .join("\n");
writeFileSync(
  "db/bootstrap.sql",
  "-- Auto-generated schema snapshot for dev self-initialization.\n" +
    "-- Regenerate after schema changes: npm run db:bootstrap\n" +
    "-- Applied by db/index.ts ONLY when the users table is missing.\n" +
    out +
    "\n"
);
console.log("db/bootstrap.sql updated —", rows.length, "objects");
