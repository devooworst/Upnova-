/* ------------------------------------------------------------------ */
/*  Communities — membership, identity masking, reveals, moderation.   */
/*                                                                     */
/*  THE ONLY SERIALIZER for community content lives here. When a post  */
/*  or comment was written under an alias or anonymously, the author's */
/*  userId NEVER leaves the server: not in API responses, URLs,        */
/*  metadata, or notifications. Actions that need the author (reveal   */
/*  requests, blocks, reports, moderation) reference the CONTENT id    */
/*  and the server resolves the account internally.                    */
/*                                                                     */
/*  Mavyn retains the underlying account identity on every row for    */
/*  moderation, safety, abuse prevention, and legal compliance —       */
/*  anonymous to the crowd, accountable to the platform.               */
/* ------------------------------------------------------------------ */

import { randomBytes } from "crypto";
import { and, desc, eq, gt, inArray, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { ApiError } from "@/lib/server/auth";
import { ALIAS_RE, ANON_LIMITS, anonLabel, communityRefMeta, type IdentityMode } from "@/lib/communityIdentity";

const id = () => randomBytes(12).toString("hex");
const parse = (s: string | null | undefined): string[] => {
  try {
    return JSON.parse(s || "[]");
  } catch {
    return [];
  }
};

type Community = typeof tables.communities.$inferSelect;
type Membership = typeof tables.communityMembers.$inferSelect;

/* ------------------------------ lookup ------------------------------ */

export function findCommunity(idOrSlug: string): Promise<Community | undefined> {
  return db
    .select()
    .from(tables.communities)
    .where(or(eq(tables.communities.id, idOrSlug), eq(tables.communities.slug, idOrSlug)))
    .get();
}

export function getMembership(communityId: string, userId: string): Promise<Membership | undefined> {
  return db
    .select()
    .from(tables.communityMembers)
    .where(and(eq(tables.communityMembers.communityId, communityId), eq(tables.communityMembers.userId, userId)))
    .get();
}

export async function requireActiveMember(communityId: string, userId: string): Promise<Membership> {
  const c = await db.select().from(tables.communities).where(eq(tables.communities.id, communityId)).get();
  let m = await getMembership(communityId, userId);
  if (c && m) m = await refreshMembership(c, m);
  if (!m || m.status !== "active")
    throw new ApiError(
      403,
      (await m)?.status === "inactive"
        ? "Your membership expired — renew it to regain access. Your history is intact."
        : "You need to be a member of this community first"
    );
  return m;
}

/* --------------------- paid membership lifecycle --------------------- */

export function communityPeriodDays(c: Community): number {
  if (c.billingPeriod === "weekly") return 7;
  if (c.billingPeriod === "yearly") return 365;
  if (c.billingPeriod === "custom") return Math.max(1, c.customPeriodDays ?? 30);
  return 30;
}

/** Lazy membership state machine, run on every read that matters.
 *  Paid membership past its date: 3-days-out reminder → expiry +
 *  grace-period notice (access continues) → INACTIVE after grace.
 *  Nothing is deleted — history and the membership row stay; renewal
 *  reactivates. */
export async function refreshMembership(c: Community, m: Membership): Promise<Membership> {
  if (!c.price || c.price <= 0 || !m.memberUntil || m.status !== "active") return m;
  const now = Date.now();
  const until = new Date(m.memberUntil).getTime();
  const graceMs = (c.graceDays ?? 3) * 86_400_000;
  const where = and(eq(tables.communityMembers.communityId, c.id), eq(tables.communityMembers.userId, m.userId));
  const fmt = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (until - now < 3 * 86_400_000 && until > now && !m.expiryNotified) {
    await db.update(tables.communityMembers).set({ expiryNotified: true }).where(where).run();
    await notifyMember(m.userId, `Your ${c.name} membership renews soon`, `It runs through ${fmt(until)} — renew any time to keep access.`, c.slug);
    m = { ...m, expiryNotified: true };
  }
  if (until <= now && now < until + graceMs && !m.graceNotified) {
    await db.update(tables.communityMembers).set({ graceNotified: true }).where(where).run();
    await notifyMember(m.userId, `Payment due — ${c.name}`, `Your membership lapsed on ${fmt(until)}. You have a ${c.graceDays}-day grace period before access pauses. Renew to keep it.`, c.slug);
    m = { ...m, graceNotified: true };
  }
  if (now >= until + graceMs) {
    await db.update(tables.communityMembers).set({ status: "inactive" }).where(where).run();
    await notifyMember(m.userId, `Membership paused — ${c.name}`, "Access to member content is paused until you renew. Your posts and history are untouched.", c.slug);
    m = { ...m, status: "inactive" };
  }
  return m;
}

async function notifyMember(userId: string, title: string, body: string, slug: string) {
  // local import to avoid a cycle
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { notify } = require("./notify") as typeof import("./notify");
  await notify({ userId, type: "community", title, body, href: `/communities/${slug}` });
}

export async function activeMemberCount(communityId: string): Promise<number> {
  return (await db
    .select({ s: tables.communityMembers.status })
    .from(tables.communityMembers)
    .where(eq(tables.communityMembers.communityId, communityId))
    .all())
    .filter((m) => m.s === "active").length;
}

/** Displayable state incl. the derived grace phase. */
export function membershipState(c: Community, m: Membership): string {
  if (m.status === "active" && c.price > 0 && m.memberUntil) {
    const until = new Date(m.memberUntil).getTime();
    if (Date.now() > until) return "grace";
  }
  return m.status;
}

export const isMod = (m?: Membership | null) => !!m && m.status === "active" && (m.role === "owner" || m.role === "moderator");

/* --------------------------- anon codes --------------------------- */

/** Stable per-community anonymous code. Random — no cross-community correlation. */
export async function ensureAnonCode(communityId: string, userId: string): Promise<string> {
  const m = await getMembership(communityId, userId);
  if (m?.anonCode) return m.anonCode;
  const taken = new Set(
    (await db
      .select({ c: tables.communityMembers.anonCode })
      .from(tables.communityMembers)
      .where(eq(tables.communityMembers.communityId, communityId))
      .all())
      .map((r) => r.c)
      .filter(Boolean) as string[]
  );
  let code = "";
  for (let i = 0; i < 50; i++) {
    code = String(100 + Math.floor(Math.random() * 900));
    if (!taken.has(code)) break;
  }
  await db.update(tables.communityMembers)
    .set({ anonCode: code })
    .where(and(eq(tables.communityMembers.communityId, communityId), eq(tables.communityMembers.userId, userId)))
    .run();
  return code;
}

/* ------------------------- identity checks ------------------------- */

export async function validateIdentityChoice(
  community: Community,
  membership: Membership,
  identity: string,
  aliasInput?: string
): Promise<{ identity: IdentityMode; alias: string | null }> {
  const allowed = parse(community.identityModes);
  if (!["real", "alias", "anonymous"].includes(identity)) throw new ApiError(400, "Unknown identity mode");
  if (!allowed.includes(identity))
    throw new ApiError(400, `This community allows: ${allowed.join(", ")} — "${identity}" isn't permitted here`);

  let alias = membership.alias;
  if (identity === "alias") {
    const wanted = (aliasInput || alias || "").trim();
    if (!wanted) throw new ApiError(400, "Pick an alias first — it stays yours in this community");
    if (wanted !== alias) {
      await setAlias(community.id, membership.userId, wanted);
      alias = wanted;
    }
  }
  return { identity: identity as IdentityMode, alias };
}

/** Community-specific alias with anti-impersonation: may not collide with any
    user's handle/display name or another member's alias in this community. */
export async function setAlias(communityId: string, userId: string, alias: string) {
  if (!ALIAS_RE.test(alias)) throw new ApiError(400, "Alias must be 3–24 characters: letters, numbers, spaces, _ . -");
  const lower = alias.toLowerCase();
  if (lower === "anonymous" || lower.startsWith("anonymous")) throw new ApiError(400, "That alias is reserved");

  // impersonation guard — no taking another person's handle or display name
  const users = await db
    .select({ id: tables.users.id, handle: tables.users.handle, name: tables.profiles.displayName })
    .from(tables.users)
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
    .all();
  const clash = users.find((u) => u.id !== userId && (u.handle.toLowerCase() === lower || u.name.toLowerCase() === lower));
  if (clash) throw new ApiError(400, "That alias matches another member's name — pick something that isn't impersonating anyone");

  const aliasTaken = (await db
    .select({ userId: tables.communityMembers.userId, alias: tables.communityMembers.alias })
    .from(tables.communityMembers)
    .where(eq(tables.communityMembers.communityId, communityId))
    .all())
    .find((m) => m.userId !== userId && (m.alias || "").toLowerCase() === lower);
  if (aliasTaken) throw new ApiError(400, "That alias is already in use in this community");

  await db.update(tables.communityMembers)
    .set({ alias })
    .where(and(eq(tables.communityMembers.communityId, communityId), eq(tables.communityMembers.userId, userId)))
    .run();
}

/** Anti-abuse allowance for anonymous posting. Advisory limits, hard-enforced:
    young accounts get a small daily cap until they've existed for a while. */
export async function assertAnonAllowance(userId: string) {
  const user = await db.select().from(tables.users).where(eq(tables.users.id, userId)).get();
  if (!user) throw new ApiError(401, "Sign in first");
  const ageH = (Date.now() - new Date(user.createdAt).getTime()) / 3_600_000;
  const cap = ageH < ANON_LIMITS.newAccountAgeH ? ANON_LIMITS.newAccountPerDay : ANON_LIMITS.standardPerDay;
  const since = new Date(Date.now() - 86_400_000);
  const posts = (
      await db
      .select({ id: tables.communityPosts.id })
      .from(tables.communityPosts)
      .where(and(eq(tables.communityPosts.authorId, userId), eq(tables.communityPosts.identity, "anonymous"), gt(tables.communityPosts.createdAt, since)))
        .all()
    ).length;
  const comments = (
      await db
      .select({ id: tables.communityComments.id })
      .from(tables.communityComments)
      .where(and(eq(tables.communityComments.authorId, userId), eq(tables.communityComments.identity, "anonymous"), gt(tables.communityComments.createdAt, since)))
        .all()
    ).length;
  if (posts + comments >= cap)
    throw new ApiError(
      429,
      ageH < ANON_LIMITS.newAccountAgeH
        ? `New accounts can post anonymously ${cap} times per day while they're getting established — try again tomorrow or post with your profile or an alias`
        : `Anonymous posting is limited to ${cap} per day to prevent abuse`
    );
}

/* ------------------------------ blocks ------------------------------ */

export async function blockedEitherWay(a: string, b: string): Promise<boolean> {
  return !!(await db
    .select({ id: tables.blocks.id })
    .from(tables.blocks)
    .where(
      or(
        and(eq(tables.blocks.blockerId, a), eq(tables.blocks.blockedId, b)),
        and(eq(tables.blocks.blockerId, b), eq(tables.blocks.blockedId, a))
      )
    )
    .get());
}

export async function viewerBlockSet(viewerId: string | null): Promise<Set<string>> {
  if (!viewerId) return new Set();
  return new Set(
    (await db
      .select({ blockedId: tables.blocks.blockedId })
      .from(tables.blocks)
      .where(eq(tables.blocks.blockerId, viewerId))
      .all())
      .map((r) => r.blockedId)
  );
}

/* ------------------------------ reveals ------------------------------ */

export function revealBetween(a: string, b: string) {
  return db
    .select()
    .from(tables.identityReveals)
    .where(
      or(
        and(eq(tables.identityReveals.requesterId, a), eq(tables.identityReveals.targetId, b)),
        and(eq(tables.identityReveals.requesterId, b), eq(tables.identityReveals.targetId, a))
      )
    )
    .get();
}

/** userIds the viewer has a MUTUALLY ACCEPTED reveal with. */
export async function acceptedRevealSet(viewerId: string | null): Promise<Set<string>> {
  if (!viewerId) return new Set();
  const rows = await db
    .select()
    .from(tables.identityReveals)
    .where(
      and(
        eq(tables.identityReveals.status, "accepted"),
        or(eq(tables.identityReveals.requesterId, viewerId), eq(tables.identityReveals.targetId, viewerId))
      )
    )
    .all();
  return new Set(rows.map((r) => (r.requesterId === viewerId ? r.targetId : r.requesterId)));
}

export async function mutualFollowSet(viewerId: string | null): Promise<Set<string>> {
  if (!viewerId) return new Set();
  const iFollow = new Set(
    (await db.select({ id: tables.follows.followingId }).from(tables.follows).where(eq(tables.follows.followerId, viewerId)).all()).map((r) => r.id)
  );
  const followMe = (await db
    .select({ id: tables.follows.followerId })
    .from(tables.follows)
    .where(eq(tables.follows.followingId, viewerId))
    .all())
    .map((r) => r.id);
  return new Set(followMe.filter((f) => iFollow.has(f)));
}

/* --------------------------- author masking --------------------------- */

export type AuthorCtx = {
  viewerId: string | null;
  /** authorId -> { user, profile, membership } — preloaded by the route */
  authors: Map<string, { handle: string; displayName: string; avatarUrl: string | null; verified: boolean; revealIdentityMode: string; membership?: Membership | null }>;
  accepted: Set<string>; // accepted reveals with viewer
  mutuals: Set<string>; // mutual follows with viewer
};

/** The one place a community author becomes a public shape. Masked authors
    carry NO userId. `knownAs` appears only for a viewer who has a mutual
    reveal AND the author's own privacy setting permits it — a private
    annotation, never shown to the rest of the community. */
export function maskAuthor(authorId: string, identity: string, ctx: AuthorCtx) {
  const a = ctx.authors.get(authorId);
  const isYou = ctx.viewerId === authorId;

  if (identity === "real") {
    return {
      kind: "real" as const,
      isYou,
      user: a
        ? { id: authorId, handle: a.handle, displayName: a.displayName, avatarUrl: a.avatarUrl, verified: a.verified }
        : null,
    };
  }

  const label =
    identity === "alias"
      ? a?.membership?.alias || "Member"
      : anonLabel(a?.membership?.anonCode || "•••");

  // private reveal annotation — governed by the AUTHOR's setting
  let knownAs: { handle: string; displayName: string; avatarUrl: string | null } | null = null;
  if (!isYou && a && ctx.viewerId && ctx.accepted.has(authorId)) {
    const mode = a.revealIdentityMode || "keep_anonymous";
    const allowed = mode === "always_profile" || (mode === "show_to_connections" && ctx.mutuals.has(authorId));
    if (allowed) knownAs = { handle: a.handle, displayName: a.displayName, avatarUrl: a.avatarUrl };
  }

  return {
    kind: identity as "alias" | "anonymous",
    isYou,
    label,
    knownAs,
    canRequestReveal: !isYou && !!ctx.viewerId,
  };
}

export async function buildAuthorCtx(authorIds: string[], communityId: string, viewerId: string | null): Promise<AuthorCtx> {
  const unique = Array.from(new Set(authorIds));
  const authors: AuthorCtx["authors"] = new Map();
  if (unique.length) {
    const rows = await db
      .select({ user: tables.users, profile: tables.profiles })
      .from(tables.users)
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(inArray(tables.users.id, unique))
      .all();
    const memberships = await db
      .select()
      .from(tables.communityMembers)
      .where(and(eq(tables.communityMembers.communityId, communityId), inArray(tables.communityMembers.userId, unique)))
      .all();
    const mByUser = new Map(memberships.map((m) => [m.userId, m] as const));
    for (const r of rows)
      authors.set(r.user.id, {
        handle: r.user.handle,
        displayName: r.profile.displayName,
        avatarUrl: r.profile.avatarUrl,
        verified: !!r.profile.verified,
        revealIdentityMode: r.profile.revealIdentityMode,
        membership: mByUser.get(r.user.id) || null,
      });
  }
  return { viewerId, authors, accepted: await acceptedRevealSet(viewerId), mutuals: await mutualFollowSet(viewerId) };
}

/** The masked label a member currently presents in a community — used to
    describe a reveal requester without exposing them. */
export async function maskedLabelFor(communityId: string, userId: string, identity: string): Promise<string> {
  const m = await getMembership(communityId, userId);
  if (identity === "alias" && m?.alias) return m.alias;
  if (identity === "real") {
    const p = await db.select().from(tables.profiles).where(eq(tables.profiles.userId, userId)).get();
    return p?.displayName || "A member";
  }
  return anonLabel(m?.anonCode || (await ensureAnonCode(communityId, userId)));
}

/* ----------------------------- moderation ----------------------------- */

export async function logMod(input: {
  communityId: string;
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  note?: string;
}) {
  await db.insert(tables.communityModLog)
    .values({
      id: id(),
      communityId: input.communityId,
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType || "",
      targetId: input.targetId || "",
      note: input.note || "",
    })
    .run();
}

/* ------------------------------ counting ------------------------------ */

export async function communityCounts(communityIds: string[]) {
  const counts = new Map<string, { members: number; active: number }>();
  if (!communityIds.length) return counts;
  const members = await db
    .select({ communityId: tables.communityMembers.communityId, status: tables.communityMembers.status })
    .from(tables.communityMembers)
    .where(inArray(tables.communityMembers.communityId, communityIds))
    .all();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const recent = await db
    .select({ communityId: tables.communityPosts.communityId, authorId: tables.communityPosts.authorId })
    .from(tables.communityPosts)
    .where(and(inArray(tables.communityPosts.communityId, communityIds), gt(tables.communityPosts.createdAt, weekAgo)))
    .all();
  for (const cId of communityIds) {
    const m = members.filter((x) => x.communityId === cId && x.status === "active").length;
    const a = new Set(recent.filter((x) => x.communityId === cId).map((x) => x.authorId)).size;
    counts.set(cId, { members: m, active: a });
  }
  return counts;
}

export function serializeCommunity(
  c: Community,
  opts: { membership?: Membership | null; counts?: { members: number; active: number }; pendingJoins?: number }
) {
  const m = opts.membership;
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    access: c.access,
    kind: c.kind,
    category: c.category,
    avatarUrl: c.avatarUrl,
    coverUrl: c.coverUrl,
    rules: parse(c.rules),
    joinApproval: !!c.joinApproval,
    whoCanPost: c.whoCanPost,
    whoCanInvite: c.whoCanInvite,
    identityModes: parse(c.identityModes),
    campusId: c.campusId,
    audience: c.audience,
    createdAt: c.createdAt,
    members: opts.counts?.members ?? 0,
    activeMembers: opts.counts?.active ?? 0,
    // public preview facts — visible to everyone, including non-members
    capacity: c.capacity,
    price: c.price,
    billingPeriod: c.billingPeriod,
    customPeriodDays: c.customPeriodDays,
    graceDays: c.graceDays,
    paused: !!c.paused,
    viewer: m
      ? {
          role: m.role,
          status: membershipState(c, m),
          memberUntil: m.memberUntil ? new Date(m.memberUntil).toISOString() : null,
          alias: m.alias,
          anonCode: m.anonCode,
          lastIdentity: m.lastIdentity,
          mutedUntil: m.mutedUntil,
          isMod: isMod(m),
        }
      : null,
    pendingJoins: opts.pendingJoins,
  };
}

