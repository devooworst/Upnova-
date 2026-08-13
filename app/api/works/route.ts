import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, getSessionUser, guarded, ApiError } from "@/lib/server/auth";
import { publicUser } from "@/lib/server/serialize";
import { normalizeLicenseOptions, WORK_KINDS } from "@/lib/licensing";
import { createLinkedPost } from "@/lib/server/publish";

export const dynamic = "force-dynamic";

/** GET /api/works — the licensing marketplace. Public: previews and terms
 *  are exactly what guests should see; licensing needs an account. */
export async function GET() {
  return guarded(async () => {
    const viewer = await getSessionUser();
    const rows = (await db
      .select({ work: tables.works, user: tables.users, profile: tables.profiles })
      .from(tables.works)
      .innerJoin(tables.users, eq(tables.works.creatorId, tables.users.id))
      .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
      .orderBy(desc(tables.works.createdAt))
      .all())
      .filter((r) => r.work.status === "active" && r.user.status === "active");

    return {
      works: rows.map((r) => ({
        id: r.work.id,
        title: r.work.title,
        kind: r.work.kind,
        description: r.work.description,
        coverUrl: r.work.coverUrl,
        previewUrl: r.work.previewUrl,
        previewLength: r.work.previewLength,
        watermarked: r.work.watermarked,
        options: (() => {
          try { return JSON.parse(r.work.licenseOptions); } catch { return []; }
        })(),
        exclusivelyLicensed: !!r.work.exclusiveLicenseId,
        creator: publicUser(r.user, r.profile),
        isMine: viewer?.id === r.work.creatorId,
      })),
    };
  });
}

/** POST /api/works — publish a licensable work with YOUR license options. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  return guarded(async () => {
    const user = await requireUser();
    const title = String(body.title || "").trim().slice(0, 80);
    if (!title) throw new ApiError(400, "Give the work a title");
    const options = normalizeLicenseOptions(body.options);
    if (!options.length) throw new ApiError(400, "Offer at least one license option — your terms, your prices");

    const dataUrl = (v: unknown, prefix: string, max: number) =>
      typeof v === "string" && v.startsWith(prefix) && v.length < max ? v : null;

    const id = randomBytes(12).toString("hex");
    await db.insert(tables.works)
      .values({
        id,
        creatorId: user.id,
        title,
        kind: WORK_KINDS.some((k) => k.id === body.kind) ? body.kind : "other",
        description: String(body.description || "").slice(0, 1500),
        coverUrl: dataUrl(body.coverUrl, "data:image/", 700_000),
        // preview: an audio/image data-URL. The ORIGINAL file never goes
        // through this API — delivery happens after licensing.
        previewUrl: dataUrl(body.previewUrl, "data:audio/", 900_000) ?? dataUrl(body.previewUrl, "data:image/", 700_000),
        previewLength: Math.min(120, Math.max(5, Math.round(Number(body.previewLength) || 30))),
        watermarked: body.watermarked !== false,
        licenseOptions: JSON.stringify(options),
      })
      .run();
    // one canonical work + one linked feed post (License opens the work)
    const priced = options.filter((o) => o.price != null && o.price > 0).sort((a, b) => a.price! - b.price!)[0];
    await createLinkedPost({
      userId: user.id,
      refType: "work",
      refId: id,
      body: `${title}\n${priced ? `Licenses from $${priced.price}` : options.some((o) => o.price === 0) ? "Free license available" : "Custom licensing"}`,
      category: "Work",
      imageUrl: typeof body.coverUrl === "string" && body.coverUrl.startsWith("data:image/") ? body.coverUrl : null,
    });
    return { id };
  });
}
