import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { parseConfig, priceLabel } from "@/lib/servicePolicies";

/* server-side metadata so shared links unfurl with real content —
   the client page underneath stays the interactive source of truth */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const row = await db
    .select({ service: tables.services, profile: tables.profiles })
    .from(tables.services)
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.services.ownerId))
    .where(eq(tables.services.id, params.id))
    .get();
  if (!row) return { title: "Service" };
  const cfg = parseConfig(row.service.config);
  const desc = `${row.profile.displayName} · ${priceLabel(cfg, row.service.price)}${row.profile.city && row.profile.locationVisibility !== "hidden" ? ` · ${row.profile.city}, ${row.profile.state}` : ""} — book through Mavyn.`;
  return {
    title: row.service.title,
    description: desc,
    openGraph: { title: `${row.service.title} • Mavyn`, description: desc, type: "website" },
    twitter: { card: "summary_large_image", title: `${row.service.title} • Mavyn`, description: desc },
  };
}

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
