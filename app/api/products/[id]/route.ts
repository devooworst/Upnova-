import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { parseVariants, parseFulfillment } from "@/lib/products";
import { parseReturnPolicy, returnPolicyLines, protectionRules } from "@/lib/protection";

export const dynamic = "force-dynamic";

/**
 * GET /api/products/[id] — the shareable product page. Public: guests see
 * everything (price, variants, fulfillment, the seller's VERIFIED track
 * record) — the account ask happens at Buy. Sold/archived products stay
 * viewable as history.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const viewer = getSessionUser();
    const row = db
      .select({ product: tables.products, user: tables.users, profile: tables.profiles })
      .from(tables.products)
      .innerJoin(tables.users, eq(tables.products.sellerId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(eq(tables.products.id, params.id))
      .get();
    if (!row || row.user.status !== "active") throw new ApiError(404, "Product not found");
    const { product, user, profile } = row;

    // seller history — computed from records, never self-reported.
    // "Here's what UpNova has actually verified", not "trust this person".
    const completedOrders = db
      .select()
      .from(tables.orders)
      .where(eq(tables.orders.sellerId, user.id))
      .all()
      .filter((o) => o.status === "completed").length;
    const reviews = db.select().from(tables.reviews).where(eq(tables.reviews.subjectId, user.id)).all();
    const rating = reviews.length
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null;
    const otherListings = db
      .select()
      .from(tables.products)
      .where(eq(tables.products.sellerId, user.id))
      .all()
      .filter((p) => p.id !== product.id && p.status === "active")
      .slice(0, 4)
      .map((p) => ({ id: p.id, title: p.title, price: p.price }));

    return {
      product: {
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        condition: product.condition,
        quantity: product.quantity,
        sold: product.sold,
        available: Math.max(0, product.quantity - product.sold),
        soldOut: product.status === "sold_out" || product.quantity - product.sold < 1,
        archived: product.status === "archived",
        variants: parseVariants(product.variants),
        fulfillment: parseFulfillment(product.fulfillment),
        media: (() => { try { return JSON.parse(product.media); } catch { return []; } })(),
        external: !!product.externalUrl,
        externalUrl: product.externalUrl,
        // return & protection terms — visible BEFORE any payment
        returnPolicy: parseReturnPolicy(product.returnPolicy),
        returnPolicyLines: returnPolicyLines(parseReturnPolicy(product.returnPolicy)),
        protection: protectionRules(product.price),
        createdAt: product.createdAt.toISOString(),
        seller: publicUser(user, profile),
        sellerStats: {
          completedOrders,
          rating,
          reviewsCount: reviews.length,
          identityVerified: profile.trustLevel === "high-trust",
          businessVerified: user.businessVerified,
          joined: user.createdAt.toISOString(),
        },
        otherListings,
        isMine: viewer?.id === product.sellerId,
      },
    };
  });
}

/** PATCH — seller manages the listing. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const product = db.select().from(tables.products).where(eq(tables.products.id, params.id)).get();
    if (!product) throw new ApiError(404, "Product not found");
    if (product.sellerId !== user.id) throw new ApiError(403, "Not your listing");

    const patch: Partial<typeof tables.products.$inferInsert> = {};
    if (body.price !== undefined) {
      const price = Math.round(Number(body.price));
      if (!Number.isFinite(price) || price < 1) throw new ApiError(400, "Price must be at least $1");
      patch.price = price;
    }
    if (body.quantity !== undefined)
      patch.quantity = Math.min(10_000, Math.max(product.sold, Math.round(Number(body.quantity) || 1)));
    if (["active", "sold_out", "archived"].includes(body.status)) patch.status = body.status;
    if (typeof body.description === "string") patch.description = body.description.slice(0, 1500);
    db.update(tables.products).set(patch).where(eq(tables.products.id, params.id)).run();
    return { ok: true };
  });
}
