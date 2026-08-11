import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { ogCard, OG_SIZE } from "@/lib/server/ogCard";
import { parseLicenseOptions, WORK_KINDS } from "@/lib/licensing";

export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const row = db
    .select({ work: tables.works, profile: tables.profiles })
    .from(tables.works)
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.works.creatorId))
    .where(eq(tables.works.id, params.id))
    .get();
  if (!row) return ogCard({ overline: "WORK", title: "Mavyn", creator: "", cta: "Open Mavyn" });
  const opts = parseLicenseOptions(row.work.licenseOptions);
  const priced = opts.filter((o) => o.price != null && o.price > 0).sort((a, b) => a.price! - b.price!)[0];
  return ogCard({
    overline: `${(WORK_KINDS.find((k) => k.id === row.work.kind)?.label ?? "WORK").toUpperCase()} · LICENSE`,
    title: row.work.title,
    creator: row.profile.displayName,
    meta: priced ? `Licenses from $${priced.price}` : opts.some((o) => o.price === 0) ? "Free license available" : "Custom licensing",
    cta: "License on Mavyn",
  });
}
