import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { ogCard, OG_SIZE } from "@/lib/server/ogCard";
import { parseRoles, rolesSummary } from "@/lib/opportunityRoles";

export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const row = db
    .select({ opp: tables.opportunities, profile: tables.profiles })
    .from(tables.opportunities)
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.opportunities.posterId))
    .where(eq(tables.opportunities.id, params.id))
    .get();
  if (!row) return ogCard({ overline: "OPPORTUNITY", title: "UpNova", creator: "", cta: "Open UpNova" });
  const roles = rolesSummary(parseRoles(row.opp.roles));
  return ogCard({
    overline: "OPPORTUNITY · APPLY",
    title: row.opp.title,
    creator: row.profile.displayName,
    meta: [row.opp.budget != null ? `$${row.opp.budget}` : null, row.opp.remote ? "Remote" : row.opp.location, roles].filter(Boolean).join(" · "),
    cta: "Apply on UpNova",
  });
}
