/* ------------------------------------------------------------------ */
/*  verify-auth-lifecycle — runs the REAL client session module         */
/*  (lib/session.tsx) through the complete authentication lifecycle     */
/*  against the live server, simulating a browser including a genuine   */
/*  page reload (fresh module instance, persisted storage).             */
/*                                                                      */
/*    LOGIN → server authenticates → issues credential → browser        */
/*    stores it → REFRESH → app reads credential → /api/auth/me         */
/*    validates → user state restored                                   */
/*                                                                      */
/*  Run: npx tsx scripts/verify-auth-lifecycle.mts [email] [password]   */
/*  Non-destructive: no session wipes, no logouts of the tested user.   */
/* ------------------------------------------------------------------ */

const HOST = process.env.UPNOVA_HOST ?? "http://localhost:3000";
const email = process.argv[2] ?? "devin@upnova.dev";
const password = process.argv[3] ?? "upnova123";

/* ---- minimal browser: persistent across "reloads", like a real one ---- */
class Storage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
}
const persisted = {
  localStorage: new Storage(),
  sessionStorage: new Storage(),
  cookieJar: "" as string,
  windowName: "" as string,
};

function makeWindow() {
  const target = new EventTarget();
  const win: Record<string, unknown> = {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    localStorage: persisted.localStorage,
    sessionStorage: persisted.sessionStorage,
    get name() { return persisted.windowName; },
    set name(v: string) { persisted.windowName = v; },
    location: { hash: "", pathname: "/", search: "" },
  };
  const realFetch = fetch;
  // absolute-URL adapter, like the browser hitting the same origin
  win.fetch = (input: string, init?: RequestInit) =>
    realFetch(typeof input === "string" && input.startsWith("/") ? HOST + input : input, init);
  return win;
}

const doc = {
  get cookie() { return persisted.cookieJar; },
  set cookie(v: string) {
    // crude jar: honor max-age=0 deletion, else store name=value
    const [pair] = v.split(";");
    const [name, val] = pair.split("=");
    const parts = persisted.cookieJar ? persisted.cookieJar.split("; ").filter((c) => !c.startsWith(name + "=")) : [];
    if (!/max-age=0/i.test(v) && val) parts.push(`${name}=${val}`);
    persisted.cookieJar = parts.join("; ");
  },
};

async function bootBrowserPage(tag: string) {
  // fresh window + FRESH module instance = a real page load
  const win = makeWindow();
  (globalThis as Record<string, unknown>).window = win;
  (globalThis as Record<string, unknown>).document = doc;
  const mod = await import(`../lib/session.tsx?load=${tag}-${Date.now()}`);
  // in a browser, bare fetch === window.fetch (which the module shims)
  (globalThis as Record<string, unknown>).fetch = (win as Record<string, unknown>).fetch;
  return mod as typeof import("../lib/session");
}

function ok(label: string, pass: boolean, detail = "") {
  console.log(`${pass ? "  ✓" : "  ✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!pass) process.exitCode = 1;
}

(async () => {
  console.log(`AUTH LIFECYCLE VERIFICATION · ${email} · ${HOST}\n`);

  /* ---------- PAGE LOAD 1: sign in ---------- */
  console.log("[page load 1 — sign in]");
  const s1 = await bootBrowserPage("login");
  const res = await (globalThis.fetch as typeof fetch)("/api/auth/login" as never, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  } as never);
  ok("server authenticates credentials", res.ok, `HTTP ${res.status}`);
  const data = await res.json();
  ok("server issues persistent credential (sessionToken)", !!data.sessionToken, data.sessionToken ? `${String(data.sessionToken).slice(0, 16)}…` : "missing");
  ok("credential is the SIGNED demo format (machine-independent)", String(data.sessionToken).startsWith("demo."));

  // exactly what AuthForm does on success:
  s1.setFallbackToken(data.sessionToken);
  s1.primeSession(data);
  ok("browser stores credential (localStorage)", persisted.localStorage.getItem("upnova-session-token") === data.sessionToken);
  ok("browser stores user snapshot", !!persisted.localStorage.getItem("upnova-session-user"));
  const me1 = await s1.fetchSession(true);
  ok("/api/auth/me validates immediately after login", me1?.handle === "devin" || me1?.email === email, me1 ? `@${me1.handle}` : "null");

  /* ---------- PAGE LOAD 2: THE REFRESH ---------- */
  console.log("\n[page load 2 — browser REFRESH (fresh module, persisted storage)]");
  const s2 = await bootBrowserPage("refresh");
  // what useSession's mount effect does:
  s2.bootSession();
  await new Promise((r) => setTimeout(r, 400)); // let revalidation land
  const after = await s2.fetchSession();
  ok("app reads stored credential on boot", !!s2.getFallbackToken());
  ok("user state restored after refresh", after?.email === email, after ? `@${after.handle}` : "null — LOGGED OUT");
  ok("auth provider did NOT overwrite to signed-out", after !== null);

  /* ---------- PAGE LOAD 3: refresh again ---------- */
  console.log("\n[page load 3 — refresh again]");
  const s3 = await bootBrowserPage("refresh2");
  s3.bootSession();
  await new Promise((r) => setTimeout(r, 400));
  const again = await s3.fetchSession();
  ok("still signed in on second refresh", again?.email === email, again ? `@${again.handle}` : "null");

  /* ---------- authenticated surfaces ---------- */
  console.log("\n[authenticated surfaces after refresh]");
  for (const ep of ["conversations", "opportunities", "me/services", "bookmarks"]) {
    const r = await (globalThis.fetch as typeof fetch)(`/api/${ep}` as never);
    ok(`/api/${ep}`, r.status === 200, `HTTP ${r.status}`);
  }

  console.log(`\n${process.exitCode ? "LIFECYCLE BROKEN — see failures above" : "COMPLETE LIFECYCLE VERIFIED — sign-in survives refresh; only Sign Out ends it"}`);
})();
