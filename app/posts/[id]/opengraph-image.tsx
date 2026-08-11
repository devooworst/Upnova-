import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { ogCard, OG_SIZE } from "@/lib/server/ogCard";

export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const row = db
    .select({ post: tables.posts, profile: tables.profiles })
    .from(tables.posts)
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.posts.authorId))
    .where(eq(tables.posts.id, params.id))
    .get();
  if (!row) return ogCard({ overline: "POST", title: "Mavyn", creator: "", cta: "Open Mavyn" });
  const overline = row.post.refType ? `${row.post.refType.toUpperCase()}` : row.post.kind === "work" ? "WORK POST" : "POST";
  return ogCard({
    overline,
    title: row.post.body.split("\n")[0],
    creator: row.profile.displayName,
    meta: row.profile.city && row.profile.locationVisibility !== "hidden" ? `${row.profile.city}, ${row.profile.state}` : undefined,
    cta: "View on Mavyn",
  });
}
