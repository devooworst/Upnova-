import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { requireOpportunityPoster } from "@/lib/server/authz";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/applications/[id] { action: shortlist | select | decline }
 * Poster only. Selecting auto-creates the Project (draft) between the
 * poster (client) and the applicant (creator), attached to a conversation.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const app = db.select().from(tables.applications).where(eq(tables.applications.id, params.id)).get();
    if (!app) throw new ApiError(404, "Application not found");
    const opp = requireOpportunityPoster(app.opportunityId, user.id);

    const action = String(body.action);
    if (!["shortlist", "select", "decline"].includes(action)) throw new ApiError(400, "Unknown action");

    if (action === "shortlist") {
      db.update(tables.applications).set({ status: "shortlisted" }).where(eq(tables.applications.id, app.id)).run();
      notify({
        userId: app.applicantId,
        actorId: user.id,
        type: "application_shortlisted",
        title: `You were shortlisted for ${opp.title}`,
        href: `/opportunities`,
        priority: "normal",
      });
      return { status: "shortlisted" };
    }

    if (action === "decline") {
      db.update(tables.applications).set({ status: "declined" }).where(eq(tables.applications.id, app.id)).run();
      return { status: "declined" };
    }

    // select → project auto-created
    db.update(tables.applications).set({ status: "selected" }).where(eq(tables.applications.id, app.id)).run();
    db.update(tables.opportunities).set({ status: "filled" }).where(eq(tables.opportunities.id, opp.id)).run();

    // conversation between poster and applicant
    const convId = randomBytes(12).toString("hex");
    db.insert(tables.conversations).values({ id: convId }).run();
    db.insert(tables.conversationMembers).values([
      { conversationId: convId, userId: user.id },
      { conversationId: convId, userId: app.applicantId },
    ]).run();
    db.insert(tables.messages)
      .values({
        id: randomBytes(12).toString("hex"),
        conversationId: convId,
        senderId: user.id,
        body: `You've been selected for "${opp.title}". Let's finalize the details here.`,
      })
      .run();

    const projectId = randomBytes(12).toString("hex");
    db.insert(tables.projects)
      .values({
        id: projectId,
        clientId: user.id,
        creatorId: app.applicantId,
        opportunityId: opp.id,
        conversationId: convId,
        title: opp.title,
        brief: opp.description,
        amount: opp.budget ?? 0,
        deadline: opp.eventDate ?? null,
        state: "draft",
      })
      .run();

    notify({
      userId: app.applicantId,
      actorId: user.id,
      type: "application_selected",
      title: `You got it — selected for ${opp.title}`,
      body: opp.budget ? `$${opp.budget} · project created` : "Project created",
      href: `/messages?c=${convId}`,
    });

    return { status: "selected", projectId, conversationId: convId };
  });
}
