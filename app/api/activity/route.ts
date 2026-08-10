import { desc, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";
import {
  STAGE_CHAINS,
  bookingStageIndex,
  purchaseStageIndex,
  projectStageIndex,
  applicationStageIndex,
} from "@/lib/activityStages";

export const dynamic = "force-dynamic";

/**
 * GET /api/activity — the centralized live Activity feed for the
 * authenticated user: bookings, purchases, projects, and opportunity
 * applications, each with its OWN stage chain (never one generic list),
 * the counterpart resolved by stable user ids, payment state, and the
 * linked conversation. Everything here reads the same records the rest
 * of the product writes — nothing is synthesized for display.
 */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const names = new Map(
      db.select({ userId: tables.profiles.userId, displayName: tables.profiles.displayName }).from(tables.profiles).all()
        .map((p) => [p.userId, p.displayName])
    );
    const handles = new Map(db.select().from(tables.users).all().map((u) => [u.id, u.handle]));
    const counterpart = (id: string) => ({ id, handle: handles.get(id) ?? "?", displayName: names.get(id) ?? "?" });
    const payments = db.select().from(tables.payments).all();

    /* latest progress update per record — Activity MIRRORS the history;
       the posting controls live in the project/booking workspaces */
    const allProgress = db.select().from(tables.progressUpdates).all();
    const latestFor = (key: "projectId" | "bookingId", id: string) => {
      const rows = allProgress
        .filter((r) => r[key] === id)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const updates = rows.filter((r) => r.kind === "update");
      const latest = updates.length ? updates[updates.length - 1] : null;
      let eta: Date | null = null;
      for (let i = rows.length - 1; i >= 0; i--)
        if (rows[i].etaAt) {
          eta = rows[i].etaAt!;
          break;
        }
      return {
        latestUpdate: latest
          ? { status: latest.status, percent: latest.percent, message: latest.message, at: latest.createdAt.toISOString() }
          : null,
        etaAt: eta?.toISOString() ?? null,
      };
    };

    /* ---------------- service bookings ---------------- */
    const bookings = db
      .select()
      .from(tables.bookings)
      .where(or(eq(tables.bookings.clientId, user.id), eq(tables.bookings.providerId, user.id)))
      .orderBy(desc(tables.bookings.createdAt))
      .all()
      .map((b) => {
        const pay = payments.find((p) => p.bookingId === b.id);
        return {
          kind: "booking" as const,
          id: b.id,
          title: b.title,
          myRole: b.clientId === user.id ? "client" : "provider",
          with: counterpart(b.clientId === user.id ? b.providerId : b.clientId),
          status: b.status,
          stageIndex: bookingStageIndex(b.status, b.progress),
          stages: STAGE_CHAINS.booking,
          startsAt: b.startsAt.toISOString(),
          amount: b.price + b.travelFee,
          paymentStatus: pay?.status ?? null,
          conversationId: b.conversationId,
          href: "/calendar",
          ...latestFor("bookingId", b.id),
          updatedAt: b.createdAt.toISOString(),
        };
      });

    /* ---------------- purchases (orders) ---------------- */
    const orders = db
      .select()
      .from(tables.orders)
      .where(or(eq(tables.orders.buyerId, user.id), eq(tables.orders.sellerId, user.id)))
      .orderBy(desc(tables.orders.createdAt))
      .all()
      .map((o) => {
        const pay = payments.find((p) => p.orderId === o.id);
        const events = db
          .select()
          .from(tables.orderEvents)
          .where(eq(tables.orderEvents.orderId, o.id))
          .orderBy(desc(tables.orderEvents.createdAt))
          .all()
          .slice(0, 10)
          .map((e) => ({ label: e.note || e.kind, at: e.createdAt.toISOString() }))
          .reverse();
        return {
          kind: "purchase" as const,
          id: o.id,
          title: o.title,
          myRole: o.buyerId === user.id ? "buyer" : "seller",
          with: counterpart(o.buyerId === user.id ? o.sellerId : o.buyerId),
          status: o.status,
          stageIndex: purchaseStageIndex(o.status),
          stages: STAGE_CHAINS.purchase,
          amount: o.price * o.qty,
          paymentStatus: pay?.status ?? null,
          conversationId: o.conversationId,
          href: "/orders",
          events, // the REAL logged timeline
          updatedAt: o.createdAt.toISOString(),
        };
      });

    /* ---------------- projects (hired services) ---------------- */
    const projects = db
      .select()
      .from(tables.projects)
      .where(or(eq(tables.projects.clientId, user.id), eq(tables.projects.creatorId, user.id)))
      .orderBy(desc(tables.projects.updatedAt))
      .all()
      .map((p) => {
        const pay = payments.find((x) => x.projectId === p.id);
        return {
          kind: "project" as const,
          id: p.id,
          title: p.title,
          myRole: p.clientId === user.id ? "client" : "creator",
          with: counterpart(p.clientId === user.id ? p.creatorId : p.clientId),
          status: p.state,
          stageIndex: projectStageIndex(p.state),
          stages: STAGE_CHAINS.project,
          amount: p.amount,
          paymentStatus: pay?.status ?? null,
          conversationId: p.conversationId,
          href: p.conversationId ? `/messages?c=${p.conversationId}` : "/messages",
          workspaceHref: `/projects/${p.id}`,
          ...latestFor("projectId", p.id),
          updatedAt: p.updatedAt.toISOString(),
        };
      });

    /* ---------------- opportunity applications (mine) ---------------- */
    const applications = db
      .select({ app: tables.applications, opp: tables.opportunities })
      .from(tables.applications)
      .innerJoin(tables.opportunities, eq(tables.applications.opportunityId, tables.opportunities.id))
      .where(eq(tables.applications.applicantId, user.id))
      .orderBy(desc(tables.applications.createdAt))
      .all()
      .map((r) => ({
        kind: "application" as const,
        id: r.app.id,
        title: r.opp.title,
        myRole: "applicant",
        with: counterpart(r.opp.posterId),
        status: r.app.status,
        stageIndex: applicationStageIndex(r.app.status),
        stages: STAGE_CHAINS.application,
        amount: r.opp.budget,
        paymentStatus: null,
        conversationId: null,
        href: `/opportunities/${r.opp.id}`,
        updatedAt: r.app.createdAt.toISOString(),
      }));

    /* ---------------- payment summary (held vs released, my view) ---------------- */
    const mine = payments.filter((p) => p.payerId === user.id || p.payeeId === user.id);
    const sum = (rows: typeof mine) => Math.round(rows.reduce((n, p) => n + p.amountCents + p.feeCents, 0) / 100);
    const paymentSummary = {
      heldOut: sum(mine.filter((p) => p.status === "held" && p.payerId === user.id)),
      heldIn: sum(mine.filter((p) => p.status === "held" && p.payeeId === user.id)),
      releasedIn: sum(mine.filter((p) => p.status === "released" && p.payeeId === user.id)),
      releasedOut: sum(mine.filter((p) => p.status === "released" && p.payerId === user.id)),
    };

    return { bookings, purchases: orders, projects, applications, paymentSummary };
  });
}
