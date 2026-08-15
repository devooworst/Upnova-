import { desc, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** GET /api/me/licenses — every license I hold or issued: the permanent
 *  transaction/license record both sides can point to in a dispute. */
export async function GET() {
  return guarded(async () => {
    const user = await requireUser();
    const rows = await db
      .select()
      .from(tables.licenses)
      .where(or(eq(tables.licenses.licenseeId, user.id), eq(tables.licenses.creatorId, user.id)))
      .orderBy(desc(tables.licenses.createdAt))
      .all();
    const names = new Map(
      (await db.select().from(tables.profiles).all()).map((p) => [p.userId, p.displayName])
    );
    return {
      licenses: rows.map((l) => ({
        id: l.id,
        workId: l.workId,
        workTitle: l.workTitle,
        licenseType: l.licenseType,
        optionName: l.optionName,
        permittedUsage: l.permittedUsage,
        restrictions: l.restrictions,
        attribution: l.attribution,
        price: l.price,
        status: l.status,
        conversationId: l.conversationId,
        myRole: l.creatorId === user.id ? "creator" : "licensee",
        with: names.get(l.creatorId === user.id ? l.licenseeId : l.creatorId) ?? "—",
        date: l.createdAt.toISOString(),
      })),
    };
  });
}
