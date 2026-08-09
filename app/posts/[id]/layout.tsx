import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const row = db
    .select({ post: tables.posts, profile: tables.profiles })
    .from(tables.posts)
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.posts.authorId))
    .where(eq(tables.posts.id, params.id))
    .get();
  if (!row) return { title: "Post" };
  const first = row.post.body.split("\n")[0].slice(0, 70);
  return {
    title: `${row.profile.displayName} on UpNova`,
    description: first,
    openGraph: { title: `${row.profile.displayName} on UpNova`, description: first, type: "article" },
    twitter: { card: "summary_large_image", title: `${row.profile.displayName} on UpNova`, description: first },
  };
}

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
