import { NextRequest } from "next/server";
import { and, eq, inArray, or } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { findCommunity, getMembership, logMod } from "@/lib/server/communities";

export const dynamic = "force-dynamic";

/** POST — reveal the account behind a masked post/comment, for moderation.
 *
 *  Deliberately narrow: only the COMMUNITY OWNER or a PLATFORM ADMIN, and
 *  only when the content has actually been reported (open/reviewing) — a
 *  reveal needs a legitimate moderation reason, not curiosity. Every
 *  reveal is written to the append-only mod log. The identity goes to the
 *  moderator alone: never to the reporter, never to the membership. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = await requireUser();
    const c = findCommunity(params.id);
    if (!c) throw new ApiError(404, "Community not found");

    const isAdmin = user.role === "admin";
    const m = getMembership((await c)!.id, user.id);
    if (!isAdmin && (!m || (await m)!.role !== "owner"))
      throw new ApiError(403, "Identity reveals are limited to the community owner and Mavyn moderation");

    const body = await req.json().catch(() => ({}));
    const postId = body.postId ? String(body.postId) : null;
    const commentId = body.commentId ? String(body.commentId) : null;
    if (!postId && !commentId) throw new ApiError(400, "Which post or reply?");

    let authorId: string | null = null;
    let targetType = "";
    let targetId = "";
    if (postId) {
      const p = await db
        .select()
        .from(tables.communityPosts)
        .where(and(eq(tables.communityPosts.id, postId), eq(tables.communityPosts.communityId, (await c)!.id)))
        .get();
      if (!p) throw new ApiError(404, "Post not found");
      if (p!.identity === "real") throw new ApiError(400, "That post already carries the author's profile identity");
      authorId = p!.authorId;
      targetType = "community_post";
      targetId = p!.id;
    } else if (commentId) {
      const cm = await db.select().from(tables.communityComments).where(eq(tables.communityComments.id, commentId)).get();
      if (!cm) throw new ApiError(404, "Reply not found");
      if (cm.identity === "real") throw new ApiError(400, "That reply already carries the author's profile identity");
      authorId = cm.authorId;
      targetType = "community_comment";
      targetId = cm.id;
    }

    // a reveal must be tied to an actual report on this content
    const report = await db
      .select()
      .from(tables.reports)
      .where(
        and(
          eq(tables.reports.targetType, targetType),
          eq(tables.reports.targetId, targetId),
          inArray(tables.reports.status, ["open", "reviewing"])
        )
      )
      .get();
    if (!report)
      throw new ApiError(
        409,
        "No open report on that content — identity reveals are only available while investigating a report"
      );

    const author = await db
      .select({ u: tables.users, p: tables.profiles })
      .from(tables.users)
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(eq(tables.users.id, authorId!))
      .get();
    if (!author) throw new ApiError(404, "Author account not found");

    await logMod({
      communityId: (await c)!.id,
      actorId: user.id,
      action: "reveal_author",
      targetType: targetType === "community_post" ? "post" : "comment",
      targetId,
      note: `report ${report!.id}`,
    });

    // handle + display name only — never email, phone, or location
    return {
      revealed: {
        handle: author!.u.handle,
        displayName: author!.p.displayName,
        reportId: report!.id,
      },
      logged: true,
    };
  });
}
