/* ------------------------------------------------------------------ */
/* Conversation resolution by PARTICIPANT IDS — the single source of   */
/* truth for "which thread does this transaction belong to".           */
/* Person → conversation is derived from stable user ids, never from   */
/* display names, array positions, or client-provided values.          */
/* ------------------------------------------------------------------ */

import { randomBytes } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";

/**
 * Returns the id of the 1:1 conversation between exactly `userA` and
 * `userB`, creating it if it doesn't exist yet.
 *
 * `provided` (e.g. a conversationId sent by a client) is used ONLY if it
 * really is the 1:1 conversation between these two people — anything
 * else (stale id, someone else's thread) is ignored and the correct
 * conversation is resolved from the ids instead.
 */
export function resolvePairConversation(userA: string, userB: string, provided?: string | null): string {
  if (provided) {
    const members = db
      .select()
      .from(tables.conversationMembers)
      .where(eq(tables.conversationMembers.conversationId, provided))
      .all();
    const ids = new Set(members.map((m) => m.userId));
    if (members.length === 2 && ids.has(userA) && ids.has(userB)) return provided;
  }

  const mine = db
    .select()
    .from(tables.conversationMembers)
    .where(eq(tables.conversationMembers.userId, userA))
    .all()
    .map((m) => m.conversationId);
  if (mine.length) {
    const memberRows = db
      .select()
      .from(tables.conversationMembers)
      .where(inArray(tables.conversationMembers.conversationId, mine))
      .all();
    const byConv = new Map<string, string[]>();
    for (const m of memberRows) {
      const arr = byConv.get(m.conversationId) ?? [];
      arr.push(m.userId);
      byConv.set(m.conversationId, arr);
    }
    for (const [cid, ids] of Array.from(byConv.entries())) {
      if (ids.length === 2 && ids.includes(userB)) return cid;
    }
  }

  const cid = randomBytes(12).toString("hex");
  db.insert(tables.conversations).values({ id: cid }).run();
  db.insert(tables.conversationMembers)
    .values([
      { conversationId: cid, userId: userA },
      { conversationId: cid, userId: userB },
    ])
    .run();
  return cid;
}
