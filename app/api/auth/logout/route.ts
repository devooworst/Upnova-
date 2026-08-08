import { cookies } from "next/headers";
import { destroySession, SESSION_COOKIE } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) destroySession(token);
  cookies().delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
