import { NextRequest } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { buildAuthorCtx, maskAuthor, communityCounts } from "@/lib/server/communities";
import { getSessionUser, guarded } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { FeedScope, inScope, verifiedCampusMap, viewerContext } from "@/lib/server/feed";
import { buildTaste, ranker, type Scorable } from "@/lib/server/recsys";
import { postTrustMap } from "@/lib/server/trust";
import { parseConfig } from "@/lib/servicePolicies";
import { ctaFor } from "@/lib/server/cta";

export const dynamic = "force-dynamic";

/** How many posts a guest can browse before the join card — see the
 *  product first, convert naturally. */
const GUEST_FEED_LIMIT = 12;

/**
 * GET /api/feed?tab=for-you|following|trending&scope=for-you|5mi|25mi|city|county|state|country|global|school
 * Tab picks the ranking, scope picks the geography — orthogonal by design.
 * (The Opportunities feed tab is served by /api/opportunities.)
 */
export async function GET(req: NextRequest) {
  return guarded(() => {
    // Guests may look: they get a LIMITED public Discover slice — global,
    // unpersonalized, capped. Members get the full ranked feed. Location
    // privacy is identical for both (locationLabel is computed server-side
    // from each author's own visibility setting; exact coords never leave).
    const user = getSessionUser();
    const tab = user ? req.nextUrl.searchParams.get("tab") || "for-you" : "discover";
    const scope = (user ? req.nextUrl.searchParams.get("scope") || "for-you" : "global") as FeedScope;

    const ctx = user ? viewerContext(user.id, user.profile) : null;

    const rows = db
      .select({ post: tables.posts, user: tables.users, profile: tables.profiles })
      .from(tables.posts)
      .innerJoin(tables.users, eq(tables.posts.authorId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .orderBy(desc(tables.posts.createdAt))
      .limit(300)
      .all()
      .filter((r) => r.user.status === "active");

    const postIds = rows.map((r) => r.post.id);
    const authorIds = Array.from(new Set(rows.map((r) => r.post.authorId)));

    const likeRows = postIds.length
      ? db.select().from(tables.likes).where(inArray(tables.likes.postId, postIds)).all()
      : [];
    const commentRows = postIds.length
      ? db.select().from(tables.comments).where(inArray(tables.comments.postId, postIds)).all()
      : [];
    const communityRows = authorIds.length
      ? db
          .select()
          .from(tables.communityMembers)
          .where(inArray(tables.communityMembers.userId, authorIds))
          .all()
      : [];
    const campusMap = verifiedCampusMap(authorIds);

    const likesByPost = new Map<string, number>();
    const likedByMe = new Set<string>();
    for (const l of likeRows) {
      likesByPost.set(l.postId, (likesByPost.get(l.postId) ?? 0) + 1);
      if (user && l.userId === user.id) likedByMe.add(l.postId);
    }
    const commentsByPost = new Map<string, number>();
    for (const c of commentRows) commentsByPost.set(c.postId, (commentsByPost.get(c.postId) ?? 0) + 1);
    const communitiesByUser = new Map<string, Set<string>>();
    for (const m of communityRows) {
      if (!communitiesByUser.has(m.userId)) communitiesByUser.set(m.userId, new Set());
      communitiesByUser.get(m.userId)!.add(m.communityId);
    }

    // ---- the recommendation engine ranks; the route only maps shapes ----
    // guests have no taste profile — nothing personal exists to rank with
    const taste = user ? buildTaste(user.id, user.profile) : null;

    const parseTags = (s: string) => {
      try {
        return JSON.parse(s) as string[];
      } catch {
        return [];
      }
    };

    const scoped = ctx ? rows.filter((r) => inScope(scope, ctx, r.profile, campusMap.get(r.post.authorId))) : rows;
    // trust chips are computed server-side in one pass — Verified Work and
    // Client Confirmed can't be self-declared through the API
    const trustMap = postTrustMap(scoped.map((r) => r.post), user?.id);
    const mapped = scoped.map((r) => {
      const likes = likesByPost.get(r.post.id) ?? 0;
      const commentsCount = commentsByPost.get(r.post.id) ?? 0;
      const scorable: Scorable = {
        id: r.post.id,
        type: "post",
        authorId: r.post.authorId,
        category: r.post.category,
        tags: [...parseTags(r.profile.skills), ...parseTags(r.profile.interests), r.post.category].filter(Boolean),
        lat: r.profile.lat,
        lng: r.profile.lng,
        locationOk: r.profile.locationVisibility !== "hidden",
        sameCity: !!user?.profile.city && r.profile.city === user.profile.city,
        createdAt: r.post.createdAt,
        engagement: likes + 2 * commentsCount,
        authorCommunityIds: communitiesByUser.get(r.post.authorId) ?? new Set(),
      };
      const item = {
        id: r.post.id,
        body: r.post.body,
        imageUrl: r.post.imageUrl,
        kind: r.post.kind,
        category: r.post.category,
        subcategory: r.post.subcategory,
        createdAt: r.post.createdAt.toISOString(),
        author: publicUser(r.user, r.profile),
        likes,
        comments: commentsCount,
        likedByMe: likedByMe.has(r.post.id),
        isMine: !!user && r.post.authorId === user.id,
        trust: trustMap.get(r.post.id),
        refType: r.post.refType,
        refId: r.post.refId,
      };
      return { item, scorable };
    });

    let items: (typeof mapped)[number]["item"][];
    let reasons: Record<string, string[]> = {};
    if (!user || !taste) {
      // guest Discover: recent + engaging public posts, hard-capped.
      // Enough to see the product — personalization needs an account.
      const now = Date.now();
      const discover = (x: (typeof mapped)[number]) =>
        x.scorable.engagement - ((now - Date.parse(x.item.createdAt)) / 86400_000) * 2;
      items = mapped
        .slice()
        .sort((a, b) => discover(b) - discover(a))
        .map(({ item }) => item)
        .slice(0, GUEST_FEED_LIMIT);
    } else if (tab === "following") {
      // chronological — you asked for these people, don't reorder them.
      // hides still apply.
      items = mapped
        .filter(({ scorable, item }) => !taste.hiddenTargets.has(scorable.id) && (taste.followingIds.has(item.author.id) || item.isMine))
        .map(({ item }) => item);
    } else if (tab === "trending") {
      items = mapped
        .filter(({ scorable }) => !taste.hiddenTargets.has(scorable.id))
        .sort((a, b) => b.scorable.engagement - a.scorable.engagement)
        .map(({ item }) => item);
    } else {
      const ranked = ranker.rank(mapped.map(({ item, scorable }) => ({ item, scorable })), taste);
      items = ranked.map((r) => r.item);
      for (const r of ranked.slice(0, 20)) reasons[r.item.id] = r.reasons;
    }

    // ---- promoted slot: labeled, separate, NEVER part of organic ranking ----
    let promoted: object | null = null;
    if (tab === "for-you" && user && taste) {
      const promo = db
        .select({ service: tables.services, profile: tables.profiles, u: tables.users })
        .from(tables.services)
        .innerJoin(tables.users, eq(tables.services.ownerId, tables.users.id))
        .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
        .all()
        .find((r) => r.service.promoted && r.service.active && !r.service.paused && r.service.ownerId !== user.id);
      if (promo && !taste.hiddenTargets.has(promo.service.id)) {
        promoted = {
          id: promo.service.id,
          title: promo.service.title,
          description: promo.service.description,
          price: promo.service.price,
          cta: ctaFor(promo.service),
          owner: publicUser(promo.u, promo.profile),
        };
      }
    }

    // ---- organic service suggestion: RANKED by the same engine, clearly
    // labeled, never paid placement. Public listings only — a published
    // service is feed-eligible automatically, no re-posting required. ----
    let suggestedService: object | null = null;
    if (tab === "for-you" && user && taste) {
      const candidates = db
        .select({ service: tables.services, profile: tables.profiles, u: tables.users })
        .from(tables.services)
        .innerJoin(tables.users, eq(tables.services.ownerId, tables.users.id))
        .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
        .all()
        .filter(
          (r) =>
            r.service.active &&
            !r.service.paused &&
            !r.service.promoted &&
            r.service.visibility === "public" &&
            r.service.ownerId !== user.id &&
            r.u.status === "active" &&
            !taste.hiddenTargets.has(r.service.id)
        );
      const rankedSvc = ranker.rank(
        candidates.map((r) => ({
          item: r,
          scorable: {
            id: r.service.id,
            type: "service",
            authorId: r.service.ownerId,
            category: r.service.category,
            tags: [r.service.category, r.service.title],
            lat: r.profile.lat,
            lng: r.profile.lng,
            locationOk: r.profile.locationVisibility !== "hidden",
            sameCity: !!user.profile.city && r.profile.city === user.profile.city,
            createdAt: r.service.createdAt,
            engagement: 0,
          } as Scorable,
        })),
        taste
      );
      const top = rankedSvc[0];
      if (top) {
        suggestedService = {
          id: top.item.service.id,
          title: top.item.service.title,
          price: top.item.service.price,
          category: top.item.service.category,
          cta: ctaFor(top.item.service),
          owner: publicUser(top.item.u, top.item.profile),
          reasons: top.reasons,
        };
      }
    }

    // ---- one product card, same engine, labeled PRODUCT — the feed knows
    // a product is not a post ----
    let suggestedProduct: object | null = null;
    if (tab === "for-you" && user && taste) {
      const prods = db
        .select({ product: tables.products, profile: tables.profiles, u: tables.users })
        .from(tables.products)
        .innerJoin(tables.users, eq(tables.products.sellerId, tables.users.id))
        .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
        .all()
        .filter(
          (r) =>
            r.product.status === "active" &&
            r.product.sellerId !== user.id &&
            r.u.status === "active" &&
            !taste.hiddenTargets.has(r.product.id)
        );
      const rankedProd = ranker.rank(
        prods.map((r) => ({
          item: r,
          scorable: {
            id: r.product.id,
            type: "service",
            authorId: r.product.sellerId,
            category: r.product.category,
            tags: [r.product.category, r.product.title],
            lat: r.profile.lat,
            lng: r.profile.lng,
            locationOk: r.profile.locationVisibility !== "hidden",
            sameCity: !!user.profile.city && r.profile.city === user.profile.city,
            createdAt: r.product.createdAt,
            engagement: r.product.sold,
          } as Scorable,
        })),
        taste
      );
      const topP = rankedProd[0];
      if (topP) {
        suggestedProduct = {
          id: topP.item.product.id,
          title: topP.item.product.title,
          price: topP.item.product.price,
          category: topP.item.product.category,
          external: !!topP.item.product.externalUrl,
          image: (() => { try { return (JSON.parse(topP.item.product.media) as string[])[0] ?? null; } catch { return null; } })(),
          owner: publicUser(topP.item.u, topP.item.profile),
          reasons: topP.reasons,
        };
      }
    }

    // ---- WORK card (License) + OPPORTUNITY card (Apply): the feed is a
    // discovery-and-action surface, every type distinct and labeled ----
    let suggestedWork: object | null = null;
    let suggestedOpportunity: object | null = null;
    if (tab === "for-you" && user && taste) {
      const workRows = db
        .select({ work: tables.works, profile: tables.profiles, u: tables.users })
        .from(tables.works)
        .innerJoin(tables.users, eq(tables.works.creatorId, tables.users.id))
        .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
        .all()
        .filter((r) => r.work.status === "active" && !r.work.exclusiveLicenseId && r.work.creatorId !== user.id && r.u.status === "active" && !taste.hiddenTargets.has(r.work.id));
      const rankedW = ranker.rank(
        workRows.map((r) => ({
          item: r,
          scorable: {
            id: r.work.id, type: "service", authorId: r.work.creatorId,
            category: r.work.kind, tags: [r.work.kind, r.work.title],
            lat: r.profile.lat, lng: r.profile.lng,
            locationOk: r.profile.locationVisibility !== "hidden",
            sameCity: !!user.profile.city && r.profile.city === user.profile.city,
            createdAt: r.work.createdAt, engagement: 0,
          } as Scorable,
        })),
        taste
      );
      if (rankedW[0]) {
        const t = rankedW[0].item;
        const opts = (() => { try { return JSON.parse(t.work.licenseOptions) as { price: number | null }[]; } catch { return []; } })();
        const priced = opts.filter((o) => o.price != null && o.price > 0).sort((a, b) => a.price! - b.price!)[0];
        suggestedWork = {
          id: t.work.id, title: t.work.title, kind: t.work.kind,
          from: priced?.price ?? null, hasFree: opts.some((o) => o.price === 0),
          coverUrl: t.work.coverUrl,
          owner: publicUser(t.u, t.profile), reasons: rankedW[0].reasons,
        };
      }

      const oppRows = db
        .select({ opp: tables.opportunities, profile: tables.profiles, u: tables.users })
        .from(tables.opportunities)
        .innerJoin(tables.users, eq(tables.opportunities.posterId, tables.users.id))
        .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
        .all()
        .filter((r) => r.opp.status === "open" && r.opp.posterId !== user.id && r.u.status === "active" && !taste.hiddenTargets.has(r.opp.id));
      const rankedO = ranker.rank(
        oppRows.map((r) => ({
          item: r,
          scorable: {
            id: r.opp.id, type: "opportunity", authorId: r.opp.posterId,
            category: r.opp.type, tags: [r.opp.title, r.opp.type],
            lat: r.opp.lat, lng: r.opp.lng,
            locationOk: r.profile.locationVisibility !== "hidden",
            sameCity: !!user.profile.city && r.profile.city === user.profile.city,
            createdAt: r.opp.createdAt, engagement: 0,
          } as Scorable,
        })),
        taste
      );
      if (rankedO[0]) {
        const t = rankedO[0].item;
        suggestedOpportunity = {
          id: t.opp.id, title: t.opp.title, budget: t.opp.budget,
          location: t.opp.remote ? "Remote" : t.opp.location,
          owner: publicUser(t.u, t.profile), reasons: rankedO[0].reasons,
        };
      }
    }

    // ---- COMMUNITY card: a popular recent post from a PUBLIC community
    // surfaces in For You with its author masked exactly as inside the
    // community — the reader clicks through to the original source ----
    let suggestedCommunityPost: object | null = null;
    if (tab === "for-you" && user) {
      const publics = db.select().from(tables.communities).all().filter((c) => c.access === "public");
      const pubIds = new Set(publics.map((c) => c.id));
      const cutoffC = new Date(Date.now() - 14 * 86_400_000);
      const cposts = db
        .select()
        .from(tables.communityPosts)
        .all()
        .filter((p) => pubIds.has(p.communityId) && !p.removedAt && p.createdAt > cutoffC && p.authorId !== user.id);
      if (cposts.length) {
        const reactions = db.select().from(tables.communityReactions).all();
        const rcount = new Map<string, number>();
        for (const r of reactions) rcount.set(r.postId, (rcount.get(r.postId) ?? 0) + 1);
        const ccomments = db.select({ postId: tables.communityComments.postId }).from(tables.communityComments).all();
        const ccount = new Map<string, number>();
        for (const r of ccomments) ccount.set(r.postId, (ccount.get(r.postId) ?? 0) + 1);
        cposts.sort(
          (a, b) =>
            (rcount.get(b.id) ?? 0) + 2 * (ccount.get(b.id) ?? 0) - ((rcount.get(a.id) ?? 0) + 2 * (ccount.get(a.id) ?? 0)) ||
            b.createdAt.getTime() - a.createdAt.getTime()
        );
        const top = cposts[0];
        const community = publics.find((c) => c.id === top.communityId)!;
        const ctxC = buildAuthorCtx([top.authorId], community.id, user.id);
        suggestedCommunityPost = {
          postId: top.id,
          body: top.body.slice(0, 220),
          author: maskAuthor(top.authorId, top.identity, ctxC),
          community: { id: community.id, slug: community.slug, name: community.name, members: communityCounts([community.id]).get(community.id)?.members ?? 0 },
          reactions: rcount.get(top.id) ?? 0,
          comments: ccount.get(top.id) ?? 0,
        };
      }
    }

    return { items: items.slice(0, 60), reasons, promoted, suggestedService, suggestedProduct, suggestedWork, suggestedOpportunity, suggestedCommunityPost, guest: !user, totalPublic: mapped.length };
  });
}
