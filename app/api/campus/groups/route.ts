import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";
import { requireCampus } from "@/lib/server/campus";
import { getMembership, communityCounts, serializeCommunity } from "@/lib/server/communities";
import { STUDENT_GROUP_CATEGORIES, isStudentGroup } from "@/lib/communityIdentity";

export const dynamic = "force-dynamic";

/** GET /api/campus/groups — the STUDENT GROUPS area of Your Campus:
 *  this campus's communities in the Study Groups / Student Organizations /
 *  Academic Groups / Interest Groups categories. These never appear in the
 *  general Communities directory; general communities never appear here. */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const campusId = requireCampus(user.id);
    const campus = db.select().from(tables.campuses).where(eq(tables.campuses.id, campusId)).get()!;

    const groups = db
      .select()
      .from(tables.communities)
      .orderBy(desc(tables.communities.createdAt))
      .all()
      .filter((c) => c.campusId === campusId && isStudentGroup(c));

    const counts = communityCounts(groups.map((g) => g.id));

    return {
      campusName: campus.name,
      categories: STUDENT_GROUP_CATEGORIES,
      groups: groups.map((g) =>
        serializeCommunity(g, { membership: getMembership(g.id, user.id), counts: counts.get(g.id) })
      ),
    };
  });
}
