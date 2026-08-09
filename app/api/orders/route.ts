import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { desc, eq, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { notify } from "@/lib/server/notify";
import { parseVariants, parseFulfillment, type OrderTracking } from "@/lib/products";

export const dynamic = "force-dynamic";

/** GET /api/orders — my purchases and my sales, with live states. */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const rows = db
      .select()
      .from(tables.orders)
      .where(or(eq(tables.orders.buyerId, user.id), eq(tables.orders.sellerId, user.id)))
      .orderBy(desc(tables.orders.createdAt))
      .all();

    // demo realism: a shipped package whose ETA has passed has arrived —
    // mark delivered so the buyer gets their "confirm receipt" moment
    for (const o of rows) {
      if (o.status === "shipped") {
        try {
          const t = JSON.parse(o.tracking) as OrderTracking;
          if (t.eta && new Date(t.eta).getTime() < Date.now()) {
            db.update(tables.orders).set({ status: "delivered" }).where(eq(tables.orders.id, o.id)).run();
            o.status = "delivered";
            notify({
              userId: o.buyerId,
              actorId: o.sellerId,
              type: "order",
              title: `Delivered — ${o.title}`,
              body: "Confirm you received it to complete the order and release the payout.",
              href: "/orders",
            });
          }
        } catch {}
      }
    }

    const payments = db.select().from(tables.payments).all().filter((p) => p.orderId);
    return {
      orders: rows.map((o) => {
        const otherId = o.buyerId === user.id ? o.sellerId : o.buyerId;
        const otherUser = db.select().from(tables.users).where(eq(tables.users.id, otherId)).get()!;
        const otherProfile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, otherId)).get()!;
        const payment = payments.find((p) => p.orderId === o.id);
        return {
          id: o.id,
          productId: o.productId,
          title: o.title,
          price: o.price,
          qty: o.qty,
          variant: o.variant,
          fulfillment: o.fulfillment,
          note: o.note,
          status: o.status,
          tracking: (() => { try { return JSON.parse(o.tracking); } catch { return {}; } })(),
          paymentStatus: payment?.status ?? null,
          conversationId: o.conversationId,
          myRole: o.buyerId === user.id ? "buyer" : "seller",
          with: publicUser(otherUser, otherProfile),
          createdAt: o.createdAt.toISOString(),
        };
      }),
    };
  });
}

/** POST /api/orders — place an order (UpNova checkout products only). */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const product = db.select().from(tables.products).where(eq(tables.products.id, String(body.productId))).get();
    if (!product || product.status === "archived") throw new ApiError(404, "Product not found");
    if (product.sellerId === user.id) throw new ApiError(400, "You can't buy your own listing");
    if (product.externalUrl)
      throw new ApiError(409, "This product is sold on the seller's website — UpNova checkout doesn't apply");

    const qty = Math.min(10, Math.max(1, Math.round(Number(body.qty) || 1)));
    const available = product.quantity - product.sold;
    if (product.status === "sold_out" || available < qty)
      throw new ApiError(409, available < 1 ? "Sold out" : `Only ${available} left`);

    // variants: buyer's picks must be real options — server-checked
    const groups = parseVariants(product.variants);
    const picks: string[] = [];
    for (const g of groups) {
      const pick = String((body.variants ?? {})[g.name] ?? "");
      if (!g.options.includes(pick)) throw new ApiError(400, `Pick a ${g.name}`);
      picks.push(`${g.name}: ${pick}`);
    }

    const offered = parseFulfillment(product.fulfillment);
    const fulfillment = offered.includes(body.fulfillment) ? body.fulfillment : offered[0];

    const id = randomBytes(12).toString("hex");
    db.insert(tables.orders)
      .values({
        id,
        productId: product.id,
        buyerId: user.id,
        sellerId: product.sellerId,
        title: product.title,
        price: product.price,
        qty,
        variant: picks.join(" · "),
        fulfillment,
        // pickup: NO addresses stored — exact location is arranged in the
        // conversation after confirmation, on purpose
        note: String(body.note || "").slice(0, 300),
      })
      .run();

    return { id, status: "placed", total: product.price * qty };
  });
}
