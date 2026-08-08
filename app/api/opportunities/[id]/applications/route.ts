import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { requireOpportunityPoster } from "@/lib/server/authz";
import { publicUser } from "@/lib/server/serialize";
import { notify } from "@/lib/server/notify";
import { recordInteraction } from "@/lib/server/recsys";

export const dynamic = "force-dynamic";

/** GET — applicant list. Poster only (this is the applicant-review screen). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const user = requireUser();
    const opp = requireOpportunityPoster(params.id, user.id);

    const rows = db
      .select({ app: tables.applications, user: tables.users, profile: tables.profiles })
      .from(tables.applications)
      .innerJoin(tables.users, eq(tables.applications.applicantId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(eq(tables.applications.opportunityId, params.id))
      .orderBy(desc(tables.applications.createdAt))
      .all();

    return {
      opportunity: { id: opp.id, title: opp.title, budget: opp.budget, status: opp.status },
      applications: rows.map((r) => ({
        id: r.app.id,
        message: r.app.message,
        availability: r.app.availability, // yes | no | need_check — flags in review
        answers: (() => {
          try {
            return JSON.parse(r.app.answers);
          } catch {
            return {};
          }
        })(),
        status: r.app.status,
        createdAt: r.app.createdAt.toISOString(),
        applicant: publicUser(r.user, r.profile),
      })),
    };
  });
}

/** POST — apply as the authenticated user. Applying accepts the listed budget. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const opp = db.select().from(tables.opportunities).where(eq(tables.opportunities.id, params.id)).get();
    if (!opp) throw new ApiError(404, "Opportunity not found");
    if (opp.status !== "open") throw new ApiError(409, "This opportunity is no longer open");
    if (opp.posterId === user.id) throw new ApiError(400, "You can't apply to your own opportunity");
    if (opp.trustRequired === "high-trust" && user.profile.trustLevel !== "high-trust")
      throw new ApiError(403, "This opportunity requires High-Trust verification");

    const existing = db
      .select()
      .from(tables.applications)
      .where(and(eq(tables.applications.opportunityId, opp.id), eq(tables.applications.applicantId, user.id)))
      .get();
    if (existing) throw new ApiError(409, "You already applied to this opportunity");

    // adaptive requirements — the POSTER decided what's required
    let config: { requireMessage?: boolean; question?: string } = {};
    try {
      config = JSON.parse(opp.applyConfig);
    } catch {}

    const message = String(body.message || "").trim().slice(0, 1000);
    if (config.requireMessage !== false && !message)
      throw new ApiError(400, "Tell them why you're a good fit — it's required for this listing");

    // availability is asked ONLY when the opportunity has a date
    const availability = ["yes", "no", "need_check"].includes(body.availability) ? body.availability : "yes";
    if (opp.eventDate && !body.availability)
      throw new ApiError(400, "Confirm your availability for the project date");

    const questionAnswer = String(body.questionAnswer || "").trim().slice(0, 500);
    if (config.question && !questionAnswer)
      throw new ApiError(400, "The poster asked one extra question — answer it to apply");

    const id = randomBytes(12).toString("hex");
    db.insert(tables.applications)
      .values({
        id,
        opportunityId: opp.id,
        applicantId: user.id,
        message,
        availability,
        answers: JSON.stringify({
          ...(config.question ? { question: config.question, answer: questionAnswer } : {}),
          ...(body.extra ? { extra: String(body.extra).trim().slice(0, 500) } : {}),
        }),
      })
      .run();

    recordInteraction(user.id, "opportunity", opp.id, "apply");

    notify({
      userId: opp.posterId,
      actorId: user.id,
      type: "application",
      title: `${user.profile.displayName} applied to ${opp.title}`,
      body: opp.eventDate
        ? availability === "yes"
          ? "Available on your date"
          : availability === "no"
            ? "Not available on your date"
            : "Availability: needs to check their schedule"
        : message.slice(0, 80),
      href: `/opportunities/${opp.id}/applicants`,
    });

    return { id };
  });
}
