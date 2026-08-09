import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { notify } from "@/lib/server/notify";
import { conversationBetween } from "@/lib/server/oppFlow";
import { requireCampus } from "@/lib/server/campus";

export const dynamic = "force-dynamic";

const rid = () => randomBytes(12).toString("hex");

function getListing(id: string) {
  const row = db
    .select({ l: tables.campusListings, user: tables.users, profile: tables.profiles })
    .from(tables.campusListings)
    .innerJoin(tables.users, eq(tables.campusListings.sellerId, tables.users.id))
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
    .where(eq(tables.campusListings.id, id))
    .get();
  if (!row || row.user.status !== "active") throw new ApiError(404, "Listing not found");
  return row;
}

/** Lazy auction settlement: past end time → winner (top bid ≥ reserve)
 *  gets notified + a payment-pending order; no valid bids → expired. */
function settleAuction(l: typeof tables.campusListings.$inferSelect) {
  if (l.type !== "auction" || l.status !== "active" || !l.auctionEndsAt || l.auctionEndsAt.getTime() > Date.now()) return l;
  const top = db.select().from(tables.bids).where(eq(tables.bids.listingId, l.id)).orderBy(desc(tables.bids.amount)).get();
  if (top && (!l.reservePrice || top.amount >= l.reservePrice)) {
    const orderId = rid();
    db.insert(tables.orders)
      .values({
        id: orderId, productId: null, buyerId: top.bidderId, sellerId: l.sellerId,
        title: `${l.title} (campus auction)`, price: top.amount, qty: 1,
        fulfillment: "pickup", note: "Campus auction win — pay within 48h to secure it",
      })
      .run();
    db.update(tables.campusListings).set({ status: "reserved", claimedById: top.bidderId }).where(eq(tables.campusListings.id, l.id)).run();
    notify({
      userId: top.bidderId, actorId: l.sellerId, type: "order",
      title: `You won the auction — ${l.title}`,
      body: `$${top.amount} · pay within 48h in Orders to secure it`,
      href: "/orders", priority: "high",
    });
    notify({
      userId: l.sellerId, actorId: top.bidderId, type: "order",
      title: `Auction ended — ${l.title} sold for $${top.amount}`,
      body: "The winner has 48h to pay.", href: "/orders",
    });
    l.status = "reserved";
  } else {
    db.update(tables.campusListings).set({ status: "expired" }).where(eq(tables.campusListings.id, l.id)).run();
    notify({
      userId: l.sellerId, type: "order",
      title: `Auction ended without a qualifying bid — ${l.title}`,
      body: l.reservePrice ? `Reserve $${l.reservePrice} wasn't met.` : "No bids came in.",
      href: `/campus/market/${l.id}`, priority: "normal",
    });
    l.status = "expired";
  }
  return l;
}

