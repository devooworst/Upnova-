import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
// (db/tables already imported below)
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";
import { getProjectForParty } from "@/lib/server/authz";
import { transition } from "@/lib/server/projects";
import { seedStartsWork } from "@/lib/server/demo";
import { publicUser } from "@/lib/server/serialize";

export const dynamic = "force-dynamic";

/** GET — full project detail for a party. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const user = requireUser();
    const p = getProjectForParty(params.id, user.id);

    const otherId = p.clientId === user.id ? p.creatorId : p.clientId;
    const otherUser = db.select().from(tables.users).where(eq(tables.users.id, otherId)).get()!;
    const otherProfile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, otherId)).get()!;
    const extensions = db
      .select()
      .from(tables.extensionRequests)
      .where(eq(tables.extensionRequests.projectId, p.id))
      .all();
    const milestones = db
      .select()
      .from(tables.projectMilestones)
      .where(eq(tables.projectMilestones.projectId, p.id))
      .all();
    const paymentRows = db.select().from(tables.payments).where(eq(tables.payments.projectId, p.id)).all();
    const reviewRows = db.select().from(tables.reviews).where(eq(tables.reviews.projectId, p.id)).all();

    return {
      project: {
        id: p.id,
        title: p.title,
        brief: p.brief,
        amount: p.amount,
        state: p.state,
        aiRequirement: p.aiRequirement,
        deadline: p.deadline?.toISOString() ?? null,
        conversationId: p.conversationId,
        myRole: p.clientId === user.id ? "client" : "creator",
        with: publicUser(otherUser, otherProfile),
        extensions: extensions.map((e) => ({
          id: e.id,
          days: e.days,
          reason: e.reason,
          status: e.status,
          mine: e.requestedById === user.id,
          createdAt: e.createdAt.toISOString(),
        })),
        milestones,
        payments: paymentRows.map((pay) => ({
          id: pay.id,
          amountCents: pay.amountCents,
          feeCents: pay.feeCents,
          status: pay.status,
        })),
        reviews: reviewRows.map((r) => ({ rating: r.rating, body: r.body, mine: r.authorId === user.id })),
      },
    };
  });
}

/** PATCH { action } — run a state transition (see lib/server/projects.ts). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const p = transition(params.id, String(body.action), user.id);
    // dev demo: after funding, the seed creator starts (and asks for +2 days once)
    if (body.action === "start") seedStartsWork(params.id);
    const fresh = db.select().from(tables.projects).where(eq(tables.projects.id, params.id)).get()!;
    return { state: fresh.state };
  });
}
