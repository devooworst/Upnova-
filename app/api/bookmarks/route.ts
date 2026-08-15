import { NextRequest } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { recordInteraction, type TargetType } from "@/lib/server/recsys";

export const dynamic = "force-dynamic";

const TYPES = ["post", "opportunity", "service", "event", "community"] as const;

/** GET /api/bookmarks — the user's saved items, joined to the real records. */
export async function GET() {
  return guarded(async () => {
    const user = await requireUser();
    const rows = await db
      .select()
      .from(tables.bookmarks)
      .where(eq(tables.bookmarks.userId, user.id))
      .orderBy(desc(tables.bookmarks.createdAt))
      .all();

    const byType = async (t: string) => rows.filter((r) => r.targetType === t).map((r) => r.targetId);

    const posts = (await byType("post")).length
      ? await db
          .select({ post: tables.posts, profile: tables.profiles, user: tables.users })
          .from(tables.posts)
          .innerJoin(tables.users, eq(tables.posts.authorId, tables.users.id))
          .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
          .where(inArray(tables.posts.id, await byType("post")))
          .all()
      : [];
    const opps = (await byType("opportunity")).length
      ? await db
          .select({ opp: tables.opportunities, profile: tables.profiles })
          .from(tables.opportunities)
          .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.opportunities.posterId))
          .where(inArray(tables.opportunities.id, await byType("opportunity")))
          .all()
      : [];
    const eventRows = (await byType("event")).length
      ? await db.select().from(tables.events).where(inArray(tables.events.id, await byType("event"))).all()
      : [];
    const services = (await byType("service")).length
      ? await db
          .select({ service: tables.services, profile: tables.profiles, user: tables.users })
          .from(tables.services)
          .innerJoin(tables.users, eq(tables.services.ownerId, tables.users.id))
          .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
          .where(inArray(tables.services.id, await byType("service")))
          .all()
      : [];

    const items = rows
      .map((r) => {
        if (r.targetType === "post") {
          const p = posts.find((x) => x.post.id === r.targetId);
          if (!p) return null;
          return {
            type: "post" as const,
            id: r.targetId,
            title: p.post.body.slice(0, 90),
            by: p.profile.displayName,
            byHandle: p.user.handle,
            meta: `${p.post.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
            href: `/?post=${r.targetId}`,
            savedAt: r.createdAt.toISOString(),
          };
        }
        if (r.targetType === "opportunity") {
          const o = opps.find((x) => x.opp.id === r.targetId);
          if (!o) return null;
          return {
            type: "opportunity" as const,
            id: r.targetId,
            title: o.opp.title,
            by: o.profile.displayName,
            byHandle: "",
            meta: o.opp.budget != null ? `$${o.opp.budget} · ${o.opp.remote ? "Remote" : o.opp.location}` : `Collab · ${o.opp.remote ? "Remote" : o.opp.location}`,
            href: "/opportunities",
            savedAt: r.createdAt.toISOString(),
          };
        }
        if (r.targetType === "event") {
          const e = eventRows.find((x) => x.id === r.targetId);
          if (!e) return null;
          return {
            type: "event" as const,
            id: r.targetId,
            title: e.title,
            by: e.city,
            byHandle: "",
            meta: `${e.startsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${e.timeLabel} · ${e.price != null ? `$${e.price}` : "Free"}`,
            href: `/events/${e.slug}`,
            savedAt: r.createdAt.toISOString(),
          };
        }
        if (r.targetType === "service") {
          const s = services.find((x) => x.service.id === r.targetId);
          if (!s) return null;
          return {
            type: "service" as const,
            id: r.targetId,
            title: s.service.title,
            by: s.profile.displayName,
            byHandle: s.user.handle,
            meta: `From $${s.service.price} · ${s.service.reach}`,
            href: "/services",
            savedAt: r.createdAt.toISOString(),
          };
        }
        return null;
      })
      .filter(Boolean);

    return { items };
  });
}

/** POST { targetType, targetId } — toggle a bookmark. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const targetType = String(body.targetType);
    const targetId = String(body.targetId || "");
    if (!TYPES.includes(targetType as (typeof TYPES)[number]) || !targetId)
      throw new ApiError(400, "Invalid bookmark target");

    const existing = await db
      .select()
      .from(tables.bookmarks)
      .where(
        and(
          eq(tables.bookmarks.userId, user.id),
          eq(tables.bookmarks.targetType, targetType),
          eq(tables.bookmarks.targetId, targetId)
        )
      )
      .get();

    if (existing) {
      await db.delete(tables.bookmarks)
        .where(
          and(
            eq(tables.bookmarks.userId, user.id),
            eq(tables.bookmarks.targetType, targetType),
            eq(tables.bookmarks.targetId, targetId)
          )
        )
        .run();
      await recordInteraction(user.id, targetType as TargetType, targetId, "unsave");
      return { saved: false };
    }
    await db.insert(tables.bookmarks).values({ userId: user.id, targetType, targetId }).run();
    await recordInteraction(user.id, targetType as TargetType, targetId, "save");
    return { saved: true };
  });
}
