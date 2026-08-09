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

    if (action === "request_extension") {
      if (!isBorrower) throw new ApiError(403, "Only the borrower requests extensions");
      if (loan.status !== "borrowed") throw new ApiError(409, "No active loan to extend");
      const listing = loan.listingId ? db.select().from(tables.campusListings).where(eq(tables.campusListings.id, loan.listingId)).get() : null;
      if (listing && !listing.allowExtensions) throw new ApiError(409, "The owner doesn't allow extensions on this item");
      const until = new Date(body.until);
      if (isNaN(until.getTime()) || until.getTime() <= loan.dueAt.getTime()) throw new ApiError(400, "Pick a date after the current due date");
      set({ extensionUntil: until });
      notify({ userId: other, actorId: user.id, type: "order", title: `Extension requested — ${loan.itemTitle}`, body: `Until ${until.toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Approve or decline in Borrowing.`, href: "/campus/market?loans=1", priority: "high" });
      return { extensionUntil: until.toISOString() };
    }
    if (action === "extension_decide") {
      if (!isLender) throw new ApiError(403, "Only the owner decides extensions");
      if (!loan.extensionUntil) throw new ApiError(409, "No extension pending");
      const approve = body.approve === true;
      set(approve ? { dueAt: loan.extensionUntil, extensionUntil: null, dueSoonNotified: false, overdueNotified: false } : { extensionUntil: null });
      notify({ userId: other, actorId: user.id, type: "order", title: approve ? `Extension approved — ${loan.itemTitle}` : `Extension declined — ${loan.itemTitle}`, body: approve ? `New due date: ${loan.extensionUntil.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : `Still due ${due}.`, href: "/campus/market?loans=1" });
      return { approved: approve };
    }

    if (action === "mark_returned") {
      if (!isBorrower) throw new ApiError(403, "Only the borrower marks it returned");
      if (loan.status !== "borrowed") throw new ApiError(409, `Cannot mark returned from "${loan.status}"`);
      set({ status: "return_claimed" });
      notify({ userId: other, actorId: user.id, type: "order", title: `Return claimed — ${loan.itemTitle}`, body: "Confirm the return and the condition to complete the loan.", href: "/campus/market?loans=1" });
      return { status: "return_claimed" };
    }

    if (action === "confirm_return") {
      // lender closes the loop, documenting the AFTER condition —
      // "original condition" completes; a problem opens a moderation case
      if (!isLender) throw new ApiError(403, "Only the owner confirms the return");
      if (!["return_claimed", "borrowed"].includes(loan.status)) throw new ApiError(409, `Cannot confirm from "${loan.status}"`);
      const problem = body.problem === true;
      set({ status: problem ? "returned_disputed" : "completed", conditionAfter: JSON.stringify(cond()) });
      if (problem) {
        db.insert(tables.reports)
          .values({
            id: randomBytes(12).toString("hex"),
            reporterId: user.id,
            targetType: "loan",
            targetId: loan.id,
            category: "unsafe_transaction",
            details: `Loan return problem — ${loan.itemTitle}: ${String(body.note || "damage/missing reported").slice(0, 400)}. Before/after condition records are on the loan.`,
            signals: JSON.stringify(["Before/after condition records exist on this loan — compare them"]),
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
