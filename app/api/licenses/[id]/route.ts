import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { notify } from "@/lib/server/notify";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

/** PATCH /api/licenses/[id] { action: "confirm" } — the licensee confirms
 *  delivery of the licensed files → payout releases. Licensee only. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const lic = await db.select().from(tables.licenses).where(eq(tables.licenses.id, params.id)).get();
    if (!lic) throw new ApiError(404, "License not found");
    if (String(body.action) !== "confirm") throw new ApiError(400, "Unknown action");
    if (lic.licenseeId !== user.id) throw new ApiError(403, "Only the licensee confirms delivery");
    if (lic.status !== "issued") throw new ApiError(409, `Nothing to confirm from "${lic.status}"`);

    await db.update(tables.licenses).set({ status: "completed" }).where(eq(tables.licenses.id, lic.id)).run();
    await db.update(tables.payments)
      .set({ status: "released" })
      .where(and(eq(tables.payments.licenseId, lic.id), eq(tables.payments.status, "held")))
      .run();
    if (lic.conversationId) {
      await db.insert(tables.messages)
        .values({
          id: randomBytes(12).toString("hex"),
          conversationId: lic.conversationId,
          senderId: user.id,
          kind: "system",
          body: `License ${lic.id.slice(0, 8).toUpperCase()} completed — delivery confirmed, $${lic.price} released to the creator.`,
        })
        .run();
      await db.update(tables.conversations).set({ updatedAt: new Date() }).where(eq(tables.conversations.id, lic.conversationId)).run();
    }
    await notify({
      userId: lic.creatorId, actorId: user.id, type: "payment",
      title: `License completed — $${lic.price} released`,
      body: lic.workTitle, href: "/works?licenses=1", category: "payments",
    });
    return { status: "completed" };
  });
}
