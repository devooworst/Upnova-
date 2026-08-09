import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { ctaFor } from "@/lib/server/cta";
import { postTrustMap } from "@/lib/server/trust";

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

    // one canonical record per service — the profile simply shows what the
    // creator's visibility choice allows this viewer to see. Unlisted stays
    // off the profile (it lives on its link); drafts are owner-only.
    const viewerFollows = viewer
      ? !!db
          .select()
          .from(tables.follows)
          .where(and(eq(tables.follows.followerId, viewer.id), eq(tables.follows.followingId, user.id)))
          .get()
      : false;
    const visibleToViewer = (s: { visibility: string }) =>
      isOwner ||
      s.visibility === "public" ||
      (s.visibility === "followers" && viewerFollows);
    const allServices = db
      .select()
      .from(tables.services)
      .where(eq(tables.services.ownerId, user.id))
      .all()
      .filter((s) => (isOwner ? true : s.visibility !== "unlisted" && s.visibility !== "draft") && visibleToViewer(s));
    const services = allServices.filter((s) => s.active && (isOwner || !s.paused));
    // deactivated services remain part of the public record — history,
    // not erasure (their share pages still resolve, unbookable)
    const pastServices = allServices.filter((s) => !s.active);

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

    /* ---- Trust & Authenticity summary (lib/trust.ts) ----
       Everything here is COMPUTED from records, never self-reported:
       badges from actual verification rows, work counts from server-
       validated post links, confirmations from counterparties. */
    const studentVerified = !!db
      .select()
      .from(tables.campusVerifications)
      .where(and(eq(tables.campusVerifications.userId, user.id), eq(tables.campusVerifications.status, "verified")))
      .get();
    const myPosts = db.select().from(tables.posts).where(eq(tables.posts.authorId, user.id)).all();
    const myTrust = Array.from(postTrustMap(myPosts).values());
    const completedBookings = db
      .select()
      .from(tables.bookings)
      .where(eq(tables.bookings.providerId, user.id))
      .all()
      .filter((b) => b.status === "completed").length;
    const licensesIssued = db
      .select()
      .from(tables.licenses)
      .where(eq(tables.licenses.creatorId, user.id))
      .all().length;
    const trust = {
      licensesIssued,
      badges: {
        identityVerified: profile.trustLevel === "high-trust",
        businessVerified: user.businessVerified,
        studentVerified,
      },
      completedProjects,
      completedBookings,
      verifiedWorkPosts: myTrust.filter((t) => t.verifiedWork).length,
      clientConfirmedPosts: myTrust.filter((t) => t.clientConfirmed).length,
      reviewsCount: reviewsReceived.length,
      rating,
    };

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
      trust,
      followedByMe,
      services: services.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        price: s.price,
        reach: s.reach,
        paused: s.paused,
        category: s.category,
        fulfillment: s.fulfillment,
        visibility: s.visibility,
        cta: ctaFor(s),
      })),
      // history, not erasure — deactivated listings the viewer could see
      pastServices: pastServices.map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        since: s.createdAt.toISOString(),
      })),
      experience,
      portfolio,
    };
  });
}
