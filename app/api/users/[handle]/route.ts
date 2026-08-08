import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";

export const dynamic = "force-dynamic";

/** GET /api/users/[handle] — public profile, privacy toggles applied. */
export async function GET(_req: NextRequest, { params }: { params: { handle: string } }) {
  return guarded(() => {
    const viewer = getSessionUser();
    const user = db.select().from(tables.users).where(eq(tables.users.handle, params.handle)).get();
    if (!user || user.status !== "active") throw new ApiError(404, "User not found");
    const profile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, user.id)).get();
    if (!profile) throw new ApiError(404, "User not found");

    const isOwner = viewer?.id === user.id;
    if (profile.visibility === "private" && !isOwner) throw new ApiError(403, "This profile is private");
    if (profile.visibility === "members" && !viewer) throw new ApiError(401, "Sign in to view this profile");

    const followers = db.select().from(tables.follows).where(eq(tables.follows.followingId, user.id)).all().length;
    const following = db.select().from(tables.follows).where(eq(tables.follows.followerId, user.id)).all().length;
    const followedByMe = viewer
      ? !!db
          .select()
          .from(tables.follows)
          .where(and(eq(tables.follows.followerId, viewer.id), eq(tables.follows.followingId, user.id)))
          .get()
      : false;

    const services = db
      .select()
      .from(tables.services)
      .where(and(eq(tables.services.ownerId, user.id), eq(tables.services.active, true)))
      .all()
      .filter((s) => isOwner || !s.paused);

    const experience = db.select().from(tables.experiences).where(eq(tables.experiences.userId, user.id)).all();
    const portfolio =
      isOwner || profile.showPortfolio
        ? db.select().from(tables.portfolioItems).where(eq(tables.portfolioItems.userId, user.id)).all()
            .filter((i) => isOwner || i.visible)
        : [];

    return {
      user: publicUser(user, profile, { viewerIsOwner: isOwner }),
      stats: {
        followers: isOwner || profile.showFollowers ? followers : null,
        following: isOwner || profile.showFollowing ? following : null,
      },
      followedByMe,
      services: services.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        price: s.price,
        reach: s.reach,
        paused: s.paused,
      })),
      experience,
      portfolio,
    };
  });
}
