import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { communityCounts, serializeCommunity } from "@/lib/server/communities";
import { COMMUNITY_CATEGORIES, isStudentGroup } from "@/lib/communityIdentity";

export const dynamic = "force-dynamic";

const id = () => randomBytes(12).toString("hex");
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "community";

/** GET — discover communities. Guests see the public directory (name,
 *  description, counts, category, access, rules) but can't join. */
export async function GET(req: NextRequest) {
  return guarded(() => {
    const viewer = getSessionUser();
    const q = (req.nextUrl.searchParams.get("q") || "").toLowerCase().trim();
    const category = req.nextUrl.searchParams.get("category") || "";

    let all = db.select().from(tables.communities).orderBy(desc(tables.communities.createdAt)).all();
    if (q) all = all.filter((c) => (c.name + " " + c.description + " " + c.category).toLowerCase().includes(q));
    if (category) all = all.filter((c) => c.category === category);

    const memberships = viewer
      ? db.select().from(tables.communityMembers).where(eq(tables.communityMembers.userId, viewer.id)).all()
      : [];
    const mByCommunity = new Map(memberships.map((m) => [m.communityId, m]));
    const counts = communityCounts(all.map((c) => c.id));

    const mine = all
      .filter((c) => {
        const m = mByCommunity.get(c.id);
        return m && ["active", "pending", "invited"].includes(m.status);
      })
      .map((c) => serializeCommunity(c, { membership: mByCommunity.get(c.id), counts: counts.get(c.id) }));

    const discover = all
      .filter((c) => !mByCommunity.get(c.id) || mByCommunity.get(c.id)!.status === "banned")
      // student groups (campus + Study Groups / Student Organizations /
      // Academic Groups / Interest Groups) live in Your Campus → Student
      // Groups, not in the general directory
      .filter((c) => !isStudentGroup(c))
      .map((c) => serializeCommunity(c, { membership: null, counts: counts.get(c.id) }));

    return { guest: !viewer, mine, discover, categories: COMMUNITY_CATEGORIES };
  });
}

/** POST — create a community. Any member can create a general community;
 *  linking it to a campus requires verified campus status there. */
export async function POST(req: NextRequest) {
  return guarded(async () => {
    const user = requireUser();
    const body = await req.json().catch(() => ({}));

    const name = String(body.name || "").trim();
    if (name.length < 3 || name.length > 60) throw new ApiError(400, "Community name should be 3–60 characters");
    const description = String(body.description || "").trim().slice(0, 500);
    const access = ["public", "private", "invite"].includes(body.access) ? body.access : "public";
    const category = COMMUNITY_CATEGORIES.includes(body.category) ? body.category : "General";
    const rules: string[] = Array.isArray(body.rules)
      ? body.rules.map((r: unknown) => String(r).trim()).filter(Boolean).slice(0, 10)
      : [];
    const whoCanPost = ["members", "mods"].includes(body.whoCanPost) ? body.whoCanPost : "members";
    const whoCanInvite = ["members", "mods"].includes(body.whoCanInvite) ? body.whoCanInvite : "mods";
    const joinApproval = access === "private" ? true : !!body.joinApproval;

    const modes: string[] = Array.isArray(body.identityModes)
      ? body.identityModes.filter((m: string) => ["real", "alias", "anonymous"].includes(m))
      : ["real"];
    if (!modes.length) throw new ApiError(400, "Allow at least one identity mode");

    // campus link needs verified campus membership at THAT campus
    let campusId: string | null = null;
    if (body.campusId) {
      const v = db
        .select()
        .from(tables.campusVerifications)
        .where(eq(tables.campusVerifications.userId, user.id))
        .all()
        .find((r) => r.campusId === body.campusId && r.status === "verified");
      if (!v) throw new ApiError(403, "Creating a campus community needs verified campus status at that school");
      campusId = body.campusId;
    }

    // unique slug
    let slug = slugify(name);
    if (db.select().from(tables.communities).where(eq(tables.communities.slug, slug)).get())
      slug = `${slug}-${id().slice(0, 4)}`;

    const communityId = id();
    db.insert(tables.communities)
      .values({
        id: communityId,
        slug,
        name,
        description,
        access,
        category,
        kind: "standard",
        rules: JSON.stringify(rules),
        joinApproval,
        whoCanPost,
        whoCanInvite,
        identityModes: JSON.stringify(modes),
        campusId,
        coverUrl: body.coverUrl ? String(body.coverUrl).slice(0, 400) : null,
        createdById: user.id,
      })
      .run();
    db.insert(tables.communityMembers).values({ communityId, userId: user.id, role: "owner", status: "active" }).run();

    return { ok: true, id: communityId, slug };
  });
}
