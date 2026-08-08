import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/** POST = follow, DELETE = unfollow. */
export async function POST(_req: NextRequest, { params }: { params: { userId: string } }) {
  return guarded(() => {
    const user = requireUser();
    if (params.userId === user.id) throw new ApiError(400, "You can't follow yourself");
    const target = db.select().from(tables.users).where(eq(tables.users.id, params.userId)).get();
    if (!target || target.status !== "active") throw new ApiError(404, "User not found");

    const existing = db
      .select()
      .from(tables.follows)
      .where(and(eq(tables.follows.followerId, user.id), eq(tables.follows.followingId, target.id)))
      .get();
    if (!existing) {
      db.insert(tables.follows).values({ followerId: user.id, followingId: target.id }).run();
      notify({
        userId: target.id,
        actorId: user.id,
        type: "follow",
        title: `${user.profile.displayName} started following you`,
        href: `/creator/${user.handle}`,
      });
    }
    return { following: true };
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { userId: string } }) {
  return guarded(() => {
    const user = requireUser();
    db.delete(tables.follows)
      .where(and(eq(tables.follows.followerId, user.id), eq(tables.follows.followingId, params.userId)))
      .run();
    return { following: false };
  });
}
