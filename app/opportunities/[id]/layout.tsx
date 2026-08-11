import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const row = db
    .select({ opp: tables.opportunities, profile: tables.profiles })
    .from(tables.opportunities)
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.opportunities.posterId))
    .where(eq(tables.opportunities.id, params.id))
    .get();
  if (!row) return { title: "Opportunity" };
  const desc = `${row.profile.displayName}${row.opp.budget != null ? ` · $${row.opp.budget}` : ""} · ${row.opp.remote ? "Remote" : row.opp.location} — apply through Mavyn.`;
  return {
    title: row.opp.title,
    description: desc,
    openGraph: { title: `${row.opp.title} • Mavyn`, description: desc, type: "website" },
    twitter: { card: "summary_large_image", title: `${row.opp.title} • Mavyn`, description: desc },
  };
}

export default function OppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
