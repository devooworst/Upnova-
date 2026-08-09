import { desc, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { loanChainStep, loanPhase } from "@/lib/campusMarket";

export const dynamic = "force-dynamic";

/** Factual borrowing record for a user AS BORROWER: completed on time,
 *  returned late, problem returns, currently overdue. History that both
 *  sides can weigh — advisory context, never an automatic penalty. */
function borrowerRecord(userId: string, now: number) {
  const rows = db.select().from(tables.loans).where(eq(tables.loans.borrowerId, userId)).all();
  return {
    onTime: rows.filter((l) => l.status === "completed" && !l.returnedLate).length,
    late: rows.filter((l) => (l.status === "completed" || l.status === "returned_disputed") && l.returnedLate).length,
    problems: rows.filter((l) => l.status === "returned_disputed").length,
    overdueNow: rows.filter((l) => l.status === "borrowed" && l.dueAt.getTime() < now).length,
  };
}

/** GET /api/me/loans — borrowing history: borrowed / lent, active /
 *  completed / overdue. Reminders fire lazily here: due-soon (<24h) and
 *  overdue notifications to BOTH parties, once each. Overdue is a status
 *  and a conversation, not a punishment. */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const rows = db
      .select()
      .from(tables.loans)
      .where(or(eq(tables.loans.borrowerId, user.id), eq(tables.loans.lenderId, user.id)))
      .orderBy(desc(tables.loans.createdAt))
      .all();
    const names = new Map(db.select().from(tables.profiles).all().map((p) => [p.userId, p.displayName]));

    const now = Date.now();
    for (const loan of rows) {
      if (loan.status !== "borrowed") continue;
      const due = loan.dueAt.getTime();
      const when = loan.dueAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" });
      if (!loan.dueSoonNotified && due - now < 24 * 3600_000 && due > now) {
        db.update(tables.loans).set({ dueSoonNotified: true }).where(eq(tables.loans.id, loan.id)).run();
        notify({ userId: loan.borrowerId, type: "order", title: `Reminder — ${loan.itemTitle} is due ${when}`, body: "Return it on time or request an extension.", href: "/campus/market?loans=1", priority: "high" });
        notify({ userId: loan.lenderId, type: "order", title: `${names.get(loan.borrowerId) ?? "The borrower"}'s loan of ${loan.itemTitle} is due ${when}`, body: "", href: "/campus/market?loans=1", priority: "normal" });
      }
      if (!loan.overdueNotified && due < now) {
        db.update(tables.loans).set({ overdueNotified: true }).where(eq(tables.loans.id, loan.id)).run();
        notify({ userId: loan.borrowerId, type: "order", title: `Overdue — ${loan.itemTitle}`, body: "Nothing bad happens automatically — message the owner or request an extension.", href: "/campus/market?loans=1", priority: "high" });
        notify({ userId: loan.lenderId, type: "order", title: `Overdue — your ${loan.itemTitle}`, body: `${names.get(loan.borrowerId) ?? "The borrower"} was due ${when}. You can message them or propose a new return date.`, href: "/campus/market?loans=1", priority: "high" });
      }
    }

    // record cache — computed once per counterpart that needs one
    const recordCache = new Map<string, ReturnType<typeof borrowerRecord>>();
    const recordOf = (uid: string) => {
      if (!recordCache.has(uid)) recordCache.set(uid, borrowerRecord(uid, now));
      return recordCache.get(uid)!;
    };

    return {
      // my own record as a borrower — my history, visible to me
      myRecord: recordOf(user.id),
      loans: rows.map((l) => {
        const isLender = l.lenderId === user.id;
        return {
          id: l.id,
          listingId: l.listingId,
          itemTitle: l.itemTitle,
          message: l.message,
          status: l.status,
          phase: loanPhase(l.status, l.dueAt.getTime(), now),
          chainStep: loanChainStep(l.status, l.dueAt.getTime(), now),
          overdue: l.status === "borrowed" && l.dueAt.getTime() < now,
          neededAt: l.neededAt?.toISOString() ?? null,
          exchangeMethod: l.exchangeMethod,
          exchangeNote: l.exchangeNote,
          startAt: l.startAt?.toISOString() ?? null,
          dueAt: l.dueAt.toISOString(),
          extensionUntil: l.extensionUntil?.toISOString() ?? null,
          counterUntil: l.counterUntil?.toISOString() ?? null,
          returnedLate: !!l.returnedLate,
          deposit: l.deposit,
          conditionBefore: (() => { try { return JSON.parse(l.conditionBefore); } catch { return {}; } })(),
          conditionAfter: (() => { try { return JSON.parse(l.conditionAfter); } catch { return {}; } })(),
          conversationId: l.conversationId,
          myRole: isLender ? "lender" : "borrower",
          with: names.get(isLender ? l.borrowerId : l.lenderId) ?? "—",
          // the owner deciding a REQUEST sees the requester's factual
          // borrowing history — records, not accusations
          withRecord: isLender && l.status === "requested" ? recordOf(l.borrowerId) : null,
        };
      }),
    };
  });
}
