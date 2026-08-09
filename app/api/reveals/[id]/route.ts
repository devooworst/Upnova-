import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/** POST — answer a reveal request: accept | decline | never.
 *  Target only. Accepting creates a PRIVATE mutual reveal: both people can
 *  see each other's profile — the community keeps seeing masked identities
 *  (each person's own reveal-privacy setting governs anything more). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const user = requireUser();
    const r = db.select().from(tables.identityReveals).where(eq(tables.identityReveals.id, params.id)).get();
    if (!r) throw new ApiError(404, "Reveal request not found");
    if (r.targetId !== user.id) throw new ApiError(403, "Only the person who was asked can answer");
    if (r.status !== "pending") throw new ApiError(409, "This request was already answered");

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    if (!["accept", "decline", "never"].includes(action)) throw new ApiError(400, "accept, decline, or never");

    db.update(tables.identityReveals)
      .set({ status: action === "accept" ? "accepted" : action === "never" ? "never" : "declined", respondedAt: new Date() })
      .where(eq(tables.identityReveals.id, r.id))
      .run();

    if (action === "accept") {
      // now — and only now — the two see each other
      notify({
        userId: r.requesterId,
        actorId: user.id,
        type: "community",
        title: `${r.targetLabel || "They"} accepted your reveal request`,
        body: "You can now see each other's profiles — privately. The community still sees your masked identities.",
        href: `/communities?tab=reveals`,
      });
    }
    // declines are silent — no rejection notification to farm

    return { ok: true, status: action === "accept" ? "accepted" : action };
  });
}
