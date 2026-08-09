import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/loans/[id] { action } — the whole loan, tracked:
 *   requested → approved → borrowed (handoff + BEFORE condition) →
 *   return_claimed → completed (AFTER condition) · declined · cancelled ·
 *   returned_disputed (damage/missing reported → moderation case).
 *   Extensions: borrower requests, lender decides — never automatic.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const loan = db.select().from(tables.loans).where(eq(tables.loans.id, params.id)).get();
    if (!loan) throw new ApiError(404, "Loan not found");
    const isLender = loan.lenderId === user.id;
    const isBorrower = loan.borrowerId === user.id;
    if (!isLender && !isBorrower) throw new ApiError(403, "Not your loan");
    const other = isLender ? loan.borrowerId : loan.lenderId;
    const action = String(body.action);
    const set = (patch: Partial<typeof tables.loans.$inferInsert>) =>
      db.update(tables.loans).set(patch).where(eq(tables.loans.id, loan.id)).run();
    const cond = () => ({
      note: String(body.note || "").slice(0, 400),
      photos: Array.isArray(body.photos)
        ? body.photos.filter((p: unknown) => typeof p === "string" && (p as string).startsWith("data:image/") && (p as string).length < 500_000).slice(0, 3)
        : [],
      at: new Date().toISOString(),
    });
    const due = loan.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    if (action === "approve") {
      if (!isLender) throw new ApiError(403, "Only the owner approves");
      if (loan.status !== "requested") throw new ApiError(409, `Cannot approve from "${loan.status}"`);
      set({ status: "approved" });
      notify({ userId: other, actorId: user.id, type: "order", title: `Borrow approved — ${loan.itemTitle}`, body: `Arrange the campus pickup in Messages. Return by ${due}.${loan.deposit ? ` Agreed refundable deposit: $${loan.deposit}.` : ""}`, href: "/campus/market?loans=1" });
      return { status: "approved" };
    }
    if (action === "decline") {
      if (!isLender) throw new ApiError(403, "Only the owner declines");
      if (loan.status !== "requested") throw new ApiError(409, `Cannot decline from "${loan.status}"`);
      set({ status: "declined" });
      notify({ userId: other, actorId: user.id, type: "order", title: `Borrow request declined — ${loan.itemTitle}`, body: "", href: "/campus/market", priority: "low" });
      return { status: "declined" };
    }
    if (action === "cancel") {
      if (!isBorrower) throw new ApiError(403, "Only the borrower cancels a request");
      if (!["requested", "approved"].includes(loan.status)) throw new ApiError(409, "Too late to cancel — the item is out");
      set({ status: "cancelled" });
      return { status: "cancelled" };
    }

    if (action === "handoff") {
      // lender hands the item over and documents its BEFORE condition
      if (!isLender) throw new ApiError(403, "Only the owner confirms the handoff");
      if (loan.status !== "approved") throw new ApiError(409, `Cannot hand off from "${loan.status}"`);
      set({ status: "borrowed", startAt: new Date(), conditionBefore: JSON.stringify(cond()) });
      notify({ userId: other, actorId: user.id, type: "order", title: `Borrowed — ${loan.itemTitle}`, body: `Return by ${due}. Condition documented at handoff.`, href: "/campus/market?loans=1" });
      return { status: "borrowed" };
    }

    const fmt = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" });

    if (action === "request_extension") {
      // before the due date is the normal path — but being OVERDUE never
      // blocks asking: communication and extensions come before anything
      // punitive
      if (!isBorrower) throw new ApiError(403, "Only the borrower requests extensions");
      if (loan.status !== "borrowed") throw new ApiError(409, "No active loan to extend");
      const listing = loan.listingId ? db.select().from(tables.campusListings).where(eq(tables.campusListings.id, loan.listingId)).get() : null;
      if (listing && !listing.allowExtensions) throw new ApiError(409, "The owner doesn't allow extensions on this item");
      const until = new Date(body.until);
      if (isNaN(until.getTime()) || until.getTime() <= Math.max(loan.dueAt.getTime(), Date.now()))
        throw new ApiError(400, "Pick a date and time after the current due date");
      set({ extensionUntil: until, counterUntil: null });
      notify({ userId: other, actorId: user.id, type: "order", title: `Extension requested — ${loan.itemTitle}`, body: `Until ${fmt(until)}. Approve, decline, or propose a different date in Borrowing.`, href: "/campus/market?loans=1", priority: "high" });
      return { extensionUntil: until.toISOString() };
    }
    if (action === "extension_decide") {
      if (!isLender) throw new ApiError(403, "Only the owner decides extensions");
      if (!loan.extensionUntil) throw new ApiError(409, "No extension pending");
      const approve = body.approve === true;
      set(approve ? { dueAt: loan.extensionUntil, extensionUntil: null, counterUntil: null, dueSoonNotified: false, overdueNotified: false } : { extensionUntil: null });
      notify({ userId: other, actorId: user.id, type: "order", title: approve ? `Extension approved — ${loan.itemTitle}` : `Extension declined — ${loan.itemTitle}`, body: approve ? `New agreed return: ${fmt(loan.extensionUntil)}` : `Still due ${due}. You can message or propose a different date.`, href: "/campus/market?loans=1" });
      return { approved: approve };
    }
    if (action === "extension_counter") {
      // the owner proposes a DIFFERENT return date/time — the borrower
      // decides; the agreed date never changes unilaterally
      if (!isLender) throw new ApiError(403, "Only the owner proposes a different date");
      if (loan.status !== "borrowed") throw new ApiError(409, "No active loan");
      const until = new Date(body.until);
      if (isNaN(until.getTime()) || until.getTime() <= Date.now()) throw new ApiError(400, "Pick a future date and time");
      set({ counterUntil: until, extensionUntil: null });
      notify({ userId: other, actorId: user.id, type: "order", title: `Different return date proposed — ${loan.itemTitle}`, body: `${fmt(until)} instead. Accept or decline in Borrowing.`, href: "/campus/market?loans=1", priority: "high" });
      return { counterUntil: until.toISOString() };
    }
    if (action === "counter_decide") {
      if (!isBorrower) throw new ApiError(403, "Only the borrower answers the owner's proposal");
      if (!loan.counterUntil) throw new ApiError(409, "No proposed date pending");
      const accept = body.accept === true;
      set(accept ? { dueAt: loan.counterUntil, counterUntil: null, extensionUntil: null, dueSoonNotified: false, overdueNotified: false } : { counterUntil: null });
      notify({ userId: other, actorId: user.id, type: "order", title: accept ? `New return date agreed — ${loan.itemTitle}` : `Proposed date declined — ${loan.itemTitle}`, body: accept ? `Both of you now see: return by ${fmt(loan.counterUntil)}` : `Still due ${due}.`, href: "/campus/market?loans=1" });
      return { accepted: accept };
    }

    if (action === "mark_returned") {
      if (!isBorrower) throw new ApiError(403, "Only the borrower marks it returned");
      if (loan.status !== "borrowed") throw new ApiError(409, `Cannot mark returned from "${loan.status}"`);
      set({ status: "return_claimed", returnedAt: new Date() });
      notify({ userId: other, actorId: user.id, type: "order", title: `Return claimed — ${loan.itemTitle}`, body: "Confirm the return and the condition to complete the loan.", href: "/campus/market?loans=1" });
      return { status: "return_claimed" };
    }

    if (action === "confirm_return") {
      // lender closes the loop, documenting the AFTER condition —
      // "original condition" completes; a problem opens a moderation case
      if (!isLender) throw new ApiError(403, "Only the owner confirms the return");
      if (!["return_claimed", "borrowed"].includes(loan.status)) throw new ApiError(409, `Cannot confirm from "${loan.status}"`);
      const problem = body.problem === true;
      // factual record only: WAS it back after the agreed date? History,
      // never automatic punishment — extensions that were approved moved
      // dueAt, so an extended return on time is NOT late
      const backAt = loan.returnedAt ?? new Date();
      const late = backAt.getTime() > loan.dueAt.getTime();
      set({ status: problem ? "returned_disputed" : "completed", conditionAfter: JSON.stringify(cond()), returnedAt: backAt, returnedLate: late });
      if (problem) {
        db.insert(tables.reports)
          .values({
            id: randomBytes(12).toString("hex"),
            reporterId: user.id,
            targetType: "loan",
            targetId: loan.id,
            category: "unsafe_transaction",
            details: `Loan return problem — ${loan.itemTitle}: ${String(body.note || "damage/missing reported").slice(0, 400)}. Before/after condition records are on the loan.`,
            // ADVISORY risk signals for the human reviewer — factual
            // borrowing history, never proof, never an automatic penalty
            signals: JSON.stringify((() => {
              const hist = db.select().from(tables.loans).where(eq(tables.loans.borrowerId, loan.borrowerId)).all();
              const lateCt = hist.filter((h) => h.returnedLate).length;
              const probCt = hist.filter((h) => h.status === "returned_disputed").length;
              return [
                "Before/after condition records exist on this loan — compare them",
                `Borrower history (factual): ${hist.filter((h) => h.status === "completed" && !h.returnedLate).length} on-time returns · ${lateCt} late · ${probCt} prior problem return${probCt === 1 ? "" : "s"}`,
              ];
            })()),
          })
          .run();
        notify({ userId: other, actorId: user.id, type: "order", title: `Return problem reported — ${loan.itemTitle}`, body: "The before/after condition records go to review. Nothing is decided automatically.", href: "/campus/market?loans=1", priority: "high" });
      } else {
        notify({ userId: other, actorId: user.id, type: "order", title: `Loan completed — ${loan.itemTitle}`, body: `Returned in good shape. Thanks for the campus assist!${loan.deposit ? ` Refundable deposit ($${loan.deposit}) returns to the borrower.` : ""}`, href: "/campus/market?loans=1" });
      }
      return { status: problem ? "returned_disputed" : "completed" };
    }

    throw new ApiError(400, "Unknown action");
  });
}
