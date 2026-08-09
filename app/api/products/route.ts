import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { normalizeCategory } from "@/lib/servicePolicies";
import { parseVariants, parseFulfillment } from "@/lib/products";

export const dynamic = "force-dynamic";

/** GET /api/products — the Shop. Public (guests browse; buying needs an account). */
export async function GET() {
  return guarded(() => {
    const viewer = getSessionUser();
    const rows = db
      .select({ product: tables.products, user: tables.users, profile: tables.profiles })
      .from(tables.products)
      .innerJoin(tables.users, eq(tables.products.sellerId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .orderBy(desc(tables.products.createdAt))
      .all()
      .filter((r) => r.product.status !== "archived" && r.user.status === "active");

    return {
      products: rows.map((r) => ({
        id: r.product.id,
        title: r.product.title,
        description: r.product.description,
        price: r.product.price,
        category: r.product.category,
        condition: r.product.condition,
        quantity: r.product.quantity,
        sold: r.product.sold,
        soldOut: r.product.status === "sold_out" || r.product.quantity - r.product.sold < 1,
        variants: parseVariants(r.product.variants),
        fulfillment: parseFulfillment(r.product.fulfillment),
        media: (() => { try { return JSON.parse(r.product.media); } catch { return []; } })(),
        // external checkout is DISCLOSED, never disguised as an UpNova sale
        external: !!r.product.externalUrl,
        seller: publicUser(r.user, r.profile),
        isMine: viewer?.id === r.product.sellerId,
      })),
    };
  });
}

/** POST /api/products — list something for sale. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const title = String(body.title || "").trim().slice(0, 80);
    if (!title) throw new ApiError(400, "Give it a title");
    const price = Math.round(Number(body.price));
    if (!Number.isFinite(price) || price < 1) throw new ApiError(400, "Price must be at least $1");
    const quantity = Math.min(10_000, Math.max(1, Math.round(Number(body.quantity) || 1)));

    const externalUrl = (() => {
      const raw = String(body.externalUrl || "").trim();
      if (!raw) return null;
      try {
        const u = new URL(raw);
        if (!["http:", "https:"].includes(u.protocol)) return null;
        return u.toString().slice(0, 300);
      } catch {
        return null;
      }
    })();
    if (body.externalUrl && !externalUrl) throw new ApiError(400, "External link must be a valid http(s) URL");

    const id = randomBytes(12).toString("hex");
    db.insert(tables.products)
      .values({
        id,
        sellerId: user.id,
        title,
        description: String(body.description || "").slice(0, 1500),
        price,
        category: normalizeCategory(body.category) || "other",
        condition: ["new", "like_new", "used"].includes(body.condition) ? body.condition : "",
        quantity,
        variants: JSON.stringify(parseVariants(JSON.stringify(body.variants ?? []))),
        fulfillment: JSON.stringify(parseFulfillment(JSON.stringify(body.fulfillment ?? ["shipping"]))),
        media: JSON.stringify(
          Array.isArray(body.media)
            ? body.media
                .filter((m: unknown) => typeof m === "string" && (m as string).startsWith("data:image/") && (m as string).length < 700_000)
                .slice(0, 4)
            : []
        ),
        externalUrl,
      })
      .run();
    return { id };
  });
}