/** GET — listing detail. Public but limited for non-members. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const viewer = getSessionUser();
    const row = getListing(params.id);
    settleAuction(row.l);
    const { l, user, profile } = row;
    const member = viewer
      ? !!db
          .select()
          .from(tables.campusVerifications)
          .where(and(eq(tables.campusVerifications.userId, viewer.id), eq(tables.campusVerifications.status, "verified"), eq(tables.campusVerifications.campusId, l.campusId)))
          .get()
      : false;
    const campus = db.select().from(tables.campuses).where(eq(tables.campuses.id, l.campusId)).get();

    const bidRows = db.select().from(tables.bids).where(eq(tables.bids.listingId, l.id)).orderBy(desc(tables.bids.amount)).all();
    const names = new Map(db.select().from(tables.profiles).all().map((p) => [p.userId, p.displayName]));

    // seller reputation — computed, never self-reported
    const completedOrders = db.select().from(tables.orders).where(eq(tables.orders.sellerId, user.id)).all().filter((o) => o.status === "completed").length;
    const completedLoans = db.select().from(tables.loans).where(eq(tables.loans.lenderId, user.id)).all().filter((x) => x.status === "completed").length;
    const reviews = db.select().from(tables.reviews).where(eq(tables.reviews.subjectId, user.id)).all();
    const doneListings = db.select().from(tables.campusListings).where(eq(tables.campusListings.sellerId, user.id)).all().filter((x) => x.status === "completed").length;

    return {
      listing: {
        id: l.id,
        title: l.title,
        description: l.description,
        category: l.category,
        type: l.type,
        price: l.price,
        condition: l.condition,
        media: (() => { try { return JSON.parse(l.media); } catch { return []; } })(),
        quantity: l.quantity,
        claimed: l.claimed,
        status: l.status,
        campus: campus?.name ?? "Campus",
        fulfillment: (() => { try { return JSON.parse(l.fulfillment); } catch { return ["pickup"]; } })(),
        meetSpot: member ? l.meetSpot : null,
        firstCome: l.firstCome,
        expiresAt: l.expiresAt?.toISOString() ?? null,
        auctionEndsAt: l.auctionEndsAt?.toISOString() ?? null,
        reservePrice: l.reservePrice != null ? true : false, // reserve existence only, never the number
        bidIncrement: l.bidIncrement,
        bids: bidRows.slice(0, 10).map((b) => ({ by: names.get(b.bidderId) ?? "—", amount: b.amount, at: b.createdAt.toISOString(), mine: viewer?.id === b.bidderId })),
        topBid: bidRows[0]?.amount ?? null,
        maxBorrowDays: l.maxBorrowDays,
        allowExtensions: l.allowExtensions,
        deposit: l.deposit,
        claimedByMe: viewer != null && l.claimedById === viewer.id,
        member,
        seller: publicUser(user, profile),
        sellerRep: {
          campusVerified: true,
          completedOrders: completedOrders + doneListings,
          completedLoans,
          rating: reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : null,
          reviewsCount: reviews.length,
          joined: user.createdAt.toISOString(),
        },
        isMine: viewer?.id === l.sellerId,
      },
    };
  });
}

/**
 * POST { action } — the transaction verbs, all campus-member gated:
 *   claim (free, FCFS) · bid (auction) · buy (fixed → protected order) ·
 *   borrow {from, until, message} · offer_lend (need_borrow) ·
 *   message (negotiable/trade — the conversation IS the negotiation)
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    requireCampus(user.id);
    const row = getListing(params.id);
    settleAuction(row.l);
    const l = row.l;
    const action = String(body.action);
    if (l.sellerId === user.id && action !== "complete" && action !== "archive")
      throw new ApiError(400, "That's your own listing");

    if (action === "claim") {
      if (l.type !== "free") throw new ApiError(409, "Only free items are claimed — this one isn't free");
      if (l.status !== "active") throw new ApiError(409, "Already claimed");
      // FCFS: first claim reserves it
      db.update(tables.campusListings).set({ status: "reserved", claimedById: user.id }).where(eq(tables.campusListings.id, l.id)).run();
      const convId = conversationBetween(user.id, l.sellerId);
      db.insert(tables.messages).values({ id: rid(), conversationId: convId, senderId: user.id, kind: "system", body: `${user.profile.displayName} claimed "${l.title}" — arrange the campus pickup here. Free items are first-come-first-served.` }).run();
      db.update(tables.conversations).set({ updatedAt: new Date() }).where(eq(tables.conversations.id, convId)).run();
      notify({ userId: l.sellerId, actorId: user.id, type: "order", title: `Claimed — ${l.title}`, body: `${user.profile.displayName} claimed it. Arrange the handoff in Messages, then mark it completed.`, href: `/campus/market/${l.id}` });
      return { status: "reserved", conversationId: convId };
    }

    if (action === "bid") {
      if (l.type !== "auction") throw new ApiError(409, "This isn't an auction");
      if (l.status !== "active" || !l.auctionEndsAt || l.auctionEndsAt.getTime() < Date.now())
        throw new ApiError(409, "This auction has ended");
      const top = db.select().from(tables.bids).where(eq(tables.bids.listingId, l.id)).orderBy(desc(tables.bids.amount)).get();
      const minBid = top ? top.amount + l.bidIncrement : l.price ?? 1;
      const amount = Math.round(Number(body.amount));
      if (!Number.isFinite(amount) || amount < minBid)
        throw new ApiError(409, `Minimum bid is $${minBid}${top ? ` (current $${top.amount} + $${l.bidIncrement} increment)` : " (starting price)"}`);
      db.insert(tables.bids).values({ id: rid(), listingId: l.id, bidderId: user.id, amount }).run();
      if (top && top.bidderId !== user.id)
        notify({ userId: top.bidderId, actorId: user.id, type: "order", title: `Outbid — ${l.title}`, body: `New top bid $${amount}. Auction ends ${l.auctionEndsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`, href: `/campus/market/${l.id}`, priority: "normal" });
      notify({ userId: l.sellerId, actorId: user.id, type: "order", title: `New bid — ${l.title}`, body: `$${amount}`, href: `/campus/market/${l.id}`, priority: "low" });
      return { topBid: amount };
    }

    if (action === "buy") {
      if (l.type !== "fixed") throw new ApiError(409, "This listing isn't fixed-price — message the seller instead");
      if (l.status !== "active" || l.quantity - l.claimed < 1) throw new ApiError(409, "No longer available");
      // straight into the PROTECTED order system: held funds, protection
      // window, disputes — same machinery as the worldwide Shop
      const orderId = rid();
      const convId = conversationBetween(user.id, l.sellerId);
      db.insert(tables.orders)
        .values({
          id: orderId, productId: null, buyerId: user.id, sellerId: l.sellerId,
          title: `${l.title} (campus)`, price: l.price ?? 0, qty: 1,
          fulfillment: "pickup", note: l.meetSpot ? `Meet: ${l.meetSpot}` : "Campus pickup",
          conversationId: convId,
        })
        .run();
      db.update(tables.campusListings).set({ claimed: l.claimed + 1, status: l.claimed + 1 >= l.quantity ? "reserved" : "active", claimedById: user.id }).where(eq(tables.campusListings.id, l.id)).run();
      return { orderId, status: "placed" };
    }

    if (action === "borrow") {
      // a structured BORROWING REQUEST: when it's needed, when it comes
      // back (both date + approx time), how the exchange happens, and an
      // optional message — the owner accepts, declines, or messages
      if (l.type !== "borrow") throw new ApiError(409, "This item isn't listed for borrowing");
      if (l.status !== "active") throw new ApiError(409, "Not available right now");

      const neededAt = new Date(body.neededAt);
      if (isNaN(neededAt.getTime())) throw new ApiError(400, "When do you need it? Pick a date and time");
      if (neededAt.getTime() < Date.now() - 3600_000) throw new ApiError(400, "The needed-by time is in the past");

      const dueAt = new Date(body.until);
      if (isNaN(dueAt.getTime())) throw new ApiError(400, "Pick an expected return date and time");
      if (dueAt.getTime() <= neededAt.getTime()) throw new ApiError(400, "The return time has to be after you get the item");
      if (l.maxBorrowDays && dueAt.getTime() > neededAt.getTime() + l.maxBorrowDays * 86400_000)
        throw new ApiError(409, `${row.profile.displayName} lends this for up to ${l.maxBorrowDays} day${l.maxBorrowDays > 1 ? "s" : ""}`);

      const exchangeMethod = ["campus_meetup", "pickup", "dropoff", "custom"].includes(body.exchangeMethod)
        ? body.exchangeMethod
        : "campus_meetup";
      const exchangeNote = String(body.exchangeNote || "").slice(0, 200);
      if (exchangeMethod === "custom" && !exchangeNote.trim())
        throw new ApiError(400, "Describe the custom exchange arrangement");

      const loanId = rid();
      const convId = conversationBetween(user.id, l.sellerId);
      db.insert(tables.loans)
        .values({
          id: loanId, listingId: l.id, lenderId: l.sellerId, borrowerId: user.id,
          itemTitle: l.title, message: String(body.message || "").slice(0, 300),
          neededAt, dueAt, exchangeMethod, exchangeNote,
          deposit: l.deposit, conversationId: convId,
        })
        .run();
      const fmt = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" });
      notify({ userId: l.sellerId, actorId: user.id, type: "order", title: `Borrow request — ${l.title}`, body: `${user.profile.displayName} · needs it ${fmt(neededAt)} · returns ${fmt(dueAt)}${body.message ? ` · "${String(body.message).slice(0, 60)}"` : ""}`, href: "/campus/market?loans=1", priority: "high" });
      return { loanId, status: "requested", conversationId: convId };
    }

    if (action === "offer_lend") {
      if (l.type !== "need_borrow") throw new ApiError(409, "This isn't a borrow request");
      const convId = conversationBetween(user.id, l.sellerId);
      db.insert(tables.messages).values({ id: rid(), conversationId: convId, senderId: user.id, body: `I can lend mine! Saw your "${l.title}" request on the Campus Marketplace — when do you need it?` }).run();
      db.update(tables.conversations).set({ updatedAt: new Date() }).where(eq(tables.conversations.id, convId)).run();
      notify({ userId: l.sellerId, actorId: user.id, type: "message", title: `Someone can lend you one — ${l.title}`, body: `${user.profile.displayName} offered theirs. Work out the loan in Messages.`, href: `/messages?c=${convId}` });
      return { conversationId: convId };
    }

    if (action === "message") {
      const convId = conversationBetween(user.id, l.sellerId);
      const intro = l.type === "trade" ? `Trade offer for "${l.title}" — here's what I've got:` : `Hi! About "${l.title}"${l.price ? ` (listed $${l.price} OBO)` : ""} — would you take `;
      db.insert(tables.messages).values({ id: rid(), conversationId: convId, senderId: user.id, body: String(body.text || intro).slice(0, 500) }).run();
      db.update(tables.conversations).set({ updatedAt: new Date() }).where(eq(tables.conversations.id, convId)).run();
      notify({ userId: l.sellerId, actorId: user.id, type: "message", title: `${user.profile.displayName} — ${l.title}`, body: String(body.text || "New offer").slice(0, 80), href: `/messages?c=${convId}` });
      return { conversationId: convId };
    }

    // ---- seller management ----
    if (action === "complete") {
      if (l.sellerId !== user.id) throw new ApiError(403, "Only the seller completes a listing");
      db.update(tables.campusListings).set({ status: "completed" }).where(eq(tables.campusListings.id, l.id)).run();
      if (l.claimedById)
        notify({ userId: l.claimedById, actorId: user.id, type: "order", title: `Completed — ${l.title}`, body: "Thanks for keeping it on campus.", href: `/campus/market/${l.id}`, priority: "low" });
      return { status: "completed" };
    }
    if (action === "archive") {
      if (l.sellerId !== user.id) throw new ApiError(403, "Only the seller archives a listing");
      db.update(tables.campusListings).set({ status: "archived" }).where(eq(tables.campusListings.id, l.id)).run();
      return { status: "archived" };
    }

    throw new ApiError(400, "Unknown action");
  });
}
