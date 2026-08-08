import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { postTrustMap } from "@/lib/server/trust";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/**
 * POST /api/posts/[id]/confirm — "Client Confirmed".
 * Only the counterparty of the post's linked completed transaction can
 * confirm that the work actually happened. The poster can never set this
 * on their own content; nobody else can either.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(() => {
    const user = requireUser();
    const post = db.select().from(tables.posts).where(eq(tables.posts.id, params.id)).get();
    if (!post) throw new ApiError(404, "Post not found");

    const trust = postTrustMap([post], user.id).get(post.id)!;
    if (!trust.verifiedWork) throw new ApiError(409, "This post isn't linked to a completed UpNova transaction");
    if (post.clientConfirmed) return { confirmed: true };
    if (!trust.canConfirm) throw new ApiError(403, "Only the client on the linked transaction can confirm this work");

    db.update(tables.posts).set({ clientConfirmed: true }).where(eq(tables.posts.id, post.id)).run();
    notify({
      userId: post.authorId,
      actorId: user.id,
      type: "post",
      title: `${user.profile.displayName} confirmed your work`,
      body: `"${trust.verifiedWork.title}" now carries a Client Confirmed label.`,
      href: "/profile",
    });
    return { confirmed: true };
  });
}
