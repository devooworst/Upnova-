import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { ApiError } from "@/lib/server/auth";

/* ------------------------------------------------------------------ */
/*  Blob storage — user-uploaded images NEVER live in the database.    */
/*                                                                     */
/*  Uploads arrive as data-URIs from the browser (unchanged UX); the   */
/*  server persists the bytes and stores only the resulting URL/path   */
/*  in the database. Two backends behind ONE function:                 */
/*                                                                     */
/*    BLOB_READ_WRITE_TOKEN set  → Vercel Blob (production/preview —   */
/*                                 Vercel's fs is read-only)           */
/*    otherwise                  → public/uploads on disk (local dev,  */
/*                                 sandbox, CI — no external service)  */
/*                                                                     */
/*  FAILURES ARE LOUD AND SPECIFIC. On Vercel without the Blob token   */
/*  there is NO writable storage — that's a 503 naming the missing     */
/*  configuration, never a generic 500 from an EROFS crash. A Blob     */
/*  API failure is a 502 carrying the real reason. Callers therefore   */
/*  never need to guess why an upload vanished.                        */
/*                                                                     */
/*  Anything that isn't a data-URI (http(s) URLs, existing /uploads    */
/*  or /images paths) passes through untouched — full backward         */
/*  compatibility with every row written before this existed.          */
/* ------------------------------------------------------------------ */

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const EXT: Record<string, string> = { png: "png", jpeg: "jpg", jpg: "jpg", gif: "gif", webp: "webp" };
const MIME: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
const DATA_URI = /^data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=]+)$/;

export const BLOB_NOT_CONFIGURED =
  "Image uploads aren't configured on this deployment — the Vercel Blob store isn't connected (BLOB_READ_WRITE_TOKEN is missing for this environment). In Vercel: Storage → your Blob store → Connect Project → select this project AND the Preview environment, then redeploy.";

/** Which storage backend this process would use — surfaced by /api/debug/session. */
export function uploadsBackend(): "vercel-blob" | "local-disk" | "NOT_CONFIGURED" {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "vercel-blob";
  if (process.env.VERCEL) return "NOT_CONFIGURED"; // read-only fs, no token → uploads cannot work
  return "local-disk";
}

/**
 * If `value` is an image data-URI: persist it (Vercel Blob in
 * production, public/uploads locally) and return the public URL.
 * Otherwise return the value unchanged.
 * Oversized or malformed data is rejected with null so callers can 400.
 * Storage-layer failures THROW an ApiError with the honest reason.
 */
export async function storeImage(
  value: string | null | undefined,
  prefix: string,
  maxBytes = 1_100_000
): Promise<string | null> {
  if (!value) return null;
  const m = DATA_URI.exec(value);
  if (!m) return value; // URL or existing path — pass through
  const buf = Buffer.from(m[2], "base64");
  if (buf.length === 0 || buf.length > maxBytes) return null;
  const name = `${prefix}-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${EXT[m[1]]}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    // Vercel Blob — the only writable storage on Vercel's read-only fs
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(`uploads/${name}`, buf, {
        access: "public",
        contentType: MIME[m[1]],
        addRandomSuffix: false,
      });
      return blob.url;
    } catch (err) {
      throw new ApiError(
        502,
        `Image upload to storage failed: ${err instanceof Error ? err.message : "unknown Blob error"}. The Blob token may be invalid for this environment — check the store's project connection in Vercel → Storage.`
      );
    }
  }

  // No token on Vercel = read-only fs and nowhere to write. Say exactly
  // what's missing instead of crashing with EROFS.
  if (process.env.VERCEL) throw new ApiError(503, BLOB_NOT_CONFIGURED);

  // Local dev / sandbox: plain disk under public/uploads
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM")
      throw new ApiError(503, BLOB_NOT_CONFIGURED);
    throw err;
  }
  return `/uploads/${name}`;
}
