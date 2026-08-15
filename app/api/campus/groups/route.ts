import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";
import { requireCurrentStudent } from "@/lib/server/campus";
import { getMembership, communityCounts, serializeCommunity } from "@/lib/server/communities";
import { STUDENT_GROUP_CATEGORIES, isStudentGroup } from "@/lib/communityIdentity";

export const dynamic = "force-dynamic";

/** GET /api/campus/groups — the STUDENT GROUPS area of Your Campus:
 *  this campus's communities in the Study Groups / Student Organizations /
 *  Academic Groups / Interest Groups categories. These never appear in the
 *  general Communities directory; general communities never appear here. */
export async function GET() {
  return guarded(async () => {
    const user = await requireUser();
    const campusId = await requireCurrentStudent(user.id);
    const campus = (await db.select().from(tables.campuses).where(eq(tables.campuses.id, campusId)).get())!;

    const groups = (await db
      .select()
      .from(tables.communities)
      .orderBy(desc(tables.communities.createdAt))
      .all())
      .filter((c) => c.campusId === campusId && isStudentGroup(c));

    const counts = await communityCounts(groups.map((g) => g.id));

    return {
      campusName: campus.name,
      categories: STUDENT_GROUP_CATEGORIES,
      groups: await Promise.all(groups.map(async (g) =>
        serializeCommunity(g, { membership: await getMembership(g.id, user.id), counts: counts.get(g.id) })
      )),
    };
  });
}
