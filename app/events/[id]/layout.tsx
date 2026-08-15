import type { Metadata } from "next";
import { eq, or } from "drizzle-orm";
import { db, tables } from "@/db";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const e = await db
    .select()
    .from(tables.events)
    .where(or(eq(tables.events.id, params.id), eq(tables.events.slug, params.id)))
    .get();
  if (!e) return { title: "Event" };
  // campus events keep their titles out of public metadata surfaces
  if (e.campusId) return { title: "Campus event — Mavyn" };
  return { title: e.title, description: e.description.slice(0, 160) };
}

export default function EventLayout({ children }: { children: React.ReactNode }) {
  return children;
}
