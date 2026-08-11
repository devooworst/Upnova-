import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser, guarded } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  GET /api/search?q=…  — Mavyn global search.                       */
/*                                                                     */
/*  PEOPLE search the real users+profiles tables — every registered    */
/*  account, nothing hardcoded: new signups are searchable the moment  */
/*  the row exists. Matching: @handle and display name, exact and      */
/*  partial, case-insensitive. Ranking: exact handle → handle prefix   */
/*  → name prefix → contains.                                          */
/*                                                                     */
/*  Rules respected (never invented): suspended accounts excluded,     */
/*  non-public profiles excluded, blocks excluded in BOTH directions.  */
/*  Following is NEVER required — any account can find any account.    */
/*                                                                     */
/*  Also searches opportunities, services, communities, and posts so   */
/*  the results page has real sections — same visibility rules the     */
/*  product already enforces (open opps, public active services…).    */
/* ------------------------------------------------------------------ */

const norm = (s: string) => s.toLowerCase().normalize("NFKD");

/** 0 = exact handle · 1 = handle prefix · 2 = name prefix · 3 = handle
    contains · 4 = name contains · 9 = no match */
function personRank(q: string, handle: string, name: string): number {
  const h = norm(handle);
  const n = norm(name);
  if (h === q) return 0;
  if (h.startsWith(q)) return 1;
  if (n.startsWith(q) || n.split(/\s+/).some((w) => w.startsWith(q))) return 2;
  if (h.includes(q)) return 3;
  if (n.includes(q)) return 4;
  return 9;
}

export async function GET(req: NextRequest) {
  return guarded(() => {
    const viewer = getSessionUser(); // guests can search public data too
    const q = norm(String(req.nextUrl.searchParams.get("q") ?? "").trim()).slice(0, 80);
    const full = req.nextUrl.searchParams.get("full") === "1";
    const perSection = full ? 20 : 5;
    if (q.length < 1)
      return { q: "", people: [], opportunities: [], services: [], communities: [], posts: [] };

    /* ---------------- blocks: invisible in BOTH directions ---------------- */
    const blockedPair = new Set<string>();
    if (viewer) {
      for (const b of db.select().from(tables.blocks).all()) {
        if (b.blockerId === viewer.id) blockedPair.add(b.blockedId);
        if (b.blockedId === viewer.id) blockedPair.add(b.blockerId);
      }
    }

    /* ------------------------------ PEOPLE ------------------------------ */
    const userRows = db
      .select({ user: tables.users, profile: tables.profiles })
      .from(tables.users)
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .all()
      .filter(
        (r) =>
          r.user.status === "active" && // suspended never appear
          r.profile.visibility === "public" && // hidden profiles respected
          !blockedPair.has(r.user.id)
      );

    const verifiedCampus = new Map<string, string>(); // userId -> campus name (opt-in only)
    {
      const campuses = new Map(db.select().from(tables.campuses).all().map((c) => [c.id, c.name]));
      for (const v of db.select().from(tables.campusVerifications).all())
        if (v.status === "verified" && v.showSchool) verifiedCampus.set(v.userId, campuses.get(v.campusId) ?? "");
    }

    const people = userRows
      .map((r) => ({ r, rank: personRank(q, r.user.handle, r.profile.displayName) }))
      .filter((x) => x.rank < 9)
      .sort((a, b) => a.rank - b.rank || a.r.user.handle.localeCompare(b.r.user.handle))
      .slice(0, perSection)
      .map(({ r }) => {
        let roles: string[] = [];
        try {
          roles = JSON.parse(r.profile.additionalRoles || "[]");
        } catch {}
        const roleLine = [r.profile.primaryRole, ...roles].filter(Boolean).slice(0, 3).join(" · ");
        return {
          id: r.user.id,
          handle: r.user.handle,
          displayName: r.profile.displayName,
          avatarUrl: r.profile.avatarUrl,
          roleLine,
          verified: !!r.profile.verified,
          business: r.user.accountType === "business",
          campus: verifiedCampus.get(r.user.id) ?? null, // student/alumni indicator (opt-in)
        };
      });

    /* --------------------------- OPPORTUNITIES --------------------------- */
    const opportunities = db
      .select()
      .from(tables.opportunities)
      .all()
      .filter((o) => o.status === "open" && (norm(o.title).includes(q) || norm(o.description).includes(q)))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, perSection)
      .map((o) => ({ id: o.id, title: o.title, type: o.type, location: o.remote ? "Remote" : o.location, budget: o.budget }));

    /* ------------------------------ SERVICES ------------------------------ */
    const services = db
      .select()
      .from(tables.services)
      .all()
      .filter(
        (s) =>
          s.active &&
          s.visibility === "public" &&
          !blockedPair.has(s.ownerId) &&
          (norm(s.title).includes(q) || norm(s.description).includes(q) || norm(s.category).includes(q))
      )
      .slice(0, perSection)
      .map((s) => {
        const owner = db.select().from(tables.profiles).where(eq(tables.profiles.userId, s.ownerId)).get();
        return { id: s.id, title: s.title, price: s.price, category: s.category, owner: owner?.displayName ?? "" };
      });

    /* ----------------------------- COMMUNITIES ----------------------------- */
    const communities = db
      .select()
      .from(tables.communities)
      .all()
      .filter((c) => norm(c.name).includes(q) || norm(c.description).includes(q))
      .slice(0, perSection)
      .map((c) => ({ id: c.id, slug: c.slug, name: c.name, description: c.description.slice(0, 90) }));

    /* -------------------------------- POSTS -------------------------------- */
    const posts = db
      .select()
      .from(tables.posts)
      .all()
      .filter((p) => !blockedPair.has(p.authorId) && norm(p.body).includes(q))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, perSection)
      .map((p) => {
        const author = db.select().from(tables.profiles).where(eq(tables.profiles.userId, p.authorId)).get();
        const authorUser = db.select().from(tables.users).where(eq(tables.users.id, p.authorId)).get();
        return {
          id: p.id,
          body: p.body.slice(0, 140),
          author: author?.displayName ?? "",
          authorHandle: authorUser?.handle ?? "",
          at: p.createdAt.toISOString(),
        };
      })
      .filter((p) => p.authorHandle); // drop orphans

    return { q, people, opportunities, services, communities, posts };
  });
}
