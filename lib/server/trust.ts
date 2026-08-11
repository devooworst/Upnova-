/* ------------------------------------------------------------------ */
/*  Trust & Authenticity — SERVER half.                                */
/*                                                                     */
/*  · A "Verified Work" chip exists ONLY when this module validated    */
/*    the link between a post and a completed Mavyn transaction the   */
/*    poster actually participated in. The client sends ids; the       */
/*    server decides what's verified.                                  */
/*  · "Client Confirmed" is set only by the linked counterparty.       */
/*  · Risk signals on reports are ADVISORY context for a human         */
/*    moderator. Automated similarity/heuristics are never proof and   */
/*    never trigger automatic action against a creator.                */
/* ------------------------------------------------------------------ */

import { createHash } from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { ApiError } from "@/lib/server/auth";
import type { PostTrust, DisclosureType } from "@/lib/trust";

/** Transaction states that count as "completed" for Verified Work. */
const DONE_PROJECT_STATES = ["approved", "completed", "reviewed"];
const DONE_BOOKING_STATES = ["completed"];

export interface WorkLink {
  kind: "project" | "booking";
  id: string;
  title: string;
  counterpartyId: string;
}

/**
 * Validate a post's claimed link to a completed transaction.
 * Throws unless the transaction exists, is completed, and the poster
 * was a participant. Returns the counterparty (the future confirmer).
 */
export function validateWorkLink(userId: string, projectId?: string | null, bookingId?: string | null): WorkLink | null {
  if (projectId) {
    const p = db.select().from(tables.projects).where(eq(tables.projects.id, projectId)).get();
    if (!p) throw new ApiError(404, "Linked project not found");
    if (p.creatorId !== userId && p.clientId !== userId)
      throw new ApiError(403, "You can only link work from your own projects");
    if (!DONE_PROJECT_STATES.includes(p.state))
      throw new ApiError(409, "Only completed projects can back Verified Work");
    return { kind: "project", id: p.id, title: p.title, counterpartyId: p.creatorId === userId ? p.clientId : p.creatorId };
  }
  if (bookingId) {
    const b = db.select().from(tables.bookings).where(eq(tables.bookings.id, bookingId)).get();
    if (!b) throw new ApiError(404, "Linked booking not found");
    if (b.providerId !== userId && b.clientId !== userId)
      throw new ApiError(403, "You can only link work from your own bookings");
    if (!DONE_BOOKING_STATES.includes(b.status))
      throw new ApiError(409, "Only completed bookings can back Verified Work");
    return { kind: "booking", id: b.id, title: b.title, counterpartyId: b.providerId === userId ? b.clientId : b.providerId };
  }
  return null;
}

type PostRow = typeof tables.posts.$inferSelect;

/**
 * Bulk trust serialization for feed / profile grids — one pass, no N+1.
 * Recomputes the link validity at read time so a project that somehow
 * regressed never keeps a stale chip.
 */
export function postTrustMap(posts: PostRow[], viewerId?: string | null): Map<string, PostTrust> {
  const projIds = Array.from(new Set(posts.map((p) => p.projectId).filter(Boolean))) as string[];
  const bookIds = Array.from(new Set(posts.map((p) => p.bookingId).filter(Boolean))) as string[];
  const projects = projIds.length
    ? db.select().from(tables.projects).where(inArray(tables.projects.id, projIds)).all()
    : [];
  const bookings = bookIds.length
    ? db.select().from(tables.bookings).where(inArray(tables.bookings.id, bookIds)).all()
    : [];
  const partyIds = new Set<string>();
  for (const p of projects) {
    partyIds.add(p.clientId);
    partyIds.add(p.creatorId);
  }
  for (const b of bookings) {
    partyIds.add(b.clientId);
    partyIds.add(b.providerId);
  }
  const names = new Map(
    (partyIds.size
      ? db.select().from(tables.profiles).where(inArray(tables.profiles.userId, Array.from(partyIds))).all()
      : []
    ).map((pr) => [pr.userId, pr.displayName])
  );

  const out = new Map<string, PostTrust>();
  for (const post of posts) {
    let verifiedWork: PostTrust["verifiedWork"] = null;
    let counterpartyId: string | null = null;
    if (post.projectId) {
      const p = projects.find((x) => x.id === post.projectId);
      if (p && DONE_PROJECT_STATES.includes(p.state) && (p.creatorId === post.authorId || p.clientId === post.authorId)) {
        counterpartyId = p.creatorId === post.authorId ? p.clientId : p.creatorId;
        verifiedWork = { kind: "project", title: p.title, with: names.get(counterpartyId) ?? "client" };
      }
    } else if (post.bookingId) {
      const b = bookings.find((x) => x.id === post.bookingId);
      if (b && DONE_BOOKING_STATES.includes(b.status) && (b.providerId === post.authorId || b.clientId === post.authorId)) {
        counterpartyId = b.providerId === post.authorId ? b.clientId : b.providerId;
        verifiedWork = { kind: "booking", title: b.title, with: names.get(counterpartyId) ?? "client" };
      }
    }
    out.set(post.id, {
      verifiedWork,
      clientConfirmed: !!verifiedWork && post.clientConfirmed,
      attested: post.attested,
      disclosure: (post.disclosure as DisclosureType) || "unspecified",
      credit: post.credit,
      canConfirm: !!verifiedWork && !post.clientConfirmed && !!viewerId && viewerId === counterpartyId,
    });
  }
  return out;
}

/* ----------------------------- risk signals ----------------------------- */

/**
 * Advisory context computed when a report is filed. These are SIGNALS for
 * the human moderator — similarity and heuristics are never proof that
 * work was stolen, and they never trigger automatic action.
 */
export function computeRiskSignals(targetType: string, targetId: string): string[] {
  const signals: string[] = [];
  try {
    if (targetType === "post") {
      const post = db.select().from(tables.posts).where(eq(tables.posts.id, targetId)).get();
      if (!post) return signals;

      // exact duplicate media across different authors (hash match only —
      // says "same file appears twice", not "who made it first is wrong")
      if (post.imageUrl) {
        const hash = createHash("sha256").update(post.imageUrl).digest("hex");
        const dupes = db
          .select()
          .from(tables.posts)
          .all()
          .filter(
            (p) =>
              p.id !== post.id &&
              p.authorId !== post.authorId &&
              p.imageUrl &&
              createHash("sha256").update(p.imageUrl).digest("hex") === hash
          );
        if (dupes.length)
          signals.push(`Identical image file appears in ${dupes.length} post(s) by other account(s) — advisory, not proof of origin`);
      }

      // account age — young accounts posting claimed work is context, not guilt
      const author = db.select().from(tables.users).where(eq(tables.users.id, post.authorId)).get();
      if (author) {
        const days = (Date.now() - author.createdAt.getTime()) / 86400_000;
        if (days < 7) signals.push(`Author account is ${Math.max(1, Math.round(days))} day(s) old`);
        // prior open/reviewing reports against the same author's content
        const prior = db
          .select()
          .from(tables.reports)
          .all()
          .filter((r) => ["open", "reviewing"].includes(r.status) && r.targetType === "user" && r.targetId === author.id).length;
        if (prior) signals.push(`${prior} other unresolved report(s) reference this account`);
      }

      // unverified claims on the post itself — context only
      if (post.attested && !post.projectId && !post.bookingId)
        signals.push("Post carries a creator attestation with no linked Mavyn transaction (attestations are claims, not verification)");
    }
  } catch {
    /* signals are best-effort — a failure here must never block a report */
  }
  return signals;
}
