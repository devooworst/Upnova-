import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser, guarded } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { haversineMi } from "@/lib/server/feed";

export const dynamic = "force-dynamic";

/** GET /api/users?near=1&limit=4 — creator directory (sidebar widgets, discovery). */
export async function GET(req: NextRequest) {
  return guarded(() => {
    const viewer = getSessionUser();
    const near = req.nextUrl.searchParams.get("near") === "1";
    const limit = Math.min(20, Number(req.nextUrl.searchParams.get("limit")) || 6);
    const classOf = req.nextUrl.searchParams.get("classOf") || "";
    const campusSlug = req.nextUrl.searchParams.get("campus") || "";

    const rows = db
      .select({ user: tables.users, profile: tables.profiles })
      .from(tables.users)
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .all()
      .filter((r) => r.user.status === "active" && r.user.id !== viewer?.id && r.profile.visibility === "public");

    // "Class of" is a discovery ATTRIBUTE (never a community): filterable
    // only for members who opted into showing their grad year
    let allowedIds: Set<string> | null = null;
    if (classOf || campusSlug) {
      const campus = campusSlug ? db.select().from(tables.campuses).where(eq(tables.campuses.slug, campusSlug)).get() : null;
      const verifs = db
        .select()
        .from(tables.campusVerifications)
        .where(eq(tables.campusVerifications.status, "verified"))
        .all()
        .filter((v) => v.showSchool)
        .filter((v) => (campus ? v.campusId === campus.id : true))
        .filter((v) => (classOf ? v.showGradYear && v.gradYear === classOf : true));
      allowedIds = new Set(verifs.map((v) => v.userId));
    }
    const filtered = allowedIds ? rows.filter((r) => allowedIds!.has(r.user.id)) : rows;

    const followed = viewer
      ? new Set(
          db
            .select({ id: tables.follows.followingId })
            .from(tables.follows)
            .where(eq(tables.follows.followerId, viewer.id))
            .all()
            .map((x) => x.id)
        )
      : new Set<string>();

    let list = filtered.map((r) => {
      const mi =
        viewer?.profile.lat != null && r.profile.lat != null
          ? haversineMi(viewer.profile.lat!, viewer.profile.lng!, r.profile.lat, r.profile.lng!)
          : null;
      return { r, mi };
    });

    if (near) {
      list = list.filter((x) => x.mi != null).sort((a, b) => a.mi! - b.mi!);
    }

    return {
      creators: list.slice(0, limit).map(({ r, mi }) => ({
        ...publicUser(r.user, r.profile),
        distanceMi: mi != null ? Math.round(mi * 10) / 10 : null,
        followedByMe: followed.has(r.user.id),
      })),
    };
  });
}
