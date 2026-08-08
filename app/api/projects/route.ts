import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { desc, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";

export const dynamic = "force-dynamic";

/** GET /api/projects — projects where I'm client or creator. */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const rows = db
      .select()
      .from(tables.projects)
      .where(or(eq(tables.projects.clientId, user.id), eq(tables.projects.creatorId, user.id)))
      .orderBy(desc(tables.projects.updatedAt))
      .all();

    return {
      projects: rows.map((p) => {
        const otherId = p.clientId === user.id ? p.creatorId : p.clientId;
        const otherUser = db.select().from(tables.users).where(eq(tables.users.id, otherId)).get()!;
        const otherProfile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, otherId)).get()!;
        const pendingExt = db
          .select()
          .from(tables.extensionRequests)
          .where(eq(tables.extensionRequests.projectId, p.id))
          .all();
        return {
          id: p.id,
          title: p.title,
          brief: p.brief,
          amount: p.amount,
          state: p.state,
          deadline: p.deadline?.toISOString() ?? null,
          conversationId: p.conversationId,
          myRole: p.clientId === user.id ? "client" : "creator",
          with: publicUser(otherUser, otherProfile),
          extensions: pendingExt.map((e) => ({
            id: e.id,
            days: e.days,
            reason: e.reason,
            status: e.status,
            mine: e.requestedById === user.id,
          })),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
    };
  });
}

/**
 * POST /api/projects — create a draft project.
 * { creatorHandle, title, brief, amount, serviceId?, conversationId?, deadline? }
 * The authenticated user becomes the client; the creator must allow offers.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const handle = String(body.creatorHandle || "").trim().toLowerCase();
    const creator = db.select().from(tables.users).where(eq(tables.users.handle, handle)).get();
    if (!creator || creator.status !== "active") throw new ApiError(404, "Creator not found");
    if (creator.id === user.id) throw new ApiError(400, "You can't open a project with yourself");
    const creatorProfile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, creator.id)).get()!;
    if (!creatorProfile.hiringEnabled || !creatorProfile.acceptOffers)
      throw new ApiError(403, "This creator isn't accepting project offers");

    const amount = Math.round(Number(body.amount));
    if (!Number.isFinite(amount) || amount < 1) throw new ApiError(400, "Amount must be at least $1");
    const title = String(body.title || "").trim();
    if (!title) throw new ApiError(400, "Title is required");

    const id = randomBytes(12).toString("hex");
    db.insert(tables.projects)
      .values({
        id,
        clientId: user.id,
        creatorId: creator.id,
        serviceId: body.serviceId ? String(body.serviceId) : null,
        conversationId: body.conversationId ? String(body.conversationId) : null,
        title,
        brief: String(body.brief || "").slice(0, 2000),
        amount,
        aiRequirement: String(body.aiRequirement || "client-decides"),
        deadline: body.deadline ? new Date(body.deadline) : null,
        state: "draft",
      })
      .run();
    return { id };
  });
}
