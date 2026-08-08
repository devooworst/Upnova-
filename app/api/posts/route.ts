import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** POST /api/posts — create a post as the authenticated user. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(() => {
    const user = requireUser();
    const text = String(body.body || "").trim();
    if (!text) throw new ApiError(400, "Post body is required");
    if (text.length > 2000) throw new ApiError(400, "Post is too long");

    const id = randomBytes(12).toString("hex");
    db.insert(tables.posts)
      .values({
        id,
        authorId: user.id,
        body: text,
        kind: ["post", "opportunity", "service", "poll", "event"].includes(body.kind) ? body.kind : "post",
      })
      .run();
    return { id };
  });
}
