import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const row = db
    .select({ product: tables.products, profile: tables.profiles })
    .from(tables.products)
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.products.sellerId))
    .where(eq(tables.products.id, params.id))
    .get();
  if (!row) return { title: "Product" };
  const desc = `${row.profile.displayName} · $${row.product.price}${row.product.externalUrl ? " · external checkout" : " — funds held until delivery"} · UpNova Shop.`;
  return {
    title: row.product.title,
    description: desc,
    openGraph: { title: `${row.product.title} • UpNova`, description: desc, type: "website" },
    twitter: { card: "summary_large_image", title: `${row.product.title} • UpNova`, description: desc },
  };
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
