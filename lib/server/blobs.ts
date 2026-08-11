import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";

/* ------------------------------------------------------------------ */
/*  Blob storage — user-uploaded images live on DISK, not in the DB.   */
/*                                                                     */
/*  Uploads arrive as data-URIs from the browser (unchanged UX); the   */
/*  server writes the bytes to public/uploads and stores only the      */
/*  small site-relative path in the database. This keeps rows tiny     */
/*  and queries fast. The interface is deliberately storage-shaped:    */
/*  swapping the file write for S3/R2 later changes ONE function.      */
/*                                                                     */
/*  Anything that isn't a data-URI (http(s) URLs, existing /uploads    */
/*  or /images paths) passes through untouched — full backward         */
/*  compatibility with every row written before this existed.          */
/* ------------------------------------------------------------------ */

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const EXT: Record<string, string> = { png: "png", jpeg: "jpg", jpg: "jpg", gif: "gif", webp: "webp" };
const DATA_URI = /^data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=]+)$/;

/**
 * If `value` is an image data-URI: persist it to disk and return the
 * public path (/uploads/…). Otherwise return the value unchanged.
 * Oversized or malformed data is rejected with null so callers can 400.
 */
export function storeImage(value: string | null | undefined, prefix: string, maxBytes = 1_100_000): string | null {
  if (!value) return null;
  const m = DATA_URI.exec(value);
  if (!m) return value; // URL or existing path — pass through
  const buf = Buffer.from(m[2], "base64");
  if (buf.length === 0 || buf.length > maxBytes) return null;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${prefix}-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${EXT[m[1]]}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}
