import { NextRequest } from "next/server";
import { desc, eq, inArray, isNull, and } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** GET /api/notifications — own notifications, newest first. */
export async function GET(req: NextRequest) {
  return guarded(async () => {
    const user = await requireUser();
    const limit = Math.min(100, Number(req.nextUrl.searchParams.get("limit")) || 50);
    const rows = await db
      .select()
      .from(tables.notifications)
      .where(eq(tables.notifications.userId, user.id))
      .orderBy(desc(tables.notifications.createdAt))
      .limit(limit)
      .all();

    const unread = await db
      .select()
      .from(tables.notifications)
      .where(and(eq(tables.notifications.userId, user.id), isNull(tables.notifications.readAt)))
      .all();

    return {
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        category: n.category,
        priority: n.priority,
        title: n.title,
        body: n.body,
        href: n.href,
        read: !!n.readAt,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount: unread.length,
      hasHighPriorityUnread: unread.some((n) => n.priority === "high"),
    };
  });
}

/** PATCH { ids: string[] } or { all: true } — mark read (own only). */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    if (body.all) {
      await db.update(tables.notifications)
        .set({ readAt: new Date() })
        .where(and(eq(tables.notifications.userId, user.id), isNull(tables.notifications.readAt)))
        .run();
    } else if (Array.isArray(body.ids) && body.ids.length) {
      await db.update(tables.notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(tables.notifications.userId, user.id),
            inArray(tables.notifications.id, body.ids.map(String).slice(0, 100))
          )
        )
        .run();
    }
    return { ok: true };
  });
}
