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

    // real professional history — computed, never self-reported
    const reviewsReceived = db
      .select()
      .from(tables.reviews)
      .where(eq(tables.reviews.subjectId, user.id))
      .all();
    const rating = reviewsReceived.length
      ? Math.round((reviewsReceived.reduce((s, r) => s + r.rating, 0) / reviewsReceived.length) * 10) / 10
      : null;
    const completedProjects = db
      .select()
      .from(tables.projects)
      .where(eq(tables.projects.creatorId, user.id))
      .all()
      .filter((p) => ["completed", "reviewed"].includes(p.state)).length;
    const approvedExtensions = db
      .select()
      .from(tables.extensionRequests)
      .where(eq(tables.extensionRequests.requestedById, user.id))
      .all()
      .filter((e) => e.status === "approved").length;
    const portfolio =
      isOwner || profile.showPortfolio
        ? db.select().from(tables.portfolioItems).where(eq(tables.portfolioItems.userId, user.id)).all()
            .filter((i) => isOwner || i.visible)
        : [];

    return {
      user: publicUser(user, profile, { viewerIsOwner: isOwner }),
      joined: user.createdAt.toISOString(),
      stats: {
        followers: isOwner || profile.showFollowers ? followers : null,
        following: isOwner || profile.showFollowing ? following : null,
        rating,
        reviewsCount: reviewsReceived.length,
        completedProjects: isOwner || profile.showCompletedProjects ? completedProjects : null,
        // approved extensions never count against anyone — shown only as history
        approvedExtensions,
      },
      reviews: reviewsReceived.slice(0, 6).map((r) => ({ rating: r.rating, body: r.body, createdAt: r.createdAt.toISOString() })),
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
