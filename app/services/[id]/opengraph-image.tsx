import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { ogCard, OG_SIZE } from "@/lib/server/ogCard";
import { parseConfig, priceLabel } from "@/lib/servicePolicies";

export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const row = db
    .select({ service: tables.services, profile: tables.profiles })
    .from(tables.services)
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.services.ownerId))
    .where(eq(tables.services.id, params.id))
    .get();
  if (!row) return ogCard({ overline: "SERVICE", title: "UpNova", creator: "", cta: "Open UpNova" });
  const cfg = parseConfig(row.service.config);
  return ogCard({
    overline: `SERVICE · ${row.service.fulfillment === "appointment" ? "BOOK" : "REQUEST"}`,
    title: row.service.title,
    creator: row.profile.displayName,
    meta: `${priceLabel(cfg, row.service.price)}${row.profile.city && row.profile.locationVisibility !== "hidden" ? ` · ${row.profile.city}, ${row.profile.state}` : ""}`,
    cta: row.service.fulfillment === "appointment" ? "Book on UpNova" : "Request on UpNova",
  });
}