/* ---------------------- lazy loan-style resolvers ---------------------- */

export function memberIsMuted(m: Membership): boolean {
  return !!m.mutedUntil && new Date(m.mutedUntil).getTime() > Date.now();
}

/* --------------------------- attached links --------------------------- */

/** resolve an attached Mavyn link to a typed ref card (source preserved) */
export async function resolveRef(refType: string, refId: string): Promise<{ title: string } | null > {
  const q = {
    service: async () => await db.select({ t: tables.services.title }).from(tables.services).where(eq(tables.services.id, refId)).get(),
    opportunity: async () => await db.select({ t: tables.opportunities.title }).from(tables.opportunities).where(eq(tables.opportunities.id, refId)).get(),
    product: async () => await db.select({ t: tables.products.title }).from(tables.products).where(eq(tables.products.id, refId)).get(),
    work: async () => await db.select({ t: tables.works.title }).from(tables.works).where(eq(tables.works.id, refId)).get(),
    campus: async () => await db.select({ t: tables.campusListings.title }).from(tables.campusListings).where(eq(tables.campusListings.id, refId)).get(),
    event: async () => await db.select({ t: tables.events.title }).from(tables.events).where(eq(tables.events.id, refId)).get(),
  }[refType];
  const row = await q?.();
  return row ? { title: row!.t } : null;
}

export function parseRefUrl(url: string): { refType: string; refId: string } | null {
  const m = url.trim().match(/(?:^|\/)((?:services|opportunities|shop|works|events)|campus\/market)\/([a-zA-Z0-9_-]+)/);
  if (!m) return null;
  const map: Record<string, string> = { services: "service", opportunities: "opportunity", shop: "product", works: "work", events: "event", "campus/market": "campus" };
  return { refType: map[m[1]], refId: m[2] };
}

export async function buildRefCard(refType: string | null, refId: string | null) {
  if (!refType || !refId) return null;
  const meta = communityRefMeta[refType];
  const resolved = await resolveRef(refType, refId);
  if (!meta || !resolved) return null;
  return { type: refType, label: meta.label, title: resolved.title, href: meta.href(refId) };
}
