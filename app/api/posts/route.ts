import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { storeImage } from "@/lib/server/blobs";
import { validateWorkLink } from "@/lib/server/trust";
import { seedClientConfirmsWork } from "@/lib/server/demo";
import { notify } from "@/lib/server/notify";

export const dynamic = "force-dynamic";

/** POST /api/posts — create a post as the authenticated user. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    // anti-spam: 20 posts per 15 min per account
    const rlp = rateLimit(`post:${user.id}`, 20, 15 * 60_000);
    if (!rlp.ok) throw new ApiError(429, `Slow down — try again in ${Math.ceil(rlp.retryAfterSec / 60)} min`);
    const text = String(body.body || "").trim();
    if (!text) throw new ApiError(400, "Post body is required");
    if (text.length > 2000) throw new ApiError(400, "Post is too long");

    // ---- Trust & Authenticity (lib/trust.ts) ----
    // disclosure is the creator's statement about provenance; attestation is
    // their recorded claim of publishing rights. Neither is "verification".
    const disclosure = ["original", "ai_assisted", "ai_generated", "credited", "unspecified"].includes(body.disclosure)
      ? body.disclosure
      : "unspecified";
    const credit = disclosure === "credited" ? String(body.credit || "").trim().slice(0, 80) : "";
    if (disclosure === "credited" && !credit) throw new ApiError(400, "Credited work needs a name to credit");

    // Verified Work: the ONLY path is a server-validated link to a completed
    // transaction the poster participated in — ids are checked, not trusted
    const link = await validateWorkLink(
      user.id,
      body.projectId ? String(body.projectId) : null,
      body.bookingId ? String(body.bookingId) : null
    );

    const id = randomBytes(12).toString("hex");
    // images live on disk (public/uploads) — the DB stores only the path
    const imageUrl =
      typeof body.imageUrl === "string" && body.imageUrl.startsWith("data:image/") && body.imageUrl.length < 900_000
        ? await storeImage(body.imageUrl, "post")
        : null;
    await db.insert(tables.posts)
      .values({
        id,
        authorId: user.id,
        body: text,
        kind: ["post", "work", "bts", "announcement", "promotion", "content"].includes(body.kind) ? body.kind : "post",
        category: String(body.category || "").trim().slice(0, 30),
        subcategory: String(body.subcategory || "").trim().slice(0, 40),
        imageUrl,
        disclosure,
        attested: body.attested === true,
        credit,
        projectId: link?.kind === "project" ? link.id : null,
        bookingId: link?.kind === "booking" ? link.id : null,
      })
      .run();

    // the linked counterparty is asked to confirm — Client Confirmed comes
    // from THEM, never from the poster
    if (link) {
      await notify({
        userId: link.counterpartyId,
        actorId: user.id,
        type: "post",
        title: `${user.profile.displayName} shared work from ${link.title}`,
        body: "Confirm it happened to add a Client Confirmed label — or ignore this.",
        href: `/creator/${user.handle}`,
      });
      // demo mode: seed counterparties confirm right away
      await seedClientConfirmsWork(id, link.counterpartyId);
    }
    return { id, verifiedWork: !!link };
  });
}
