import { eq, asc } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser } from "@/lib/server/auth";
import { ownProfile } from "@/lib/server/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = getSessionUser();
  if (!session) return Response.json({ user: null });
  const user = db.select().from(tables.users).where(eq(tables.users.id, session.id)).get()!;
  const experience = db
    .select()
    .from(tables.experiences)
    .where(eq(tables.experiences.userId, session.id))
    .orderBy(asc(tables.experiences.order))
    .all();
  return Response.json({
    user: { ...ownProfile(user, session.profile), experience },
  });
}
