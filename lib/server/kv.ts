/* ------------------------------------------------------------------ */
/*  kv_state — tiny server-side key/value store in Postgres.           */
/*  Replaces every "small JSON file on disk" pattern from the SQLite   */
/*  era: Vercel's filesystem is read-only and per-instance, so any     */
/*  cross-request state MUST live in the database.                     */
/* ------------------------------------------------------------------ */

import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

export async function kvGet(key: string): Promise<string | null> {
  try {
    const row = await db.select().from(tables.kvState).where(eq(tables.kvState.key, key)).get();
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  const existing = await db.select().from(tables.kvState).where(eq(tables.kvState.key, key)).get();
  if (existing) await db.update(tables.kvState).set({ value, updatedAt: new Date() }).where(eq(tables.kvState.key, key)).run();
  else await db.insert(tables.kvState).values({ key, value }).run();
}

export async function kvDelete(key: string): Promise<void> {
  await db.delete(tables.kvState).where(eq(tables.kvState.key, key)).run();
}

export async function kvGetJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await kvGet(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function kvSetJson(key: string, value: unknown): Promise<void> {
  await kvSet(key, JSON.stringify(value));
}
