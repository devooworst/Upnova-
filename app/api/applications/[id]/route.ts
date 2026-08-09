import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { requireOpportunityPoster } from "@/lib/server/authz";
import { notify } from "@/lib/server/notify";
import { parseRoles, openingsLeft } from "@/lib/opportunityRoles";
import { acceptRoleOffer, declineRoleOffer, conversationBetween, startEngagementCycle } from "@/lib/server/oppFlow";
import { parseEngagement, normalizeEngagement, parseOffer, compLabel, cycleLabel, ENGAGEMENT_TYPES, COMP_MODELS } from "@/lib/engagement";
import { seedAcceptsRoleOffer } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/applications/[id] { action }
 *
 * Poster actions:  shortlist · select · decline
 *   Role opportunities: select = an OFFER (awaiting acceptance, capacity
 *   enforced). Simple opportunities keep the legacy select → project path.
 *   Declines send the professional update — never a harsh "declined".
 * Applicant actions:  accept · decline_offer  (role offers only)
 *   accept → scheduled booking on both calendars; poster pays through the
 *   normal booking payment flow.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const app = db.select().from(tables.applications).where(eq(tables.applications.id, params.id)).get();
    if (!app) throw new ApiError(404, "Application not found");

    const action = String(body.action);

    /* ------------------- applicant side: the offer ------------------- */
    if (action === "accept") {
      if (app.applicantId !== user.id) throw new ApiError(403, "Not your application");
      return acceptRoleOffer(app.id);
    }
    if (action === "decline_offer") return declineRoleOffer(app.id, user.id);

    if (action === "next_cycle") {
      // poster starts the next paid cycle of an ACTIVE engagement
      requireOpportunityPoster(app.opportunityId, user.id);
      return startEngagementCycle(app.id);
    }

    /* --------------------------- poster side --------------------------- */
    const opp = requireOpportunityPoster(app.opportunityId, user.id);
    if (!["shortlist", "select", "decline", "interview", "offer", "complete_engagement"].includes(action))
      throw new ApiError(400, "Unknown action");

    /* ---- interview: scheduled through UpNova, or clearly EXTERNAL ---- */
    if (action === "interview") {
      if (!["submitted", "shortlisted", "interview"].includes(app.status))
        throw new ApiError(409, `Cannot schedule an interview from "${app.status}"`);
      const external = body.external === true;
      const applicantName = db.select().from(tables.profiles).where(eq(tables.profiles.userId, app.applicantId)).get()?.displayName ?? "Applicant";
      if (external) {
        db.update(tables.applications)
          .set({ status: "interview", interview: JSON.stringify({ mode: "external", note: String(body.note || "").slice(0, 200) }) })
          .where(eq(tables.applications.id, app.id))
          .run();
        notify({
          userId: app.applicantId, actorId: user.id, type: "application",
          title: `Interview — ${opp.title}`,
          body: `The interview happens OUTSIDE UpNova.${body.note ? ` ${String(body.note).slice(0, 120)}` : ""} Details in Messages.`,
          href: "/opportunities?apps=1",
        });
        return { status: "interview", external: true };
      }
      const at = new Date(body.at);
      if (isNaN(at.getTime()) || at.getTime() < Date.now()) throw new ApiError(400, "Pick a future interview time");
      const convId = conversationBetween(user.id, app.applicantId);
      // UpNova-scheduled: a $0 booking lands on BOTH calendars
      db.insert(tables.bookings)
        .values({
          id: randomBytes(12).toString("hex"),
          serviceId: null, clientId: user.id, providerId: app.applicantId,
          title: `Interview — ${opp.title}`, startsAt: at, durationMin: 30, price: 0,
          items: JSON.stringify([{ label: `Interview · ${opp.title}`, amount: 0 }]),
          location: opp.remote ? "Remote" : opp.location, status: "confirmed", conversationId: convId,
        })
        .run();
      db.update(tables.applications)
        .set({ status: "interview", interview: JSON.stringify({ mode: "upnova", at: at.toISOString() }) })
        .where(eq(tables.applications.id, app.id))
        .run();
      db.insert(tables.messages)
        .values({
          id: randomBytes(12).toString("hex"), conversationId: convId, senderId: user.id, kind: "system",
          body: `Interview scheduled — ${opp.title} · ${at.toLocaleDateString("en-US", { month: "long", day: "numeric" })} at ${at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. It's on both calendars.`,
        })
        .run();
      db.update(tables.conversations).set({ updatedAt: new Date() }).where(eq(tables.conversations.id, convId)).run();
      notify({
        userId: app.applicantId, actorId: user.id, type: "booking",
        title: `Interview scheduled — ${opp.title}`,
        body: `${at.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} — it's on your calendar`,
        href: "/calendar",
      });
      return { status: "interview", at: at.toISOString(), applicant: applicantName };
    }

    /* ---- offer: configurable terms the applicant actually agrees to ---- */
    if (action === "offer") {
      if (!["submitted", "shortlisted", "interview", "offer_declined"].includes(app.status))
        throw new ApiError(409, `Cannot send an offer from "${app.status}"`);
      const eng = parseEngagement(opp.engagement) ?? normalizeEngagement({ type: "one_time" })!;
      const amount = Math.round(Number(body.amount));
      if (!Number.isFinite(amount) || amount < 0) throw new ApiError(400, "Set the compensation amount");
      const offer = {
        title: String(body.title || opp.title).trim().slice(0, 80),
        engagementType: ENGAGEMENT_TYPES.find((t) => t.id === body.engagementType)?.id ?? eng.type,
        customLabel: String(body.customLabel || eng.customLabel || "").slice(0, 40) || undefined,
        compModel: COMP_MODELS.find((c) => c.id === body.compModel)?.id ?? eng.compModel,
        amount,
        schedule: String(body.schedule || eng.schedule || "").slice(0, 120) || undefined,
        startDate: body.startDate ? String(body.startDate).slice(0, 24) : eng.startDate,
        duration: String(body.duration || eng.duration || "").slice(0, 60) || undefined,
        classification: body.classification === "external_employment" || eng.classification === "external_employment"
          ? "external_employment"
          : "upnova_freelance",
        note: String(body.note || "").slice(0, 500) || undefined,
        cycles: 0,
      };
      db.update(tables.applications)
        .set({ status: "selected", offer: JSON.stringify(offer) })
        .where(eq(tables.applications.id, app.id))
        .run();
      notify({
        userId: app.applicantId, actorId: user.id, type: "application_selected",
        title: `Offer — ${offer.title}`,
        body: `${ENGAGEMENT_TYPES.find((t) => t.id === offer.engagementType)?.label}${offer.amount ? ` · $${offer.amount}${["weekly","biweekly","monthly","hourly"].includes(offer.compModel) ? ` per ${cycleLabel(offer.compModel)}` : ""}` : ""}${offer.classification === "external_employment" ? " · employment handled OUTSIDE UpNova" : " · paid through UpNova (secured → released)"}. Review it in My Applications.`,
        href: "/opportunities?apps=1",
      });
      seedAcceptsRoleOffer(app.id); // demo: seed applicants accept instantly
      const fresh = db.select().from(tables.applications).where(eq(tables.applications.id, app.id)).get()!;
      return { status: fresh.status };
    }

    /* ---- the relationship ends: completed, kept in history ---- */
    if (action === "complete_engagement") {
      if (app.status !== "active") throw new ApiError(409, `Cannot complete from "${app.status}"`);
      db.update(tables.applications).set({ status: "completed" }).where(eq(tables.applications.id, app.id)).run();
      const offer = parseOffer(app.offer);
      notify({
        userId: app.applicantId, actorId: user.id, type: "application",
        title: `Engagement completed — ${offer?.title ?? opp.title}`,
        body: "It stays in both histories. Thanks for the work!",
        href: "/opportunities?apps=1",
      });
      return { status: "completed" };
    }
    const roles = parseRoles(opp.roles);
    const role = roles.find((r) => r.id === app.roleId);

    if (action === "shortlist") {
      db.update(tables.applications).set({ status: "shortlisted" }).where(eq(tables.applications.id, app.id)).run();
      notify({
        userId: app.applicantId,
        actorId: user.id,
        type: "application_shortlisted",
        title: `You were shortlisted for ${opp.title}`,
        body: role ? `Role: ${role.title}` : "",
        href: `/opportunities`,
        priority: "normal",
      });
      return { status: "shortlisted" };
    }

    if (action === "decline") {
      db.update(tables.applications).set({ status: "declined" }).where(eq(tables.applications.id, app.id)).run();
      // professional, never harsh — the standard update
      notify({
        userId: app.applicantId,
        actorId: user.id,
        type: "application",
        title: `Update on your application`,
        body: `Thank you for applying to ${opp.title}. The creator has decided to move forward with other applicants for this opportunity. We appreciate your interest.`,
        href: "/opportunities",
        priority: "low",
      });
      return { status: "declined" };
    }

    /* ------------------------------ select ------------------------------ */
    if (roles.length > 0) {
      // role opportunity: select = OFFER. Capacity is enforced here — the
      // server, not the screen, decides when a role is full.
      if (!role) throw new ApiError(409, "This application isn't tied to a role");
      if (!["submitted", "shortlisted", "offer_declined"].includes(app.status))
        throw new ApiError(409, `Cannot select from "${app.status}"`);
      const allApps = db
        .select()
        .from(tables.applications)
        .where(eq(tables.applications.opportunityId, opp.id))
        .all();
      if (openingsLeft(role, allApps) < 1)
        throw new ApiError(409, `${role.title} is filled — ${role.count}/${role.count} openings taken`);

      db.update(tables.applications).set({ status: "selected" }).where(eq(tables.applications.id, app.id)).run();

      const when = opp.eventDate
        ? opp.eventDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })
        : "date to be confirmed";
      notify({
        userId: app.applicantId,
        actorId: user.id,
        type: "application_selected",
        title: `You've been selected — ${role.title}`,
        body: `${opp.title} · ${when} · ${opp.remote ? "Remote" : opp.location}${role.pay ? ` · $${role.pay} via UpNova payment` : ""}. Accept in My Applications.`,
        href: `/opportunities?apps=1`,
      });

      // demo: seed applicants accept immediately — the team view fills in
      seedAcceptsRoleOffer(app.id);

      const fresh = db.select().from(tables.applications).where(eq(tables.applications.id, app.id)).get()!;
      return { status: fresh.status };
    }

    // ---- legacy simple opportunity: select → project (unchanged) ----
    db.update(tables.applications).set({ status: "selected" }).where(eq(tables.applications.id, app.id)).run();
    db.update(tables.opportunities).set({ status: "filled" }).where(eq(tables.opportunities.id, opp.id)).run();

    const convId = conversationBetween(user.id, app.applicantId);
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

/** DELETE — the applicant withdraws their own application. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const user = requireUser();
    const app = db.select().from(tables.applications).where(eq(tables.applications.id, params.id)).get();
    if (!app) throw new ApiError(404, "Application not found");
    if (app.applicantId !== user.id) throw new ApiError(403, "Not your application");
    if (["selected", "confirmed"].includes(app.status))
      throw new ApiError(409, "You were already selected — talk to the poster instead");
    db.delete(tables.applications).where(eq(tables.applications.id, params.id)).run();
    return { withdrawn: true };
  });
}
