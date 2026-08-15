import fs from "fs";
import path from "path";

/* ------------------------------------------------------------------ */
/*  /uploads/[name] — serves RUNTIME-uploaded images on the local-disk */
/*  storage backend.                                                   */
/*                                                                     */
/*  Next.js production (`next start`) snapshots public/ at BUILD time: */
/*  files written to public/uploads afterwards exist on disk but 404   */
/*  from the static handler. This route is the fallback — static files */
/*  that were present at build still win; anything newer streams from  */
/*  disk here. Irrelevant on Vercel Blob (absolute blob URLs never hit */
/*  this path), essential everywhere the local-disk backend runs in    */
/*  production mode.                                                   */
/* ------------------------------------------------------------------ */

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const name = params.name;
  // strict allow-list: the exact shape storeImage generates — no
  // traversal, no dotfiles, nothing outside public/uploads
  if (!/^[a-z0-9][\w.-]{0,120}\.(png|jpe?g|gif|webp)$/i.test(name) || name.includes(".."))
    return new Response("Not found", { status: 404 });
  const file = path.join(process.cwd(), "public", "uploads", name);
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });
  const ext = name.split(".").pop()!.toLowerCase();
  return new Response(fs.readFileSync(file), {
    headers: {
      "Content-Type": TYPES[ext] ?? "application/octet-stream",
      // filenames are content-unique (timestamp + random) — cache hard
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
