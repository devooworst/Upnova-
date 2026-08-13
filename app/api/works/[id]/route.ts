import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { notify } from "@/lib/server/notify";
import { conversationBetween } from "@/lib/server/oppFlow";
import { parseLicenseOptions } from "@/lib/licensing";
import { seedCreatorDeliversLicense } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

/** GET /api/works/[id] — public work page: preview, the creator's license
 *  options with full terms, and the creator's VERIFIED track record. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const viewer = await getSessionUser();
    const row = await db
      .select({ work: tables.works, user: tables.users, profile: tables.profiles })
      .from(tables.works)
      .innerJoin(tables.users, eq(tables.works.creatorId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .where(eq(tables.works.id, params.id))
      .get();
    if (!row || row!.user.status !== "active") throw new ApiError(404, "Work not found");
    const { work, user, profile } = await row;

    const workLicenses = await db.select().from(tables.licenses).where(eq(tables.licenses.workId, work.id)).all();
    const creatorLicenses = await db.select().from(tables.licenses).where(eq(tables.licenses.creatorId, user.id)).all();
    const myLicense = viewer ? workLicenses.find((l) => l.licenseeId === viewer.id) : undefined;

    return {
      work: {
        id: work.id,
        title: work.title,
        kind: work.kind,
        description: work.description,
        coverUrl: work.coverUrl,
        previewUrl: work.previewUrl,
        previewLength: work.previewLength,
        watermarked: work.watermarked,
        options: parseLicenseOptions(work.licenseOptions),
        exclusivelyLicensed: !!work.exclusiveLicenseId,
        archived: work.status === "archived",
        licensesIssued: workLicenses.length,
        createdAt: work.createdAt.toISOString(),
        creator: publicUser(user, profile),
        creatorStats: {
          worksLicensed: creatorLicenses.length,
          identityVerified: profile.trustLevel === "high-trust",
          businessVerified: user.businessVerified,
        },
        myLicense: myLicense
          ? { id: myLicense.id, optionName: myLicense.optionName, status: myLicense.status }
          : null,
        isMine: viewer?.id === work.creatorId,
      },
    };
  });
}

/** PATCH — creator manages the work (archive/unarchive). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const work = await db.select().from(tables.works).where(eq(tables.works.id, params.id)).get();
    if (!work) throw new ApiError(404, "Work not found");
    if (work.creatorId !== user.id) throw new ApiError(403, "Not your work");
    if (["active", "archived"].includes(body.status))
      await db.update(tables.works).set({ status: body.status }).where(eq(tables.works.id, work.id)).run();
    return { ok: true };
  });
}

/**
 * POST /api/works/[id]/license — handled here to keep the work lifecycle in
 * one file: { optionId } → creates the LICENSE RECORD (creator, purchaser,
 * work, type, permitted usage, restrictions, date, price, transaction id).
 * Priced licenses secure payment (held → released on delivery confirm);
 * free licenses complete instantly; quote options route to the conversation.
 * Exclusive purchases stop all further licensing of the work.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const work = await db.select().from(tables.works).where(eq(tables.works.id, params.id)).get();
    if (!work || work.status !== "active") throw new ApiError(404, "Work not found");
    if (work.creatorId === user.id) throw new ApiError(400, "You can't license your own work");
    if (work.exclusiveLicenseId)
      throw new ApiError(409, "This work has been exclusively licensed — no further licenses are available");

    const option = parseLicenseOptions(work.licenseOptions).find((o) => o.id === String(body.optionId));
    if (!option) throw new ApiError(400, "Pick one of the creator's license options");

    // quote/custom options are negotiated — the conversation IS the flow
    if (option.price == null) {
      const convId = await conversationBetween(user.id, work.creatorId);
      await db.insert(tables.messages)
        .values({
          id: randomBytes(12).toString("hex"),
          conversationId: convId,
          senderId: user.id,
          body: `Hi! I'm interested in the "${option.name}" license for "${work.title}" — can we talk terms?`,
        })
        .run();
      await db.update(tables.conversations).set({ updatedAt: new Date() }).where(eq(tables.conversations.id, convId)).run();
      await notify({
        userId: work.creatorId, actorId: user.id, type: "message",
        title: `License inquiry — ${work.title}`,
        body: `${user.profile.displayName} wants to discuss "${option.name}"`,
        href: `/messages?c=${convId}`,
      });
      return { negotiation: true, conversationId: convId };
    }

    // transaction authentication for priced licenses (buyer pays 5% on top)
    const totalCents = Math.round(option.price * 105);
    if (body.expectedTotal != null && Math.round(Number(body.expectedTotal) * 100) !== totalCents)
      throw new ApiError(409, `The total changed — it is now $${(totalCents / 100).toFixed(2)}. Review before paying.`);

    const licenseId = randomBytes(12).toString("hex");
    const convId = await conversationBetween(user.id, work.creatorId);
    const free = option.price === 0;

    await db.insert(tables.licenses)
      .values({
        id: licenseId,
        workId: work.id,
        creatorId: work.creatorId,
        licenseeId: user.id,
        workTitle: work.title,
        licenseType: option.type,
        optionName: option.name,
        permittedUsage: option.usage,
        restrictions: option.restrictions,
        attribution: option.attribution,
        price: option.price,
        status: free ? "completed" : "issued",
        conversationId: convId,
      })
      .run();

    if (!free) {
      await db.insert(tables.payments)
        .values({
          id: randomBytes(12).toString("hex"),
          licenseId,
          payerId: user.id,
          payeeId: work.creatorId,
          amountCents: option.price * 100,
          feeCents: Math.round(option.price * 5),
          status: "held",
        })
        .run();
    }
    if (option.type === "exclusive")
      await db.update(tables.works).set({ exclusiveLicenseId: licenseId }).where(eq(tables.works.id, work.id)).run();

    await db.insert(tables.messages)
      .values({
        id: randomBytes(12).toString("hex"),
        conversationId: convId,
        senderId: user.id,
        kind: "system",
        body: `License ${licenseId.slice(0, 8).toUpperCase()} issued — "${work.title}" · ${option.name}${free ? " (free)" : ` · $${(totalCents / 100).toFixed(2)} secured`}${option.attribution ? " · attribution required" : ""}.${option.type === "exclusive" ? " Exclusive: further licensing of this work has stopped." : ""}${free ? "" : " Funds release when the licensee confirms delivery."}`,
      })
      .run();
    await db.update(tables.conversations).set({ updatedAt: new Date() }).where(eq(tables.conversations.id, convId)).run();

    await notify({
      userId: work.creatorId, actorId: user.id, type: "payment",
      title: `${free ? "Free license issued" : "License sold"} — ${work.title}`,
      body: `${option.name}${free ? "" : ` · $${option.price} secured — deliver the files to complete`}`,
      href: `/messages?c=${convId}`,
      category: "payments",
    });

    // demo: seed creators deliver instantly in chat
    if (!free) await seedCreatorDeliversLicense(licenseId);

    return { licenseId, status: free ? "completed" : "issued", conversationId: convId };
  });
}
