import { NextRequest, NextResponse } from "next/server";

/* ------------------------------------------------------------------ */
/*  CSRF origin guard.                                                 */
/*                                                                     */
/*  The session cookie is SameSite=None in embedded/HTTPS contexts     */
/*  (required there), which re-opens classic cross-site request        */
/*  forgery: another site could fire a credentialed POST at our API.   */
/*  Defense: every STATE-CHANGING /api request that carries an Origin  */
/*  header must originate from THIS host. Same-origin app fetches      */
/*  always pass; browser-based cross-site requests always fail.        */
/*  Non-browser clients (curl, tests) send no Origin and are           */
/*  unaffected — CSRF is strictly a browser attack.                    */
/*                                                                     */
/*  This ADDS a control; it never replaces cookie security. HttpOnly,  */
/*  Secure, SameSite, and server-side sessions all stay exactly as     */
/*  they are.                                                          */
/* ------------------------------------------------------------------ */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function middleware(req: NextRequest) {
  if (SAFE_METHODS.has(req.method)) return NextResponse.next();

  const origin = req.headers.get("origin");
  if (!origin) return NextResponse.next(); // non-browser client

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return NextResponse.json({ error: "Rejected: malformed Origin" }, { status: 403 });
  }

  // the host the browser addressed — behind the preview proxy that's the
  // forwarded host, locally it's the plain Host header
  const selfHost = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase();

  if (originHost !== selfHost)
    return NextResponse.json(
      { error: "Rejected: cross-site request. UpNova's API only accepts requests from its own pages." },
      { status: 403 }
    );

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
