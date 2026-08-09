import { cookies } from "next/headers";
import { destroySession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) destroySession(token); // the session row dies server-side either way
  // deletion must match the attributes the cookie was set with —
  // otherwise Secure/Partitioned cookies outlive "logout" in embedded contexts
  cookies().set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return Response.json({ ok: true });
}
