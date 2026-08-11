import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { parseLicenseOptions } from "@/lib/licensing";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const row = db
    .select({ work: tables.works, profile: tables.profiles })
    .from(tables.works)
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.works.creatorId))
    .where(eq(tables.works.id, params.id))
    .get();
  if (!row) return { title: "Work" };
  const opts = parseLicenseOptions(row.work.licenseOptions);
  const priced = opts.filter((o) => o.price != null && o.price > 0).sort((a, b) => a.price! - b.price!)[0];
  const desc = `${row.profile.displayName} · ${priced ? `licenses from $${priced.price}` : "custom licensing"} — stream the preview, license on the creator's terms.`;
  return {
    title: row.work.title,
    description: desc,
    openGraph: { title: `${row.work.title} • Mavyn`, description: desc, type: "website" },
    twitter: { card: "summary_large_image", title: `${row.work.title} • Mavyn`, description: desc },
  };
}

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
