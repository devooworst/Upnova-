import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/portfolio — own portfolio items + completed projects that can
 * become entries. POST { projectId } or { title, kind, mediaUrl } adds one;
 * DELETE ?id= removes; PATCH { id, visible } toggles visibility.
 */
export async function GET() {
  return guarded(() => {
    const user = requireUser();
    const items = db
      .select()
      .from(tables.portfolioItems)
      .where(eq(tables.portfolioItems.userId, user.id))
      .all();
    const completed = db
      .select()
      .from(tables.projects)
      .where(eq(tables.projects.creatorId, user.id))
      .all()
      .filter((p) => ["completed", "reviewed"].includes(p.state))
      .map((p) => {
        const client = db.select().from(tables.profiles).where(eq(tables.profiles.userId, p.clientId)).get();
        const review = db
          .select()
          .from(tables.reviews)
          .where(and(eq(tables.reviews.projectId, p.id), eq(tables.reviews.subjectId, user.id)))
          .get();
        return {
          id: p.id,
          title: p.title,
          client: client?.displayName ?? "Client",
          amount: p.amount,
          rating: review?.rating ?? null,
          inPortfolio: items.some((i) => i.projectId === p.id),
        };
      });
    return { items, completedProjects: completed };
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const id = randomBytes(12).toString("hex");

    if (body.projectId) {
      // add a completed Mavyn project as a verified portfolio entry
      const p = db.select().from(tables.projects).where(eq(tables.projects.id, String(body.projectId))).get();
      if (!p || p.creatorId !== user.id) throw new ApiError(403, "Not your project");
      if (!["completed", "reviewed"].includes(p.state)) throw new ApiError(409, "Only completed projects");
      const existing = db
        .select()
        .from(tables.portfolioItems)
        .where(and(eq(tables.portfolioItems.userId, user.id), eq(tables.portfolioItems.projectId, p.id)))
        .get();
      if (existing) return { id: existing.id };
      const client = db.select().from(tables.profiles).where(eq(tables.profiles.userId, p.clientId)).get();
      db.insert(tables.portfolioItems)
        .values({ id, userId: user.id, title: p.title, kind: "mavyn_project", projectId: p.id, client: client?.displayName ?? "" })
        .run();
      return { id };
    }

    const title = String(body.title || "").trim();
    if (!title) throw new ApiError(400, "Title is required");
    db.insert(tables.portfolioItems)
      .values({
        id,
        userId: user.id,
        title: title.slice(0, 90),
        kind: ["image", "video", "audio", "link", "project"].includes(body.kind) ? body.kind : "link",
        mediaUrl: body.mediaUrl ? String(body.mediaUrl).slice(0, 500) : null,
        client: String(body.client || "").slice(0, 60),
      })
      .run();
    return { id };
  });
}

export async function DELETE(req: NextRequest) {
  return guarded(() => {
    const user = requireUser();
    const id = req.nextUrl.searchParams.get("id") || "";
    db.delete(tables.portfolioItems)
      .where(and(eq(tables.portfolioItems.id, id), eq(tables.portfolioItems.userId, user.id)))
      .run();
    return { ok: true };
  });
}
