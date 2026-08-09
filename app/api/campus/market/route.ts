import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { createLinkedPost } from "@/lib/server/publish";
import { LISTING_TYPES, CAMPUS_CATEGORIES } from "@/lib/campusMarket";
import { requireCampus } from "@/lib/server/campus";

export const dynamic = "force-dynamic";

/** GET — my campus's marketplace (verified members) or a LIMITED public
 *  slice for guests/unverified users: enough to see the value, no meet
 *  spots, capped count. */
export async function GET() {
  return guarded(() => {
    const viewer = getSessionUser();
    const myCampus = viewer
      ? db
          .select()
          .from(tables.campusVerifications)
          .where(and(eq(tables.campusVerifications.userId, viewer.id), eq(tables.campusVerifications.status, "verified")))
          .get()?.campusId ?? null
      : null;

    const campuses = new Map(db.select().from(tables.campuses).all().map((c) => [c.id, c.name]));
    let rows = db
      .select({ l: tables.campusListings, user: tables.users, profile: tables.profiles })
      .from(tables.campusListings)
      .innerJoin(tables.users, eq(tables.campusListings.sellerId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .orderBy(desc(tables.campusListings.createdAt))
      .all()
      .filter((r) => r.user.status === "active" && !["archived"].includes(r.l.status));

    // lazy expiry + auction endings handled at read time
    const now = Date.now();
    for (const r of rows) {
      if (r.l.status === "active" && r.l.expiresAt && r.l.expiresAt.getTime() < now) {
        db.update(tables.campusListings).set({ status: "expired" }).where(eq(tables.campusListings.id, r.l.id)).run();
        r.l.status = "expired";
      }
    }

    const member = !!myCampus;
    if (member) rows = rows.filter((r) => r.l.campusId === myCampus);
    else rows = rows.filter((r) => r.l.status === "active").slice(0, 6); // guest slice

    const allBids = db.select().from(tables.bids).all();
    return {
      member,
      campusName: myCampus ? campuses.get(myCampus) ?? null : null,
      listings: rows.map((r) => ({
        id: r.l.id,
        title: r.l.title,
        description: r.l.description,
        category: r.l.category,
        type: r.l.type,
        price: r.l.price,
        condition: r.l.condition,
        media: (() => { try { return JSON.parse(r.l.media); } catch { return []; } })(),
        quantity: r.l.quantity,
        status: r.l.status,
        campus: campuses.get(r.l.campusId) ?? "Campus",
        // meet spots are member-only information
        meetSpot: member ? r.l.meetSpot : null,
        auctionEndsAt: r.l.auctionEndsAt?.toISOString() ?? null,
        topBid: r.l.type === "auction" ? allBids.filter((b) => b.listingId === r.l.id).reduce((m, b) => Math.max(m, b.amount), 0) || null : null,
        dueBack: r.l.type === "borrow" ? r.l.maxBorrowDays : null,
        seller: publicUser(r.user, r.profile),
        isMine: viewer?.id === r.l.sellerId,
      })),
    };
  });
}

/** POST — create a listing (verified campus members only). */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const campusId = requireCampus(user.id);

    const title = String(body.title || "").trim().slice(0, 80);
    if (!title) throw new ApiError(400, "Give it a title");
    const type = LISTING_TYPES.some((t) => t.id === body.type) ? body.type : "fixed";
    const price = body.price != null && body.price !== "" ? Math.max(0, Math.round(Number(body.price) || 0)) : null;
    if (["fixed", "negotiable", "auction"].includes(type) && (!price || price < 1))
      throw new ApiError(400, type === "auction" ? "Set the starting price" : "Set the price");

    const id = randomBytes(12).toString("hex");
    db.insert(tables.campusListings)
      .values({
        id,
        sellerId: user.id,
        campusId,
        title,
        description: String(body.description || "").slice(0, 1500),
        category: (CAMPUS_CATEGORIES as readonly string[]).includes(body.category) ? body.category : "other",
        type,
        price: type === "free" || type === "borrow" || type === "need_borrow" ? null : price,
        condition: ["new", "like_new", "good", "fair"].includes(body.condition) ? body.condition : "",
        media: JSON.stringify(
          Array.isArray(body.media)
            ? body.media.filter((m: unknown) => typeof m === "string" && (m as string).startsWith("data:image/") && (m as string).length < 500_000).slice(0, 4)
            : []
        ),
        quantity: Math.min(500, Math.max(1, Math.round(Number(body.quantity) || 1))),
        fulfillment: JSON.stringify(
          (Array.isArray(body.fulfillment) ? body.fulfillment : ["pickup"]).filter((f: string) =>
            ["pickup", "campus_delivery", "shipping", "flexible"].includes(f)
          )
        ),
        // general spot only — the API never stores private addresses here
        meetSpot: String(body.meetSpot || "").slice(0, 80),
        firstCome: body.firstCome !== false,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        auctionEndsAt: type === "auction" ? new Date(body.auctionEndsAt || Date.now() + 3 * 86400_000) : null,
        reservePrice: type === "auction" && body.reservePrice ? Math.round(Number(body.reservePrice)) : null,
        bidIncrement: type === "auction" ? Math.max(1, Math.round(Number(body.bidIncrement) || 1)) : 1,
        maxBorrowDays: type === "borrow" ? Math.min(60, Math.max(1, Math.round(Number(body.maxBorrowDays) || 7))) : null,
        allowExtensions: body.allowExtensions !== false,
        deposit: type === "borrow" && body.deposit ? Math.round(Number(body.deposit)) : null,
      })
      .run();

    // one canonical listing + one linked feed post (profile + For You)
    if (body.shareToFeed !== false) {
      const label = LISTING_TYPES.find((t) => t.id === type)!.label;
      createLinkedPost({
        userId: user.id,
        refType: "campus",
        refId: id,
        body: `${title}\n${label}${price ? ` · $${price}` : type === "free" ? " · free" : type === "borrow" ? " · borrow — it comes back" : ""} · Campus Marketplace`,
        category: "Campus",
        imageUrl: Array.isArray(body.media) && typeof body.media[0] === "string" && body.media[0].startsWith("data:image/") ? body.media[0] : null,
      });
    }
    return { id };
  });
}
