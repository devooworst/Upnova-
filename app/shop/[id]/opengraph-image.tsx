import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { ogCard, OG_SIZE } from "@/lib/server/ogCard";

export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const row = db
    .select({ product: tables.products, profile: tables.profiles })
    .from(tables.products)
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.products.sellerId))
    .where(eq(tables.products.id, params.id))
    .get();
  if (!row) return ogCard({ overline: "PRODUCT", title: "Mavyn", creator: "", cta: "Open Mavyn" });
  return ogCard({
    overline: `PRODUCT · ${row.product.externalUrl ? "SHOP" : "BUY"}`,
    title: row.product.title,
    creator: row.profile.displayName,
    meta: `$${row.product.price}${row.profile.city && row.profile.locationVisibility !== "hidden" ? ` · ${row.profile.city}, ${row.profile.state}` : ""}`,
    cta: row.product.externalUrl ? "View on Mavyn" : "Buy on Mavyn",
  });
}
