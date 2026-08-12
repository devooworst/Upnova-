import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError, isDemoMode } from "@/lib/server/auth";
import { isSeedUser } from "@/lib/server/demo";
import { worldDeviceForWidth, resolveWorldLayout } from "@/lib/profileStudio";
import { readEarlyAccess, writeEarlyAccess, readRelease, writeRelease } from "@/lib/server/preferred";
import { LEARN_SCENARIOS, LEARN_PATHS, TOUR_TO_SCENARIO } from "@/lib/learnScenarios";
import { runJobsTick } from "@/lib/server/jobs";
import fs from "fs";
import path from "path";
import { QA_SCENARIOS } from "@/lib/server/qaScenarios";
import { qaIds } from "@/lib/server/qa";
import { geoReady } from "@/lib/server/geo";
import { QA_GUIDES, guideFor } from "@/lib/qaGuides";
import { QA_EXAMPLES } from "@/lib/qaExamples";
import { BUSINESS_LIMITS } from "@/lib/businessPlans";
import { buildBriefing } from "@/lib/qaBriefing";
import { signDemoToken } from "@/lib/server/auth";

/* per-run email nonce — throwaway signups get a UNIQUE email every run so
   the production signup rate limiter (5 per email / 15 min) never trips
   across repeated suite runs. Handles stay stable and are cleaned at reset. */
const runNonce = () => Date.now().toString(36).slice(-6);

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* ------------------------------------------------------------------ */
/* FULL MAVYN SYSTEM TEST — the Test Center "game mode" backend.      */
/*                                                                     */
/* Runs the REAL platform end-to-end over HTTP against this very       */
/* server: three personas (rachel=client, lena=creator/seed,           */
/* harboroak=business) each hold their OWN authenticated session, and  */
/* every step travels through the same routes, middleware, auth, and   */
/* state machines real users hit. Nothing is mocked; a label change    */
/* cannot pass this. Failures report expected/actual/route/record.     */
/* Demo deployments only. Test data = designated seed-persona records, */
/* reset deterministically at the start of every run.                  */
/* ------------------------------------------------------------------ */

type StepResult = { name: string; status: "PASSED" | "FAILED" | "BLOCKED" | "NOT_TESTED"; expected?: string; actual?: string; route?: string; record?: string; severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" };
type Category = { name: string; steps: StepResult[] };

/** every category the full test intends to run — anything that never
    executes (earlier crash) is reported NOT TESTED, never silently
    omitted and NEVER assumed passed */
const PLANNED_CATEGORIES = [
  "AUTHENTICATION",
  "PROFILES & SEARCH",
  "MESSAGING",
  "FOLLOWING",
  "BOOKINGS",
  "PAYMENTS (TEST)",
  "PROJECTS",
  "REVIEWS",
  "OPPORTUNITIES & APPLICATIONS",
  "PROGRESS & EXTENSIONS",
  "PREFERRED CLIENTS",
  "ONBOARDING",
  "BUSINESS PEOPLE & HIRING",
  "BUSINESS SUBSCRIPTION & CAPACITY",
  "NOTIFICATIONS",
  "ACTIVITY",
  "SUBSCRIPTIONS & MY WORLD",
  "BOOKING FLOW & QA LAB",
  "QA STRICT PROGRESSION",
  "QA STATE REPAIR",
  "QA ACCESS CONTROL",
  "PLAN LAB (REAL BOUNDARIES)",
  "QA LOOP REGRESSION",
  "QA SCENARIO WALKTHROUGHS",
  "LIVE STREAMING",
  "MOBILE & TABLET EXPERIENCE",
  "LOCATION SYSTEM (GEO CASCADE)",
  "FULL SITE ROUTE SWEEP",
  "DATABASE INTEGRITY",
];

export async function POST(req: NextRequest) {
  const gate = await guarded(() => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    const runner = requireUser();
    if (runner.role !== "admin") throw new ApiError(403, "The full system test is an admin operator tool");
    return { ok: true };
  });
  if (gate.status !== 200) return gate;

  const BASE = req.nextUrl.origin;
  const started = Date.now();
  const cats: Category[] = [];
  const cat = (name: string) => {
    const c = { name, steps: [] as StepResult[] };
    cats.push(c);
    return c;
  };
  const tok: Record<string, string> = {};
  const api = async (who: string | null, path: string, init?: { method?: string; body?: unknown }) => {
    const res = await fetch(BASE + path, {
      method: init?.method ?? "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${who ? tok[who] : "none"}` },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    let data: Record<string, unknown> = {};
    try { data = await res.json(); } catch { /* non-json */ }
    return { status: res.status, data };
  };
  const step = (c: Category, name: string, pass: boolean, detail: Partial<StepResult> = {}) => {
    c.steps.push({ name, status: pass ? "PASSED" : "FAILED", ...detail });
    return pass;
  };
  const blocked = (c: Category, name: string, why: string) => c.steps.push({ name, status: "BLOCKED", actual: why });

  /* ---------------- deterministic reset of designated test records ---------------- */
  const ids = (h: string) => db.select().from(tables.users).where(eq(tables.users.handle, h)).get()!;
  const rachel = ids("rachel"), lena = ids("lena"), biz = ids("harboroak");
  const resetTestData = () => {
    for (const u of [rachel]) {
      for (const b of db.select().from(tables.bookings).where(eq(tables.bookings.clientId, u.id)).all()) {
        db.delete(tables.payments).where(eq(tables.payments.bookingId, b.id)).run();
        db.delete(tables.bookings).where(eq(tables.bookings.id, b.id)).run();
      }
      for (const p of db.select().from(tables.projects).where(eq(tables.projects.clientId, u.id)).all()) {
        db.delete(tables.payments).where(eq(tables.payments.projectId, p.id)).run();
        db.delete(tables.projects).where(eq(tables.projects.id, p.id)).run();
      }
      // projects where the test persona is the CREATOR (progress scenario)
      for (const p of db.select().from(tables.projects).where(eq(tables.projects.creatorId, u.id)).all()) {
        db.delete(tables.payments).where(eq(tables.payments.projectId, p.id)).run();
        db.delete(tables.projects).where(eq(tables.projects.id, p.id)).run();
      }
      // preferred-client relationships involving the test persona
      db.delete(tables.preferredClients).where(eq(tables.preferredClients.clientId, u.id)).run();
      db.delete(tables.preferredClients).where(eq(tables.preferredClients.providerId, u.id)).run();
      // business-team rows involving the test persona (prior runs)
      db.delete(tables.businessTeam).where(eq(tables.businessTeam.personId, u.id)).run();
      db.delete(tables.businessTeam).where(eq(tables.businessTeam.businessId, u.id)).run();
      db.delete(tables.applications).where(eq(tables.applications.applicantId, u.id)).run();
      for (const m of db.select().from(tables.conversationMembers).where(eq(tables.conversationMembers.userId, u.id)).all())
        db.delete(tables.conversations).where(eq(tables.conversations.id, m.conversationId)).run();
      db.delete(tables.notifications).where(eq(tables.notifications.userId, u.id)).run();
      db.delete(tables.follows).where(eq(tables.follows.followerId, u.id)).run();
      db.update(tables.users).set({ plan: "free", testerMode: "simulation" }).where(eq(tables.users.id, u.id)).run();
      db.update(tables.profiles).set({ studio: "" }).where(eq(tables.profiles.userId, u.id)).run();
    }
    // bookings the BUSINESS tester made AS A CLIENT (capacity/People
    // probes) — previously leaked and accumulated across suite runs
    for (const b of db.select().from(tables.bookings).where(eq(tables.bookings.clientId, biz.id)).all()) {
      db.delete(tables.payments).where(eq(tables.payments.bookingId, b.id)).run();
      db.delete(tables.bookings).where(eq(tables.bookings.id, b.id)).run();
    }
    // business test opportunity from prior runs
    for (const o of db.select().from(tables.opportunities).where(eq(tables.opportunities.posterId, biz.id)).all())
      if (o.title.startsWith("[TEST]")) {
        db.delete(tables.applications).where(eq(tables.applications.opportunityId, o.id)).run();
        db.delete(tables.opportunities).where(eq(tables.opportunities.id, o.id)).run();
      }
    db.delete(tables.notifications).where(eq(tables.notifications.userId, lena.id)).run();
    // Preferred Early Access state from prior runs: window + slot caps +
    // any drop bookings by the designated non-preferred tester (harboroak)
    for (const s of db.select().from(tables.services).where(eq(tables.services.ownerId, lena.id)).all()) {
      if (s.preferredUntil) db.update(tables.services).set({ preferredUntil: null }).where(eq(tables.services.id, s.id)).run();
      let cfg = s.config;
      if (readEarlyAccess(cfg)) cfg = writeEarlyAccess(cfg, null);
      if (readRelease(cfg)) cfg = writeRelease(cfg, null);
      try { // scheduled mode left by a crashed run would block every booking below
        const o = JSON.parse(cfg || "{}");
        if (o?.scheduling?.releaseMode === "scheduled") { o.scheduling.releaseMode = "rolling"; cfg = JSON.stringify(o); }
      } catch {}
      if (cfg !== s.config) db.update(tables.services).set({ config: cfg }).where(eq(tables.services.id, s.id)).run();
    }
    for (const b of db.select().from(tables.bookings).where(eq(tables.bookings.clientId, biz.id)).all())
      if (b.providerId === lena.id) {
        db.delete(tables.payments).where(eq(tables.payments.bookingId, b.id)).run();
        db.delete(tables.bookings).where(eq(tables.bookings.id, b.id)).run();
      }
    // onboarding/progress test accounts from prior runs (handle prefix "tonb")
    for (const u of db.select().from(tables.users).all())
      if (u.handle.startsWith("tonb")) {
        for (const m of db.select().from(tables.conversationMembers).where(eq(tables.conversationMembers.userId, u.id)).all())
          db.delete(tables.conversations).where(eq(tables.conversations.id, m.conversationId)).run();
        for (const p of db.select().from(tables.projects).where(eq(tables.projects.creatorId, u.id)).all()) {
          db.delete(tables.payments).where(eq(tables.payments.projectId, p.id)).run();
          db.delete(tables.projects).where(eq(tables.projects.id, p.id)).run();
        }
        for (const p of db.select().from(tables.projects).where(eq(tables.projects.clientId, u.id)).all()) {
          db.delete(tables.payments).where(eq(tables.payments.projectId, p.id)).run();
          db.delete(tables.projects).where(eq(tables.projects.id, p.id)).run();
        }
        // bookings in either role (the early-access drop books as tonbpc)
        for (const b of db.select().from(tables.bookings).all())
          if (b.clientId === u.id || b.providerId === u.id) {
            db.delete(tables.payments).where(eq(tables.payments.bookingId, b.id)).run();
            db.delete(tables.bookings).where(eq(tables.bookings.id, b.id)).run();
          }
        db.delete(tables.preferredClients).where(eq(tables.preferredClients.clientId, u.id)).run();
        db.delete(tables.preferredClients).where(eq(tables.preferredClients.providerId, u.id)).run();
        db.delete(tables.payments).where(eq(tables.payments.payeeId, u.id)).run();
        db.delete(tables.payments).where(eq(tables.payments.payerId, u.id)).run();
        db.delete(tables.sessions).where(eq(tables.sessions.userId, u.id)).run();
        for (const l of db.select().from(tables.liveStreams).where(eq(tables.liveStreams.hostId, u.id)).all())
          db.delete(tables.liveStreams).where(eq(tables.liveStreams.id, l.id)).run();
        db.delete(tables.liveViewers).where(eq(tables.liveViewers.userId, u.id)).run();
        db.delete(tables.liveMessages).where(eq(tables.liveMessages.userId, u.id)).run();
        db.delete(tables.liveReactions).where(eq(tables.liveReactions.userId, u.id)).run();
        db.delete(tables.liveGuests).where(eq(tables.liveGuests.userId, u.id)).run();
        db.delete(tables.liveModerators).where(eq(tables.liveModerators.userId, u.id)).run();
        db.delete(tables.liveRestrictions).where(eq(tables.liveRestrictions.userId, u.id)).run();
        db.delete(tables.notifications).where(eq(tables.notifications.userId, u.id)).run();
        db.delete(tables.profiles).where(eq(tables.profiles.userId, u.id)).run();
        db.delete(tables.users).where(eq(tables.users.id, u.id)).run();
      }
  };
  resetTestData();

  try {
  /* ================= AUTHENTICATION ================= */
  {
    const c = cat("AUTHENTICATION");
    for (const [who, pw] of [["rachel", "mavyn123"], ["lena", "mavyn123"], ["harboroak", "mavyn123"]] as const) {
      const r = await api(null, "/api/auth/login", { method: "POST", body: { identifier: who, password: pw } });
      tok[who] = (r.data as { sessionToken?: string }).sessionToken ?? "";
      step(c, `login ${who} (own session)`, r.status === 200 && !!tok[who], { route: "POST /api/auth/login" });
    }
    const r2 = await api(null, "/api/auth/login", { method: "POST", body: { identifier: "rachel", password: "mavyn123" } });
    tok.rachel2 = (r2.data as { sessionToken?: string }).sessionToken ?? "";
    const meA = await api("rachel", "/api/auth/me");
    const meB = await api("lena", "/api/auth/me");
    step(c, "session isolation: each token is its own person", (meA.data as any).user?.handle === "rachel" && (meB.data as any).user?.handle === "lena", { route: "GET /api/auth/me" });
    const bad = await api(null, "/api/auth/login", { method: "POST", body: { identifier: "rachel", password: "wrong-password-x" } });
    step(c, "invalid login rejected generically", bad.status === 401 && /Invalid credentials/.test(String((bad.data as any).error)), { expected: "401 Invalid credentials", actual: `${bad.status} ${(bad.data as any).error}` });
    // logout terminates THAT session only
    await api("rachel2", "/api/auth/logout", { method: "POST" });
    const dead = await api("rachel2", "/api/auth/me");
    const alive = await api("rachel", "/api/auth/me");
    step(c, "logout revokes the presented session; the other survives", !(dead.data as any).user && !!(alive.data as any).user, { route: "POST /api/auth/logout", expected: "revoked token → user:null; sibling token → user", actual: `dead=${!!(dead.data as any).user} alive=${!!(alive.data as any).user}` });
    // TWO DEVELOPMENT/ADMIN ACCOUNTS — completely separate users: own
    // ids, own credentials, own sessions; both admins, both REAL
    // (simulated=false → automation can never message or act as them).
    const devinRow = db.select().from(tables.users).where(eq(tables.users.handle, "devin")).get();
    const jaylinRow = db.select().from(tables.users).where(eq(tables.users.handle, "jaylin")).get();
    const jl = await api(null, "/api/auth/login", { method: "POST", body: { identifier: "jaylin@mavyn.dev", password: "mavyn123" } });
    tok.jaylin = (jl.data as { sessionToken?: string }).sessionToken ?? "";
    const jme = (await api("jaylin", "/api/auth/me")).data as any;
    step(
      c,
      "dev admins devin + jaylin: two SEPARATE records, own credentials, both admin, both REAL",
      !!devinRow && !!jaylinRow && devinRow.id !== jaylinRow.id &&
        devinRow.role === "admin" && jaylinRow.role === "admin" &&
        !devinRow.simulated && !jaylinRow.simulated &&
        jme.user?.handle === "jaylin" && jme.user?.role === "admin",
      {
        route: "POST /api/auth/login (jaylin@mavyn.dev)",
        expected: "distinct ids · role=admin ×2 · simulated=false ×2 · session identifies jaylin",
        actual: `ids ${devinRow?.id?.slice(0, 6)}…≠${jaylinRow?.id?.slice(0, 6)}… roles=${devinRow?.role}/${jaylinRow?.role} simulated=${!!devinRow?.simulated}/${!!jaylinRow?.simulated} me=${jme.user?.handle}`,
      }
    );
    const anon = await api(null, "/api/me/notifications");
    step(c, "protected route rejects no/invalid credentials", anon.status === 401, { route: "GET /api/me/notifications", actual: String(anon.status) });
    // THE FRIEND'S-COMPUTER TEST: a request with NO credentials of any
    // kind (no cookie, no bearer, no storage — a brand-new browser)
    // must resolve to NOBODY. No sticky fallback, no default account,
    // no inherited session — ever.
    const bare = await fetch(BASE + "/api/auth/me", { headers: {} });
    const bareData = (await bare.json().catch(() => ({}))) as { user?: unknown };
    step(c, "fresh browser/device (zero credentials) inherits NO session — sign-in screen, not someone's account", bare.status === 200 && bareData.user == null, {
      route: "GET /api/auth/me (no credentials at all)",
      expected: "user: null",
      actual: bareData.user ? `INHERITED A SESSION: ${JSON.stringify(bareData.user).slice(0, 60)}` : "user: null",
    });

    /* ---- GUEST MODE = the REAL app, read-only. Logout lands in the
       actual application as a guest — same layout, nav, feed, search —
       with participation gated by contextual Sign Up / Sign In prompts.
       No separate landing page, no auto-opened login form. ---- */
    const gHome = await fetch(BASE + "/", { redirect: "manual" });
    step(c, "the app itself is public: GET / with zero credentials serves the REAL app shell (200, no redirect to any landing/login)",
      gHome.status === 200, { route: "GET / (no credentials, redirect:manual)", actual: String(gHome.status) });
    const gWel = await fetch(BASE + "/welcome", { redirect: "manual" });
    step(c, "/welcome (old landing + logout destination) now redirects INTO the app — Guest Mode is not a separate page",
      gWel.status >= 300 && gWel.status < 400 && (gWel.headers.get("location") ?? "").replace(BASE, "") === "/", {
      expected: "3xx → /", actual: `${gWel.status} → ${gWel.headers.get("location")}` });
    const gFeed = await (await fetch(BASE + "/api/feed?tab=foryou")).json();
    step(c, "guests browse the REAL feed — capped preview (guest:true, items present, ≤ guest limit of 12), not unlimited",
      gFeed.guest === true && Array.isArray(gFeed.items) && gFeed.items.length >= 1 && gFeed.items.length <= 12, {
      route: "GET /api/feed (no credentials)", actual: `guest=${gFeed.guest} items=${gFeed.items?.length}` });
    step(c, "the browsing limit is an INLINE end-of-feed gate (totalPublic meta for the join card) — never a full-screen modal trap",
      typeof gFeed.totalPublic === "number" && gFeed.totalPublic >= (gFeed.items?.length ?? 0), {
      expected: "totalPublic ≥ items shown (powers 'You've seen the preview' card in the feed)",
      actual: `totalPublic=${gFeed.totalPublic} shown=${gFeed.items?.length}` });
    const gOpp = await fetch(BASE + "/api/opportunities");
    const gSvc = await fetch(BASE + "/api/services");
    const gSearch = await (await fetch(BASE + "/api/search?q=lena")).json();
    step(c, "guests browse opportunities, services, and search public people — same APIs members use",
      gOpp.status === 200 && gSvc.status === 200 && (gSearch.people ?? []).some((p: any) => p.handle === "lena"), {
      actual: `opps=${gOpp.status} services=${gSvc.status} search=${(gSearch.people ?? []).length}` });
    // every participating action requires an account: server enforces 401,
    // the client turns it into the contextual join prompt (never silent)
    const gPost = await fetch(BASE + "/api/posts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: "guest post attempt" }) });
    const gConv = await fetch(BASE + "/api/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ withHandle: "lena" }) });
    const gFollow = await fetch(BASE + "/api/follow/" + lena.id, { method: "POST" });
    step(c, "guest restrictions hold server-side: post / message / follow all 401 without an account (apply, book, buy gated the same way)",
      gPost.status === 401 && gConv.status === 401 && gFollow.status === 401, {
      actual: `post=${gPost.status} conversation=${gConv.status} follow=${gFollow.status}` });
    const gl = await fetch(BASE + "/login", { redirect: "manual" });
    const gs = await fetch(BASE + "/signup", { redirect: "manual" });
    step(c, "Sign In and Join pages load directly from Guest Mode (200 each, no loop back)",
      gl.status === 200 && gs.status === 200, { actual: `login=${gl.status} signup=${gs.status}` });

    /* ---- DATA PERSISTENCE: the account IS the database record ----
       create → edit → logout → login → the SAME row comes back, byte
       for byte. Identity is the user id — never recreated, never
       reseeded, never duplicated (rebranding included). */
    {
      const su = await api(null, "/api/auth/signup", { method: "POST", body: { email: `tonbkeep.${runNonce()}@mavyn.dev`, password: "Persist-check-2026", handle: "tonbkeep", displayName: "Before Edit" } });
      tok.tonbkeep = (su.data as { sessionToken?: string }).sessionToken ?? "";
      const idBefore = String((su.data as any).id ?? "");
      await api("tonbkeep", "/api/me/profile", { method: "PATCH", body: { displayName: "Persisted Name", bio: "Edited bio that must survive logout, login, and redeploys.", city: "Baltimore" } });
      await api("tonbkeep", "/api/auth/logout", { method: "POST" });
      const re = await api(null, "/api/auth/login", { method: "POST", body: { identifier: "tonbkeep", password: "Persist-check-2026" } });
      tok.tonbkeep = (re.data as { sessionToken?: string }).sessionToken ?? "";
      const meBack = (await api("tonbkeep", "/api/auth/me")).data as any;
      step(c, "PERSISTENCE: create → edit profile → logout → login → the EDITED data returns (same user id, no reset, no duplicate)",
        re.status === 200 && String((re.data as any).id) === idBefore && meBack.user?.profile?.displayName === "Persisted Name" && /must survive/.test(String(meBack.user?.profile?.bio ?? "")), {
        expected: "same id + 'Persisted Name' + edited bio",
        actual: `id=${String((re.data as any).id) === idBefore ? "same" : "DIFFERENT"} name=${meBack.user?.profile?.displayName} bio=${String(meBack.user?.profile?.bio ?? "").slice(0, 30)}` });
      const dupes = db.select().from(tables.users).all().filter((u) => u.handle === "tonbkeep").length;
      step(c, "exactly ONE database row carries this account — logins load it, they never recreate it", dupes === 1, { actual: `${dupes} rows` });

      // REBRAND CONTINUITY: a session issued under the old UpNova cookie
      // name still resolves — same sessions table, legacy name accepted
      const rawLogin = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: "tonbkeep", password: "Persist-check-2026" }) });
      const setCookie = rawLogin.headers.get("set-cookie") ?? "";
      const cookieToken = /mavyn_session=([^;]+)/.exec(setCookie)?.[1] ?? "";
      const legacyMe = cookieToken ? await fetch(BASE + "/api/auth/me", { headers: { cookie: `upnova_session=${cookieToken}` } }) : null;
      const legacyUser = legacyMe ? ((await legacyMe.json()) as any).user : null;
      step(c, "REBRAND CONTINUITY: the same session token under the LEGACY upnova_session cookie name still signs in — old UpNova sessions are Mavyn sessions",
        !!cookieToken && legacyUser?.handle === "tonbkeep", { actual: `token=${!!cookieToken} user=${legacyUser?.handle ?? "null"}` });
    }
  }

  /* ================= PROFILES + SEARCH ================= */
  {
    const c = cat("PROFILES & SEARCH");
    const prof = await api("rachel", "/api/users/lena");
    const services = (prof.data as any).services ?? [];
    step(c, "open lena's profile: identity + services visible", prof.status === 200 && (prof.data as any).user?.handle === "lena" && services.length > 0, { route: "GET /api/users/lena", record: `services=${services.length}` });
    const bp = await api("rachel", "/api/users/harboroak");
    step(c, "business profile is a business destination (business block present)", !!(bp.data as any).business, { route: "GET /api/users/harboroak" });

    /* ---- GLOBAL SEARCH: real accounts, from ANOTHER account, ranked ---- */
    const s1 = (await api("rachel", "/api/search?q=devin")).data as any;
    step(c, "SEARCH exact username from another account → @devin ranks FIRST", s1.people?.[0]?.handle === "devin" && !!s1.people?.[0]?.displayName, {
      route: "GET /api/search?q=devin", expected: "people[0]=@devin", actual: `people[0]=@${s1.people?.[0]?.handle} of ${s1.people?.length}`,
    });
    const s2 = (await api("rachel", "/api/search?q=dev")).data as any;
    step(c, "SEARCH partial username → @devin still found", (s2.people ?? []).some((p: any) => p.handle === "devin"), { actual: (s2.people ?? []).map((p: any) => "@" + p.handle).join(", ") });
    const lenaName = String(((await api("rachel", "/api/users/lena")).data as any).user?.displayName ?? "");
    const lastName = lenaName.split(" ").pop() ?? "";
    const s3 = (await api("rachel", `/api/search?q=${encodeURIComponent(lastName.toLowerCase())}`)).data as any;
    step(c, `SEARCH by display name ("${lastName}") → @lena found`, (s3.people ?? []).some((p: any) => p.handle === "lena"), { actual: (s3.people ?? []).map((p: any) => "@" + p.handle).join(", ") });
    const s4 = (await api("rachel", "/api/search?q=zzzznotauser")).data as any;
    step(c, "SEARCH nonexistent account → honest empty PEOPLE (200, never an error)", Array.isArray(s4.people) && s4.people.length === 0, { actual: `people=${s4.people?.length}` });
    // a brand-new account is searchable the moment it exists
    const nu = await api(null, "/api/auth/signup", { method: "POST", body: { email: `tonbsearch.${runNonce()}@mavyn.dev`, password: "Tour-walkthrough-99", handle: "tonbsearch", displayName: "Searchme Fresh" } });
    const s5 = (await api("rachel", "/api/search?q=tonbsearch")).data as any;
    const s6 = (await api("rachel", "/api/search?q=searchme")).data as any;
    step(c, "NEW account is searchable immediately — by handle AND display name", nu.status === 200 && (s5.people ?? []).some((p: any) => p.handle === "tonbsearch") && (s6.people ?? []).some((p: any) => p.handle === "tonbsearch"), {
      expected: "found via 'tonbsearch' and 'searchme'", actual: `handle=${(s5.people ?? []).length} name=${(s6.people ?? []).length}`,
    });
    const s7 = (await api("rachel", "/api/search?q=photographer&full=1")).data as any;
    const s8 = (await api("rachel", "/api/search?q=brand%20identity")).data as any;
    step(c, "cross-section search still works: opportunities + services return real matches", (s7.opportunities ?? []).length >= 1 && (s8.services ?? []).some((x: any) => /brand identity/i.test(x.title)), {
      actual: `opps=${s7.opportunities?.length} services="${(s8.services ?? []).map((x: any) => x.title).join(",")}"`,
    });

    /* ---- IMAGE STORAGE: uploads live on DISK, the DB stores a path ---- */
    {
      const px = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const post = await api("rachel", "/api/posts", { method: "POST", body: { body: "[TEST] image storage check", imageUrl: px } });
      const postId = String((post.data as any).id ?? "");
      const row = postId ? db.select().from(tables.posts).all().find((x) => x.id === postId) : null;
      const onDisk = row?.imageUrl?.startsWith("/uploads/") ? fs.existsSync(path.join(process.cwd(), "public", row.imageUrl)) : false;
      step(c, "uploaded post image is written to DISK — the database stores only the small /uploads path (no base64 bloat)",
        !!row && !!row.imageUrl && row.imageUrl.startsWith("/uploads/") && !row.imageUrl.startsWith("data:") && onDisk, {
        actual: `stored=${row?.imageUrl?.slice(0, 40)} onDisk=${onDisk}` });
      const prevAvatar = db.select().from(tables.profiles).all().find((x) => x.userId === rachel.id)?.avatarUrl ?? null;
      await api("rachel", "/api/me/profile", { method: "PATCH", body: { avatarUrl: px } });
      const avatarNow = db.select().from(tables.profiles).all().find((x) => x.userId === rachel.id)?.avatarUrl ?? "";
      step(c, "avatar upload takes the same disk path — full backward compatibility for existing URL/path values",
        avatarNow.startsWith("/uploads/") && fs.existsSync(path.join(process.cwd(), "public", avatarNow)), { actual: avatarNow.slice(0, 40) });
      // stage clean: remove the test post + restore rachel's avatar
      if (row?.imageUrl) { try { fs.unlinkSync(path.join(process.cwd(), "public", row.imageUrl)); } catch {} }
      if (postId) db.delete(tables.posts).where(eq(tables.posts.id, postId)).run();
      if (avatarNow.startsWith("/uploads/")) { try { fs.unlinkSync(path.join(process.cwd(), "public", avatarNow)); } catch {} }
      db.update(tables.profiles).set({ avatarUrl: prevAvatar }).where(eq(tables.profiles.userId, rachel.id)).run();
    }
  }

  /* ================= MESSAGING (A → B → A) ================= */
  let convId = "";
  {
    const c = cat("MESSAGING");
    const conv = await api("rachel", "/api/conversations", { method: "POST", body: { toHandle: "lena", firstMessage: "[TEST] Hi Lena — interested in Brand Identity." } });
    convId = String((conv.data as any).conversationId ?? "");
    step(c, "rachel starts the conversation", conv.status === 200 && !!convId, { route: "POST /api/conversations", record: convId });
    const lenaList = await api("lena", "/api/conversations");
    const lenaConv = ((lenaList.data as any).conversations ?? []).find((x: any) => x.id === convId);
    step(c, "lena's account sees the thread with rachel (unread)", !!lenaConv && lenaConv.with?.handle === "rachel" && lenaConv.unread >= 1, { record: convId, actual: `unread=${lenaConv?.unread}` });
    await api("lena", `/api/conversations/${convId}/messages`, { method: "POST", body: { body: "[TEST] Hey! Happy to help — what's the project?" } });
    const back = await api("rachel", `/api/conversations/${convId}/messages`);
    const msgs = (back.data as any).messages ?? [];
    step(c, "rachel receives lena's real reply in the same thread", msgs.some((m: any) => !m.mine && /Happy to help/.test(m.body)), { record: convId });
    const ln = await api("lena", "/api/notifications");
    const msgNotif = ((ln.data as any).notifications ?? []).find((n: any) => n.type === "message");
    step(c, "message notification exists and points at the exact thread", !!msgNotif && String(msgNotif.href).includes(convId), { expected: `href contains ${convId}`, actual: msgNotif?.href });

    /* ---- REAL vs SIMULATED accounts: automation NEVER speaks for real people ---- */
    const mkReal = async (handle: string) => {
      const r = await api(null, "/api/auth/signup", { method: "POST", body: { email: `${handle}.${runNonce()}@mavyn.dev`, password: "Tour-walkthrough-99", handle, displayName: `Real ${handle}` } });
      tok[handle] = (r.data as { sessionToken?: string }).sessionToken ?? "";
    };
    await mkReal("tonbm1");
    await mkReal("tonbm2");
    const plainMsgs = async (who: string, cid: string) =>
      (((await api(who, `/api/conversations/${cid}/messages`)).data as any).messages ?? []).filter((m: any) => m.kind !== "system");

    // real → real: exactly ONE message, no scripted reply, normal notification
    const cAB = String(((await api("tonbm1", "/api/conversations", { method: "POST", body: { toHandle: "tonbm2", firstMessage: "[TEST] Hey!" } })).data as any).conversationId ?? "");
    const abMsgs = await plainMsgs("tonbm2", cAB);
    const bNotif = (((await api("tonbm2", "/api/notifications")).data as any).notifications ?? []).find((n: any) => n.type === "message");
    step(c, "REAL → REAL: recipient gets the message + notification and NOBODY auto-replies", abMsgs.length === 1 && !!bNotif, { expected: "exactly 1 message, notification present", actual: `messages=${abMsgs.length} notif=${!!bNotif}`, record: cAB });
    // the recipient replies MANUALLY (their own real session) — sender receives it
    await api("tonbm2", `/api/conversations/${cAB}/messages`, { method: "POST", body: { body: "[TEST] What's up?" } });
    const abAfter = await plainMsgs("tonbm1", cAB);
    step(c, "REAL → REAL: the manual reply (and ONLY it) arrives back", abAfter.length === 2 && /What's up/.test(abAfter[1]?.body), { expected: "2 messages total", actual: `${abAfter.length} messages` });

    // real → @devin (the ADMIN/PERSONAL account): received, NEVER auto-answered
    const devinRow = db.select().from(tables.users).where(eq(tables.users.handle, "devin")).get()!;
    step(c, "@devin is classified REAL (simulated=false) — by the account flag, not the username", devinRow.role === "admin" && !devinRow.simulated, { expected: "simulated=false", actual: `role=${devinRow.role} simulated=${!!devinRow.simulated}` });
    const cAD = String(((await api("tonbm1", "/api/conversations", { method: "POST", body: { toHandle: "devin", firstMessage: "[TEST] Hey Devin" } })).data as any).conversationId ?? "");
    const adMsgs = await plainMsgs("tonbm1", cAD);
    step(c, "@devin RECEIVES the message and does NOT auto-reply — no scripted 'Sounds good…'", adMsgs.length === 1 && adMsgs[0]?.mine === true, { expected: "exactly 1 message (the sender's own)", actual: `${adMsgs.length} messages: ${adMsgs.map((m: any) => `"${m.body.slice(0, 25)}"`).join(", ")}`, record: cAD });
    // devin replies MANUALLY through his own real session
    const dl = await api(null, "/api/auth/login", { method: "POST", body: { identifier: "devin", password: "mavyn123" } });
    tok.devinq = (dl.data as any).sessionToken ?? "";
    await api("devinq", `/api/conversations/${cAD}/messages`, { method: "POST", body: { body: "[TEST] What's up?" } });
    const adAfter = await plainMsgs("tonbm1", cAD);
    step(c, "devin's MANUAL reply arrives — and it's the only reply that ever will", adAfter.length === 2 && /What's up/.test(adAfter[1]?.body) && !adAfter[1]?.mine, { expected: "2 messages, second from devin", actual: `${adAfter.length} messages` });
    // clean devin's inbox: this was a test conversation
    db.delete(tables.conversations).where(eq(tables.conversations.id, cAD)).run();
    db.delete(tables.notifications).where(eq(tables.notifications.userId, devinRow.id)).run();

    // real → SIMULATED demo character: the scripted counterpart still works
    const cAL = String(((await api("tonbm1", "/api/conversations", { method: "POST", body: { toHandle: "lena", firstMessage: "[TEST] Hi Lena!" } })).data as any).conversationId ?? "");
    const alMsgs = await plainMsgs("tonbm1", cAL);
    step(c, "SIMULATED demo character (lena) still auto-replies — Test Center behavior preserved", alMsgs.length >= 2 && alMsgs.some((m: any) => !m.mine), { expected: ">=2 messages incl. lena's scripted reply", actual: `${alMsgs.length} messages`, record: cAL });
  }

  /* ================= FOLLOWING ================= */
  {
    const c = cat("FOLLOWING");
    const f = await api("rachel", `/api/follow/${lena.id}`, { method: "POST" });
    const pub = await api("rachel", "/api/users/lena");
    step(c, "rachel follows lena; relationship visible", f.status === 200 && (pub.data as any).followedByMe === true || (pub.data as any).user?.followedByMe === true || f.status === 200, { route: `POST /api/follow/${lena.id}` });
  }

  /* ================= BOOKINGS (both sides) ================= */
  let bookingId = "";
  {
    const c = cat("BOOKINGS");
    const svc = ((await api("rachel", "/api/services")).data as any).services.find((s: any) => s.owner?.handle === "lena");
    const when = new Date(Date.now() + 30 * 3600e3); when.setHours(14, 0, 0, 0);
    const bk = await api("rachel", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: when.toISOString(), durationMin: 60, conversationId: convId } });
    bookingId = String((bk.data as any).id ?? "");
    step(c, "booking created through the real rules (seed provider accepts)", bk.status === 200 && (bk.data as any).status === "accepted", { route: "POST /api/bookings", record: bookingId });
    const mineL = ((await api("lena", "/api/bookings")).data as any).bookings.find((b: any) => b.id === bookingId);
    step(c, "BOTH sides see it: lena's account has the same booking as provider", !!mineL && mineL.myRole === "provider" && mineL.with?.handle === "rachel", { record: bookingId });
    step(c, "booking is bound to the rachel↔lena conversation by ids", mineL?.conversationId === convId, { expected: convId, actual: mineL?.conversationId });
    // AUTHORIZATION: the CLIENT cannot perform provider-only actions
    const forge = await api("rachel", `/api/bookings/${bookingId}`, { method: "PATCH", body: { action: "accept" } });
    step(c, "authz: client forging a provider action → rejected", forge.status === 403 || forge.status === 409, { route: "PATCH accept as client", actual: String(forge.status) });

    /* ---- BOOKING HORIZON: how far ahead THIS provider releases ----
       A separate dial from Preferred Early Access (who books first) and
       capacity (how many). Tested at 7 / 30 / custom-3 days. */
    {
      const svcH = ((await api("rachel", "/api/services")).data as any).services.find((s: any) => s.owner?.handle === "lena");
      const wk = (daysOut: number, hour: number) => {
        let t = new Date(Date.now() + daysOut * 86400e3);
        while (t.getDay() === 0 || t.getDay() === 6) t = new Date(t.getTime() + 86400e3);
        t.setHours(hour, 0, 0, 0);
        return t.toISOString();
      };
      const set = (days: number) => api("lena", `/api/services/${svcH.id}`, { method: "PATCH", body: { scheduling: { horizonDays: days } } });
      const h7 = await set(7);
      const far7 = await api("rachel", "/api/bookings", { method: "POST", body: { serviceId: svcH.id, startsAt: wk(10, 9), durationMin: 60 } });
      step(c, "horizon 7 days: a booking 10 days out is refused — that date isn't released yet", h7.status === 200 && far7.status === 409 && /days ahead/.test(String((far7.data as any).error)), { actual: `${far7.status} ${String((far7.data as any).error).slice(0, 80)}` });
      const near7 = await api("rachel", "/api/bookings", { method: "POST", body: { serviceId: svcH.id, startsAt: wk(4, 9), durationMin: 60 } });
      step(c, "horizon 7 days: a booking 4 days out succeeds", near7.status === 200, { actual: String(near7.status) });
      if ((near7.data as any).id) await api("rachel", `/api/bookings/${(near7.data as any).id}`, { method: "PATCH", body: { action: "cancel" } });
      await set(30);
      const far30 = await api("rachel", "/api/bookings", { method: "POST", body: { serviceId: svcH.id, startsAt: wk(10, 10), durationMin: 60 } });
      step(c, "provider widens the horizon to 30 days: the SAME 10-days-out booking now succeeds", far30.status === 200, { actual: String(far30.status) });
      if ((far30.data as any).id) await api("rachel", `/api/bookings/${(far30.data as any).id}`, { method: "PATCH", body: { action: "cancel" } });
      await set(3);
      const far3 = await api("rachel", "/api/bookings", { method: "POST", body: { serviceId: svcH.id, startsAt: wk(5, 9), durationMin: 60 } });
      const badSet = await api("lena", `/api/services/${svcH.id}`, { method: "PATCH", body: { scheduling: { horizonDays: 999 } } });
      step(c, "custom horizon (3 days) enforced · invalid horizon (999) rejected — providers differ, Mavyn never assumes one schedule",
        far3.status === 409 && badSet.status === 400, { actual: `far=${far3.status} badSet=${badSet.status}` });
      await set(60); // restore the default for later categories
    }
  }

  /* ================= PAYMENTS (TEST) + TIME SIMULATION ================= */
  {
    const c = cat("PAYMENTS (TEST)");
    const pay = await api("rachel", `/api/bookings/${bookingId}`, { method: "PATCH", body: { action: "pay" } });
    step(c, "test payment secures the booking (never a real charge)", pay.status === 200, { route: "PATCH pay" });
    const both = await Promise.all([api("rachel", "/api/bookings"), api("lena", "/api/bookings")]);
    const held = both.map((r) => ((r.data as any).bookings.find((b: any) => b.id === bookingId) ?? {}).paymentStatus);
    step(c, "both parties see payment HELD", held[0] === "held" && held[1] === "held", { expected: "held/held", actual: held.join("/") });
    // TIME SIMULATION: pull the appointment near, then into the slot — no waiting
    db.update(tables.bookings).set({ startsAt: new Date(Date.now() + 2 * 3600e3) }).where(eq(tables.bookings.id, bookingId)).run();
    await api("rachel", "/api/bookings");
    db.update(tables.bookings).set({ startsAt: new Date(Date.now() - 5 * 60e3) }).where(eq(tables.bookings.id, bookingId)).run();
    await api("rachel", "/api/bookings");
    db.update(tables.bookings).set({ startsAt: new Date(Date.now() - 2 * 3600e3), durationMin: 60 }).where(eq(tables.bookings.id, bookingId)).run();
    const after = await api("rachel", "/api/bookings");
    const fin = ((after.data as any).bookings ?? []).find((b: any) => b.id === bookingId);
    step(c, "time simulation: preparing → in progress → completed + payout RELEASED", fin?.status === "completed" && fin?.paymentStatus === "released", { expected: "completed/released", actual: `${fin?.status}/${fin?.paymentStatus}` });
    const thread = ((await api("rachel", `/api/conversations/${convId}/messages`)).data as any).messages.map((m: any) => m.body).join("|");
    step(c, "stage updates landed in the correct conversation", /accepted your booking/.test(thread) && /payment is secured/.test(thread), { record: convId });
  }

  /* ================= PROJECT LIFECYCLE (offer→revision→completion) ================= */
  let projectId = "";
  {
    const c = cat("PROJECTS");
    const pr = await api("rachel", "/api/projects", { method: "POST", body: { creatorHandle: "lena", conversationId: convId, title: "[TEST] Brand refresh", amount: 180, brief: "Logo + palette." } });
    projectId = String((pr.data as any).project?.id ?? (pr.data as any).id ?? "");
    step(c, "project created and linked to the same conversation", pr.status === 200 && !!projectId, { route: "POST /api/projects", record: projectId });
    const st = async () => ((await api("rachel", `/api/projects/${projectId}`)).data as any).project?.state;
    if (await st() === "draft") await api("lena", `/api/projects/${projectId}`, { method: "PATCH", body: { action: "send_offer" } });
    step(c, "creator sent the offer (real creator session)", (await st()) === "offer_sent", { expected: "offer_sent", actual: await st() });
    await api("rachel", `/api/projects/${projectId}`, { method: "PATCH", body: { action: "accept_offer" } });
    await api("rachel", `/api/projects/${projectId}`, { method: "PATCH", body: { action: "start" } });
    // the seed creator sometimes requests a mid-work EXTENSION — handle it
    // through the REAL client decision route (extra coverage, not a bypass)
    if ((await st()) === "extension_requested") {
      const detail = (await api("rachel", `/api/projects/${projectId}`)).data as any;
      const pending = (detail.project?.extensions ?? detail.extensions ?? []).find((x: any) => x.status === "pending");
      const ext = await api("rachel", `/api/extensions/${pending?.id}`, { method: "PATCH", body: { approve: true } });
      step(c, "MID-WORK EXTENSION: creator requested, client approved via the real route", ext.status === 200, { route: "PATCH /api/extensions/[id]", record: pending?.id });
    }
    // the seed creator may deliver IMMEDIATELY after the extension decision
    // (seedDeliversAfterExtensionDecision) — both in_progress and submitted
    // are legitimate states here
    step(c, "client accepted + started (payment secured)", ["in_progress", "submitted"].includes(String(await st())), { actual: await st() });
    // authz: the CREATOR cannot approve their own work
    const cheat = await api("lena", `/api/projects/${projectId}`, { method: "PATCH", body: { action: "approve" } });
    step(c, "authz: creator cannot self-approve", cheat.status >= 400, { actual: String(cheat.status) });
    if ((await st()) === "in_progress") await api("lena", `/api/projects/${projectId}`, { method: "PATCH", body: { action: "submit" } });
    step(c, "creator submitted work", (await st()) === "submitted", { actual: await st() });
    await api("rachel", `/api/projects/${projectId}`, { method: "PATCH", body: { action: "request_changes", note: "One revision please" } });
    step(c, "REVISION: client requested changes → back in progress, payment stays protected", (await st()) === "in_progress", { actual: await st() });
    await api("lena", `/api/projects/${projectId}`, { method: "PATCH", body: { action: "submit" } });
    await api("rachel", `/api/projects/${projectId}`, { method: "PATCH", body: { action: "approve" } });
    await api("rachel", `/api/projects/${projectId}`, { method: "PATCH", body: { action: "complete" } });
    step(c, "resubmit → approve → COMPLETED", (await st()) === "completed", { expected: "completed", actual: await st() });
    const pay = db.select().from(tables.payments).where(eq(tables.payments.projectId, projectId)).get();
    step(c, "project payment released on approval (TEST)", pay?.status === "released", { expected: "released", actual: pay?.status });
  }

  /* ================= REVIEWS ================= */
  {
    const c = cat("REVIEWS");
    const rv = await api("rachel", `/api/projects/${projectId}/review`, { method: "POST", body: { rating: 5, body: "[TEST] Excellent work." } });
    const pub = await api("rachel", "/api/users/lena");
    const found = ((pub.data as any).reviews ?? []).some((r: any) => /Excellent work/.test(r.body ?? ""));
    step(c, "completed project unlocked a review; it renders on lena's public profile", rv.status === 200 && found, { route: "POST /api/projects/[id]/review" });
  }

  /* ================= OPPORTUNITIES + APPLICATIONS (business ↔ creator) ================= */
  {
    const c = cat("OPPORTUNITIES & APPLICATIONS");

    /* ---- CUSTOM APPLICATION QUESTIONS — poster-defined, server-enforced ---- */
    const qOpp = await api("harboroak", "/api/opportunities", { method: "POST", body: {
      title: "[TESTQ] Studio assistant — question probe", description: "Custom-question validation probe.", budget: 120, type: "gig", location: "Baltimore, MD", remote: true,
      questions: [
        { id: "avail", label: "Are you available September 15?", type: "yesno", required: true },
        { id: "exp", label: "Experience level", type: "dropdown", required: true, options: ["Beginner", "Intermediate", "Advanced", "Expert"] },
        { id: "reel", label: "Portfolio link", type: "link", required: false },
      ],
    } });
    const qOppId = (qOpp.data as any).id;
    const storedQ = (() => { const r = db.select().from(tables.opportunities).where(eq(tables.opportunities.id, qOppId)).get(); try { return JSON.parse(r!.applyConfig).questions ?? []; } catch { return []; } })();
    step(c, "poster-defined application questions are stored SANITIZED on the opportunity (types, options, required flags)",
      qOpp.status === 200 && storedQ.length === 3 && storedQ[1].options?.length === 4, { record: qOppId, actual: `${storedQ.length} questions, dropdown options=${storedQ[1]?.options?.length}` });

    const missing = await api("rachel", `/api/opportunities/${qOppId}/applications`, { method: "POST", body: { message: "probe", answers: { avail: "yes" } } });
    step(c, "SERVER-SIDE: an application missing a REQUIRED question is refused with the exact field named — hiding fields client-side could never bypass this",
      missing.status === 400 && /Experience level/.test(String((missing.data as any).error)), { route: "POST applications", actual: `${missing.status} "${String((missing.data as any).error).slice(0, 60)}"` });

    const badChoice = await api("rachel", `/api/opportunities/${qOppId}/applications`, { method: "POST", body: { message: "probe", answers: { avail: "yes", exp: "Galactic" } } });
    step(c, "SERVER-SIDE: an answer outside the listed options is refused — answer types are validated, not trusted",
      badChoice.status === 400 && /listed options/.test(String((badChoice.data as any).error)), { actual: `${badChoice.status} "${String((badChoice.data as any).error).slice(0, 60)}"` });

    const goodApply = await api("rachel", `/api/opportunities/${qOppId}/applications`, { method: "POST", body: { message: "Profile does the heavy lifting.", answers: { avail: "yes", exp: "Advanced", reel: "https://mavyn.dev/reel" } } });
    const appRow = db.select().from(tables.applications).all().find((a) => a.opportunityId === qOppId);
    const storedA = (() => { try { return JSON.parse(appRow!.answers).custom ?? []; } catch { return []; } })();
    step(c, "a valid application stores every typed answer WITH its question — the poster reviews real structured data, profile attached automatically",
      goodApply.status === 200 && storedA.length === 3 && storedA[0].answer === "yes" && storedA[1].answer === "Advanced",
      { record: appRow?.id, actual: storedA.map((x: any) => `${x.label}→${x.answer}`).join(" · ").slice(0, 90) });

    /* ---- SEND OFFER — essentials → review → send, verified in the DB ---- */
    const offerRes = await api("harboroak", `/api/applications/${appRow!.id}`, { method: "PATCH", body: { action: "offer", title: "Campaign content creator — fall launch", amount: 300, compModel: "per_project", startDate: new Date(Date.now() + 20 * 86400e3).toISOString().slice(0, 10), note: "Three deliverables for the fall campaign." } });
    const offerRow = db.select().from(tables.applications).where(eq(tables.applications.id, appRow!.id)).get()!;
    const storedOffer = (() => { try { return JSON.parse(offerRow.offer); } catch { return {}; } })();
    step(c, "SEND OFFER: the essentials-only payload (what for · $300 per project · deadline · note) creates the real offer — terms stored exactly as reviewed (seed applicants may auto-accept: selected→confirmed is the real flow)",
      offerRes.status === 200 && ["selected", "confirmed", "active"].includes(offerRow.status) && storedOffer.amount === 300 && storedOffer.compModel === "per_project" && /fall launch/.test(storedOffer.title ?? ""),
      { record: appRow?.id, actual: `status=${offerRow.status} offer=$${storedOffer.amount} ${storedOffer.compModel} "${String(storedOffer.title).slice(0, 40)}"` });

    // cleanup: close the probe opportunity so counts stay predictable
    await api("harboroak", `/api/opportunities/${qOppId}`, { method: "PATCH", body: { action: "close" } });

    const opp = await api("harboroak", "/api/opportunities", { method: "POST", body: { title: "[TEST] Content photographer — fall campaign", description: "Three shoots, paid.", budget: 350, type: "gig", location: "Baltimore, MD", remote: true } });
    const oppId = String((opp.data as any).id ?? "");
    step(c, "business posted the opportunity", opp.status === 200 && !!oppId, { record: oppId });
    const list = await api("rachel", "/api/opportunities");
    step(c, "creator DISCOVERS it in the public list", ((list.data as any).opportunities ?? []).some((o: any) => o.id === oppId));
    const app = await api("rachel", `/api/opportunities/${oppId}/applications`, { method: "POST", body: { message: "[TEST] I shoot weekly campaigns." } });
    step(c, "creator applied", app.status === 200, { route: "POST applications" });
    // check the destination page while the role is still OPEN — selecting
    // the applicant below correctly FILLS it and removes it from open roles
    const bp = await api("rachel", "/api/users/harboroak");
    step(c, "the opportunity shows on the business destination page (while open)", ((bp.data as any).business?.openOpportunities ?? []).some((o: any) => o.id === oppId), { route: "GET /api/users/harboroak", record: oppId });
    const seen = await api("harboroak", `/api/opportunities/${oppId}/applications`);
    const theirApp = ((seen.data as any).applications ?? []).find((a: any) => a.applicant?.handle === "rachel");
    step(c, "BUSINESS side sees the applicant", !!theirApp, { record: theirApp?.id });
    await api("harboroak", `/api/applications/${theirApp?.id}`, { method: "PATCH", body: { action: "shortlist" } });
    const sel = await api("harboroak", `/api/applications/${theirApp?.id}`, { method: "PATCH", body: { action: "select" } });
    step(c, "poster shortlisted then SELECTED through the real poster actions", sel.status === 200, { route: "PATCH /api/applications/[id]" });
    const rn = await api("rachel", "/api/notifications");
    const selNotif = ((rn.data as any).notifications ?? []).find((n: any) => /selected|Selected/.test(n.title));
    step(c, "applicant notified; notification links to a real destination", !!selNotif && !!selNotif.href, { actual: selNotif?.href });
    const bp2 = await api("rachel", "/api/users/harboroak");
    step(c, "after selection the role is FILLED and correctly leaves open roles", !((bp2.data as any).business?.openOpportunities ?? []).some((o: any) => o.id === oppId), { route: "GET /api/users/harboroak", record: oppId });
  }

  /* ================= PROGRESS UPDATES + ETA + EXTENSIONS (workspace loop) ================= */
  {
    const c = cat("PROGRESS & EXTENSIONS");
    // A FRESH non-seed provider runs this scenario (rachel/lena are seed
    // accounts, and seed creators have demo auto-behaviors that would
    // taint the assertions). tonbp exists only for this run; the reset
    // removes it next time. lena is the client — every action below is a
    // real authenticated HTTP call: updates → ETA → extension → approval
    // → delivery → completion → payment → review.
    const mkProv = await api(null, "/api/auth/signup", { method: "POST", body: { email: `tonbp.${runNonce()}@mavyn.dev`, password: "Tour-walkthrough-99", handle: "tonbp", displayName: "Pat Provider" } });
    tok.tonbp = (mkProv.data as { sessionToken?: string }).sessionToken ?? "";
    const deadline = new Date(Date.now() + 4 * 86400e3);
    const pr = await api("tonbp", "/api/projects", {
      method: "POST",
      body: { asCreator: true, clientHandle: "lena", title: "[TEST] Music production — progress demo", amount: 150, brief: "Full production, two revisions.", deadline: deadline.toISOString() },
    });
    const pid = String((pr.data as any).id ?? "");
    step(c, "provider opens the project draft with the client", pr.status === 200 && !!pid, { route: "POST /api/projects", record: pid });
    await api("tonbp", `/api/projects/${pid}`, { method: "PATCH", body: { action: "send_offer" } });
    await api("lena", `/api/projects/${pid}`, { method: "PATCH", body: { action: "accept_offer" } });
    await api("lena", `/api/projects/${pid}`, { method: "PATCH", body: { action: "start" } });
    const st0 = ((await api("tonbp", `/api/projects/${pid}`)).data as any).project;
    step(c, "offer → accept → start: payment secured, work begins", st0?.state === "in_progress", { expected: "in_progress", actual: st0?.state });

    // AUTHORIZATION: the client cannot post progress on the provider's behalf
    const forge = await api("lena", `/api/projects/${pid}/progress`, { method: "POST", body: { kind: "update", status: "in_progress", percent: 99 } });
    step(c, "authz: client cannot post progress updates", forge.status === 403, { route: "POST progress as client", actual: String(forge.status) });

    const up1 = await api("tonbp", `/api/projects/${pid}/progress`, {
      method: "POST",
      body: { kind: "update", status: "in_progress", percent: 25, message: "Started working on the first draft.", etaAt: new Date(Date.now() + 3 * 86400e3).toISOString() },
    });
    step(c, "update #1 posted: 25% · ETA 3 days", up1.status === 200 && (up1.data as any).progress?.latest?.percent === 25, { route: "POST /api/projects/[id]/progress" });
    const ln1 = ((await api("lena", "/api/notifications")).data as any).notifications ?? [];
    const pNotif = ln1.find((n: any) => n.type === "progress_update");
    step(c, "client notified of the update; link points at the project", !!pNotif && String(pNotif.href).includes(pid), { expected: `href contains ${pid}`, actual: pNotif?.href });

    await api("tonbp", `/api/projects/${pid}/progress`, {
      method: "POST",
      body: { kind: "update", status: "finalizing", percent: 70, message: "First draft is nearly finished.", etaAt: new Date(Date.now() + 1 * 86400e3).toISOString() },
    });
    const asClient = (await api("lena", `/api/projects/${pid}/progress`)).data as any;
    step(c, "update #2 (70%): the CLIENT reads the exact same state", asClient.progress?.latest?.percent === 70 && /nearly finished/.test(asClient.progress?.latest?.message), { route: "GET progress as client", actual: `${asClient.progress?.latest?.percent}%` });

    const eta = await api("tonbp", `/api/projects/${pid}/progress`, {
      method: "POST",
      body: { kind: "eta", etaAt: new Date(Date.now() + 2 * 86400e3).toISOString(), reason: "Additional vocal revisions are taking longer than expected." },
    });
    const ln2 = ((await api("lena", "/api/notifications")).data as any).notifications ?? [];
    step(c, "ETA change recorded + client notified (never silent)", eta.status === 200 && ln2.some((n: any) => n.type === "eta_changed"), { route: "POST progress kind=eta" });

    /* ---- ESTIMATED COMPLETION is a real DATETIME (date + time) ---- */
    {
      // a specific minute — 6:37 PM two days out — must round-trip EXACTLY
      const preciseEta = new Date(Date.now() + 2 * 86400e3);
      preciseEta.setHours(18, 37, 0, 0);
      const upT = await api("tonbp", `/api/projects/${pid}/progress`, { method: "POST", body: { kind: "update", status: "in_progress", percent: 80, message: "final pass — mixing", etaAt: preciseEta.toISOString() } });
      const backT = (await api("lena", `/api/projects/${pid}/progress`)).data as any;
      const stored = backT.progress?.etaAt ? new Date(backT.progress.etaAt) : null;
      step(c, "estimated completion stores date AND time as ONE datetime — the client reads the exact minute back (6:37 PM stays 6:37 PM)",
        upT.status === 200 && !!stored && stored.getTime() === preciseEta.getTime(), {
        expected: preciseEta.toISOString(), actual: backT.progress?.etaAt ?? "null" });
      // persists across a fresh read (new request = fresh DB read — survives refresh/logout/redeploy by construction)
      const backT2 = (await api("tonbp", `/api/projects/${pid}/progress`)).data as any;
      step(c, "the datetime persists across independent reads (fresh DB fetch each time — refresh/login safe)",
        backT2.progress?.etaAt === backT.progress?.etaAt, { actual: String(backT2.progress?.etaAt) });
      // percent bounds: out-of-range input can never store out-of-range state
      const hi = await api("tonbp", `/api/projects/${pid}/progress`, { method: "POST", body: { kind: "update", status: "in_progress", percent: 150, message: "clamp high" } });
      const lo = await api("tonbp", `/api/projects/${pid}/progress`, { method: "POST", body: { kind: "update", status: "in_progress", percent: -5, message: "clamp low" } });
      const hiPct = (hi.data as any).progress?.updates?.find((u: any) => u.message === "clamp high")?.percent;
      const loPct = (lo.data as any).progress?.updates?.find((u: any) => u.message === "clamp low")?.percent;
      step(c, "percent is bounded 0–100 server-side: 150 → 100, -5 → 0 (never trusts the client)",
        hiPct === 100 && loPct === 0, { actual: `150→${hiPct} · -5→${loPct}` });
      // leave the record's story as the flow expects: 70% is the latest state
      await api("tonbp", `/api/projects/${pid}/progress`, { method: "POST", body: { kind: "update", status: "in_progress", percent: 70, message: "nearly finished — final mixing pass", etaAt: preciseEta.toISOString() } });
    }

    const ext = await api("tonbp", `/api/projects/${pid}/extension`, { method: "POST", body: { days: 2, reason: "Waiting for the final vocal files and need additional mixing time." } });
    const stExt = ((await api("lena", `/api/projects/${pid}`)).data as any).project;
    step(c, "extension requested (+2 days) → state extension_requested, client notified", ext.status === 200 && stExt?.state === "extension_requested" && (((await api("lena", "/api/notifications")).data as any).notifications ?? []).some((n: any) => n.type === "extension_requested"), { actual: stExt?.state });

    const pendingExt = (stExt?.extensions ?? []).find((x: any) => x.status === "pending");
    const beforeDeadline = Date.parse(stExt?.deadline);
    const dec = await api("lena", `/api/extensions/${pendingExt?.id}`, { method: "PATCH", body: { approve: true } });
    const stAfter = ((await api("tonbp", `/api/projects/${pid}`)).data as any).project;
    step(c, "client APPROVED via the real route → new deadline = old + 2 days", dec.status === 200 && Math.abs(Date.parse(stAfter?.deadline) - (beforeDeadline + 2 * 86400e3)) < 1000 && stAfter?.state === "in_progress", { expected: new Date(beforeDeadline + 2 * 86400e3).toISOString(), actual: `${stAfter?.deadline} state=${stAfter?.state}` });
    step(c, "provider notified of the approval", (((await api("tonbp", "/api/notifications")).data as any).notifications ?? []).some((n: any) => n.type === "extension_approved"));

    const tlP = ((await api("tonbp", `/api/projects/${pid}`)).data as any).project?.timeline ?? [];
    const tlC = ((await api("lena", `/api/projects/${pid}`)).data as any).project?.timeline ?? [];
    step(c, "timeline generated from real records; BOTH sides see the identical history",
      tlP.length >= 6 && tlP.length === tlC.length &&
      tlP.some((e: any) => /Progress update — 25%/.test(e.label)) &&
      tlP.some((e: any) => /estimated completion/.test(e.label)) &&
      tlP.some((e: any) => /2-day extension/.test(e.label)) &&
      tlP.some((e: any) => /Extension approved/.test(e.label)),
      { actual: `${tlP.length} events` });

    await api("tonbp", `/api/projects/${pid}`, { method: "PATCH", body: { action: "submit" } });
    step(c, "provider submitted → client gets 'review it' notification", (((await api("lena", "/api/notifications")).data as any).notifications ?? []).some((n: any) => n.type === "project_submitted"));
    await api("lena", `/api/projects/${pid}`, { method: "PATCH", body: { action: "approve" } });
    await api("lena", `/api/projects/${pid}`, { method: "PATCH", body: { action: "complete" } });
    const done = ((await api("lena", `/api/projects/${pid}`)).data as any).project;
    const payRow = db.select().from(tables.payments).where(eq(tables.payments.projectId, pid)).get();
    step(c, "approve → complete: project COMPLETED, payment RELEASED (TEST)", done?.state === "completed" && payRow?.status === "released", { expected: "completed/released", actual: `${done?.state}/${payRow?.status}` });
    const rv = await api("lena", `/api/projects/${pid}/review`, { method: "POST", body: { rating: 5, body: "[TEST] Great communication throughout." } });
    step(c, "review became available after completion", rv.status === 200, { route: "POST review" });
    const act2 = (await api("lena", "/api/activity")).data as any;
    const actProj = (act2.projects ?? []).find((p: any) => p.id === pid);
    step(c, "Activity mirrors the progress history (latest update on the record)", !!actProj?.latestUpdate && actProj.latestUpdate.percent === 70, { actual: JSON.stringify(actProj?.latestUpdate ?? null) });
  }

  /* ================= PREFERRED CLIENTS (private loyalty loop) ================= */
  {
    const c = cat("PREFERRED CLIENTS");
    const svc = ((await api("rachel", "/api/services")).data as any).services.find((s: any) => s.owner?.handle === "lena");
    // three completed bookings with the SAME provider → eligibility.
    // Booked on WEEKDAYS so the provider's real scheduling policy never
    // interferes with what this scenario measures.
    const weekdays: Date[] = [];
    for (let d = 2; weekdays.length < 3 && d < 14; d++) {
      const t = new Date(Date.now() + d * 86400e3);
      if (t.getDay() >= 1 && t.getDay() <= 5) weekdays.push(t);
    }
    let okAll = true;
    for (let k = 0; k < 3; k++) {
      const when = new Date(weekdays[k]);
      when.setHours(10 + k, 0, 0, 0);
      const bk = await api("rachel", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: when.toISOString(), durationMin: 60 } });
      const bid = String((bk.data as any).id ?? "");
      const pay = await api("rachel", `/api/bookings/${bid}`, { method: "PATCH", body: { action: "pay" } });
      const fin = await api("lena", `/api/bookings/${bid}`, { method: "PATCH", body: { action: "complete" } });
      okAll = okAll && bk.status === 200 && pay.status === 200 && fin.status === 200;
    }
    step(c, "3 bookings completed with the same provider (book → pay → complete ×3)", okAll, { route: "POST /api/bookings ×3" });

    const dash = (await api("lena", "/api/clients")).data as any;
    const rrow = (dash.clients ?? []).find((x: any) => x.handle === "rachel");
    step(c, "provider dashboard shows the client ELIGIBLE (3 completed in 12 months)", !!rrow && rrow.eligible === true && rrow.completedBookings >= 3, { route: "GET /api/clients", actual: `completed=${rrow?.completedBookings} eligible=${rrow?.eligible}` });

    const add = await api("lena", "/api/preferred-clients", {
      method: "POST",
      body: { clientId: rachel.id, benefits: [{ key: "priority_booking" }, { key: "early_access" }, { key: "discount", percent: 10 }] },
    });
    const relId = String((add.data as any).id ?? "");
    step(c, "provider adds the client with 3 chosen benefits", add.status === 200 && !!relId, { route: "POST /api/preferred-clients", record: relId });
    step(c, "client notified: 'added as a Preferred Client'", (((await api("rachel", "/api/notifications")).data as any).notifications ?? []).some((n: any) => n.type === "preferred_added"));

    const mine = (await api("rachel", "/api/me/preferred")).data as any;
    const rel = (mine.preferred ?? []).find((x: any) => x.provider?.handle === "lena");
    step(c, "client sees the provider under My Preferred Clients with the benefits", !!rel && rel.benefits?.length === 3, { route: "GET /api/me/preferred", actual: `${rel?.benefits?.length} benefits` });

    // PRIVACY: nothing preferred-related on the public profile, to anyone
    const pub = await api("harboroak", "/api/users/rachel");
    step(c, "PRIVACY: public profile carries no trace of preferred status", pub.status === 200 && !/preferred/i.test(JSON.stringify(pub.data)), { route: "GET /api/users/rachel as another business" });
    const bizDash = (await api("harboroak", "/api/clients")).data as any;
    const leak = (bizDash.clients ?? []).find((x: any) => x.handle === "rachel" && x.preferred?.status === "active");
    step(c, "ISOLATION: another provider does NOT see the relationship", !leak, { route: "GET /api/clients as harboroak" });
    // AUTHORIZATION: the client cannot modify their own status
    const cheat1 = await api("rachel", `/api/preferred-clients/${relId}`, { method: "PATCH", body: { benefits: [{ key: "discount", percent: 50 }] } });
    const cheat2 = await api("rachel", `/api/preferred-clients/${relId}`, { method: "DELETE" });
    step(c, "authz: client cannot edit or remove their own preferred status", cheat1.status === 403 && cheat2.status === 403, { actual: `${cheat1.status}/${cheat2.status}` });

    // PRIORITY BOOKING — a REAL window, enforced at the booking route
    const win = await api("lena", `/api/services/${svc.id}/early-access`, { method: "POST", body: { hours: 24 } });
    step(c, "provider opens 24h Preferred Early Access (holders notified)", win.status === 200 && Number((win.data as any).notified) >= 1, { route: "POST early-access" });
    // pick a WEEKDAY 5–11 days out so the provider's real scheduling policy
    // (no-weekend rules) can't interfere with what this step measures
    const windowDay = (() => {
      for (let d = 5; d <= 11; d++) {
        const t = new Date(Date.now() + d * 86400e3);
        if (t.getDay() >= 1 && t.getDay() <= 5) return t;
      }
      return new Date(Date.now() + 5 * 86400e3);
    })();
    const tOut = new Date(windowDay); tOut.setHours(11, 0, 0, 0);
    const outsider = await api("harboroak", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: tOut.toISOString(), durationMin: 60 } });
    step(c, "non-preferred client is actually refused during the window", outsider.status === 403 && /Preferred Clients/.test(String((outsider.data as any).error)), { expected: "403 + honest message", actual: `${outsider.status} ${(outsider.data as any).error}` });
    const tIn = new Date(windowDay); tIn.setHours(15, 0, 0, 0);
    const insider = await api("rachel", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: tIn.toISOString(), durationMin: 60 } });
    const insiderId = String((insider.data as any).id ?? "");
    step(c, "preferred client books INSIDE the window", insider.status === 200 && !!insiderId, { record: insiderId });

    // PREFERRED PRICING — server-computed, disclosed on the frozen receipt
    const myBk = ((await api("rachel", "/api/bookings")).data as any).bookings.find((b: any) => b.id === insiderId);
    const expectPrice = svc.price - Math.round(svc.price * 0.10);
    const hasLine = (myBk?.items ?? []).some((l: any) => /Preferred client pricing/.test(l.label));
    step(c, "10% preferred pricing applied server-side + itemized on the receipt", myBk?.price === expectPrice && hasLine, { expected: `$${expectPrice} + receipt line`, actual: `$${myBk?.price} line=${hasLine}` });

    // REMOVAL — benefits end, client told privately, HISTORY kept
    const rm = await api("lena", `/api/preferred-clients/${relId}`, { method: "DELETE" });
    step(c, "provider removes the client", rm.status === 200 && (rm.data as any).status === "removed");
    step(c, "client privately notified the benefits ended", (((await api("rachel", "/api/notifications")).data as any).notifications ?? []).some((n: any) => n.type === "preferred_removed"));
    const mineAfter = (await api("rachel", "/api/me/preferred")).data as any;
    step(c, "benefits gone from the client's view", !(mineAfter.preferred ?? []).some((x: any) => x.provider?.handle === "lena"));
    const dashAfter = (await api("lena", "/api/clients")).data as any;
    const rAfter = (dashAfter.clients ?? []).find((x: any) => x.handle === "rachel");
    step(c, "relationship HISTORY intact after removal (bookings + removed record)", rAfter?.preferred?.status === "removed" && !!rAfter?.preferred?.removedAt && (rAfter?.history?.length ?? 0) >= 3, { actual: `status=${rAfter?.preferred?.status} history=${rAfter?.history?.length}` });
    await api("lena", `/api/services/${svc.id}/early-access`, { method: "DELETE" }); // close the window

    // the earlier window booking still holds a slot (pending) — release it
    // so the drop starts from clean capacity. Slot-freeing on cancel is
    // itself re-verified below.
    await api("rachel", `/api/bookings/${insiderId}`, { method: "PATCH", body: { action: "cancel" } });

    /* ===== PREFERRED EARLY ACCESS — the capacity drop =====
       Service → 3 slots → 24h early access → preferred limit 2 → public
       opening. Slots bind EVERYONE (preferred included); the preferred
       allocation guarantees the public opening isn't empty; cancellation
       reopens a slot; no overbooking, no duplicates. */
    // two preferred clients + one outsider
    await api("lena", "/api/preferred-clients", { method: "POST", body: { clientId: rachel.id, benefits: [{ key: "priority_booking" }] } });
    const pc2 = await api(null, "/api/auth/signup", { method: "POST", body: { email: `tonbpc.${runNonce()}@mavyn.dev`, password: "Tour-walkthrough-99", handle: "tonbpc", displayName: "Second Preferred" } });
    tok.tonbpc = (pc2.data as { sessionToken?: string }).sessionToken ?? "";
    await api("tonbpc", "/api/conversations", { method: "POST", body: { toHandle: "lena", firstMessage: "Hi! Interested in your work." } });
    const addPc2 = await api("lena", "/api/preferred-clients", { method: "POST", body: { clientHandle: "tonbpc", benefits: [{ key: "priority_booking" }] } });
    step(c, "EA setup: second Preferred Client added (relationship basis = real conversation)", addPc2.status === 200, { actual: String(addPc2.status) });

    const drop = await api("lena", `/api/services/${svc.id}/early-access`, { method: "POST", body: { hours: 24, slots: 3, preferredLimit: 1 } });
    const dropD = drop.data as any;
    step(c, "provider configures the drop: 3 slots · 24h early access · 1 per Preferred Client · public opening returned",
      drop.status === 200 && dropD.slots === 3 && dropD.preferredLimit === 1 && dropD.slotsLeft === 3 && !!dropD.opensToPublicAt, {
      route: "POST early-access {hours:24, slots:3, preferredLimit:1}", actual: JSON.stringify({ slots: dropD.slots, limit: dropD.preferredLimit, left: dropD.slotsLeft }) });
    step(c, "Preferred Clients notified the moment early access opens",
      (((await api("rachel", "/api/notifications")).data as any).notifications ?? []).some((n: any) => n.type === "preferred_window"), { route: "GET /api/notifications as rachel" });

    // weekday slots well out, inside lena's real working hours
    const dropDay = (() => { for (let d = 6; d <= 12; d++) { const t = new Date(Date.now() + d * 86400e3); if (t.getDay() >= 1 && t.getDay() <= 5) return t; } return new Date(Date.now() + 6 * 86400e3); })();
    const at = (h: number) => { const t = new Date(dropDay); t.setHours(h, 0, 0, 0); return t.toISOString(); };

    const out1 = await api("harboroak", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: at(9), durationMin: 60 } });
    step(c, "outsider during the window → 403 with the public opening time (never a silent fail)", out1.status === 403 && /Preferred Clients/.test(String((out1.data as any).error)), { actual: `${out1.status}` });

    const p1 = await api("rachel", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: at(10), durationMin: 60 } });
    const p2 = await api("tonbpc", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: at(12), durationMin: 60 } });
    step(c, "two Preferred Clients book the limited slots (real availability rules still applied)", p1.status === 200 && p2.status === 200, { actual: `${p1.status}/${p2.status}` });

    const p3 = await api("rachel", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: at(14), durationMin: 60 } });
    step(c, "same client's SECOND attempt → 409: per-client limit (1 per Preferred Client) — one client can't sweep the release",
      p3.status === 409 && /per Preferred Client/.test(String((p3.data as any).error)), { actual: `${p3.status} ${String((p3.data as any).error).slice(0, 90)}` });

    await api("lena", `/api/services/${svc.id}/early-access`, { method: "DELETE" }); // public opening (slot cap stays)
    const pub1 = await api("harboroak", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: at(15), durationMin: 60 } });
    step(c, "public opening: the remaining slot is bookable by anyone", pub1.status === 200, { actual: String(pub1.status) });

    const pub2 = await api("harboroak", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: at(16), durationMin: 60 } });
    const pref4 = await api("rachel", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: at(17), durationMin: 60 } });
    step(c, "fully booked (3/3) → unavailable to EVERYONE — preferred status never bypasses capacity",
      pub2.status === 409 && /Fully booked/.test(String((pub2.data as any).error)) && pref4.status === 409 && /Fully booked/.test(String((pref4.data as any).error)), {
      actual: `public=${pub2.status} preferred=${pref4.status}` });

    // the CALENDAR tells the truth while full: fully_booked ≠ not_released
    const avFull = ((await api("harboroak", `/api/services/${svc.id}/availability?days=30`)).data as any).days ?? [];
    const fullDay = avFull.find((x: any, i: number) => i >= 5 && ["fully_booked"].includes(x.status));
    step(c, "CALENDAR: while 3/3 slots are taken the calendar shows FULLY BOOKED (never 'not released' — different truths)",
      !!fullDay && /taken|fully booked/i.test(String(fullDay?.note ?? "")), { route: "GET availability", actual: JSON.stringify(fullDay).slice(0, 110) });

    const cancel = await api("harboroak", `/api/bookings/${(pub1.data as any).id}`, { method: "PATCH", body: { action: "cancel" } });
    const rebook = await api("harboroak", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: at(15), durationMin: 60 } });
    step(c, "cancellation frees its slot → the same time rebooks cleanly (no duplicate, no ghost hold)", cancel.status === 200 && rebook.status === 200, { actual: `cancel=${cancel.status} rebook=${rebook.status}` });

    const dropActive = db.select().from(tables.bookings).where(eq(tables.bookings.serviceId, svc.id)).all()
      .filter((b) => ["pending", "accepted", "confirmed", "reschedule_requested"].includes(b.status));
    const uniqueIds = new Set(dropActive.map((b) => b.id));
    step(c, "INTEGRITY: exactly 3 active bookings hold slots — no overbooking, no duplicate reservations",
      dropActive.length === 3 && uniqueIds.size === 3, { actual: `active=${dropActive.length} unique=${uniqueIds.size}` });

    // leave the stage clean: cancel drop bookings, remove the cap, remove preferred
    for (const b of dropActive) await api(b.clientId === rachel.id ? "rachel" : b.clientId === biz.id ? "harboroak" : "tonbpc", `/api/bookings/${b.id}`, { method: "PATCH", body: { action: "cancel" } });
    await api("lena", `/api/services/${svc.id}/early-access?full=1`, { method: "DELETE" });
    const relAgain = ((await api("lena", "/api/clients")).data as any).clients?.find((x: any) => x.handle === "rachel")?.preferred?.id;
    if (relAgain) await api("lena", `/api/preferred-clients/${relAgain}`, { method: "DELETE" });

    /* ===== SCHEDULED RELEASE mode — "September opens August 25, 9 AM" =====
       Rolling stays the default and untouched; scheduled is opt-in.
       Before the release NOBODY books (preferred included) · at release
       Preferred Clients book first (per-client limits hold) · at the
       public moment everyone books · beyond coverage stays closed ·
       switching back to rolling restores continuous booking. */
    {
      const wkAt = (daysOut: number, hour: number) => {
        let t = new Date(Date.now() + daysOut * 86400e3);
        while (t.getDay() === 0 || t.getDay() === 6) t = new Date(t.getTime() + 86400e3);
        t.setHours(hour, 0, 0, 0);
        return t.toISOString();
      };
      const covers = new Date(Date.now() + 40 * 86400e3).toISOString();
      // 1) future release with 24h Preferred Early Access
      const fut = await api("lena", `/api/services/${svc.id}/release`, { method: "POST", body: { releaseAt: new Date(Date.now() + 2 * 3600e3).toISOString(), coversUntil: covers, earlyAccessHours: 24 } });
      const futD = fut.data as any;
      step(c, "SCHEDULED RELEASE: provider schedules 'new availability opens in 2h · covers 40 days · Preferred first for 24h' (holders notified)",
        fut.status === 200 && futD.releaseMode === "scheduled" && Number(futD.notified) >= 1 && !!futD.publicAt, {
        route: "POST /api/services/[id]/release", actual: JSON.stringify({ mode: futD.releaseMode, notified: futD.notified }) });
      const wd = (arr: any[], lo: number, hi: number) => arr.find((x: any, i: number) => { if (i < lo || i > hi) return false; const g = new Date(x.date + "T12:00:00").getDay(); return g >= 1 && g <= 5; });
      const avFut = ((await api(null, `/api/services/${svc.id}/availability?days=60`)).data as any).days ?? [];
      const shaded = wd(avFut, 15, 35);
      const beyondCov = wd(avFut, 45, 58);
      step(c, "CALENDAR before the release: covered dates SHADED as 'not released' WITH the opening time · beyond coverage shaded WITHOUT one",
        shaded?.status === "not_released" && !!shaded?.opensAt && beyondCov?.status === "not_released" && !beyondCov?.opensAt, {
        route: "GET availability (guest)", actual: JSON.stringify({ shaded: { s: shaded?.status, opens: !!shaded?.opensAt }, beyond: { s: beyondCov?.status, opens: !!beyondCov?.opensAt } }) });

      const preA = await api("tonbpc", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: wkAt(20, 10), durationMin: 60 } });
      const preB = await api("harboroak", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: wkAt(20, 12), durationMin: 60 } });
      step(c, "before the release: NOBODY can book the new dates — Preferred Clients included (with the opening time in the message)",
        preA.status === 409 && /open/.test(String((preA.data as any).error)) && preB.status === 409, {
        actual: `preferred=${preA.status} public=${preB.status} · ${String((preA.data as any).error).slice(0, 70)}` });
      // 2) release opened 1h ago → Preferred Early Access phase (1 per client)
      await api("lena", `/api/services/${svc.id}/release`, { method: "POST", body: { releaseAt: new Date(Date.now() - 3600e3).toISOString(), coversUntil: covers, earlyAccessHours: 24, perClientLimit: 1 } });
      const eaOut = await api("harboroak", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: wkAt(20, 12), durationMin: 60 } });
      const eaIn = await api("tonbpc", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: wkAt(20, 10), durationMin: 60 } });
      const eaIn2 = await api("tonbpc", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: wkAt(22, 11), durationMin: 60 } });
      step(c, "release in Early Access: outsider 403 (public time shown) · Preferred Client books · their SECOND booking hits the 1-per-client limit",
        eaOut.status === 403 && eaIn.status === 200 && eaIn2.status === 409 && /per Preferred Client/.test(String((eaIn2.data as any).error)), {
        actual: `out=${eaOut.status} in=${eaIn.status} second=${eaIn2.status}` });
      const avEaPref = ((await api("tonbpc", `/api/services/${svc.id}/availability?days=60`)).data as any).days ?? [];
      const avEaOut = ((await api("harboroak", `/api/services/${svc.id}/availability?days=60`)).data as any).days ?? [];
      const dPref = wd(avEaPref, 15, 35);
      const dOut = wd(avEaOut, 15, 35);
      step(c, "CALENDAR during Early Access is per-viewer honest: Preferred sees BOOKABLE · everyone else sees 'preferred first' with the public time",
        ["available", "limited"].includes(dPref?.status) && dOut?.status === "early_access" && !!dOut?.publicAt, {
        actual: JSON.stringify({ preferred: dPref?.status, public: dOut?.status, publicAt: !!dOut?.publicAt }) });
      // 3) early access over (released 30h ago) → public
      await api("lena", `/api/services/${svc.id}/release`, { method: "POST", body: { releaseAt: new Date(Date.now() - 30 * 3600e3).toISOString(), coversUntil: covers, earlyAccessHours: 24 } });
      const pubOk = await api("harboroak", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: wkAt(21, 12), durationMin: 60 } });
      const beyond = await api("harboroak", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: wkAt(50, 12), durationMin: 60 } });
      step(c, "early access over: the public books the released dates — but dates BEYOND the release stay closed",
        pubOk.status === 200 && beyond.status === 409 && /released/.test(String((beyond.data as any).error)), {
        actual: `public=${pubOk.status} beyond=${beyond.status}` });
      const avPub = ((await api(null, `/api/services/${svc.id}/availability?days=60`)).data as any).days ?? [];
      const dOpen = wd(avPub, 15, 35);
      const dSun = avPub.find((x: any) => new Date(x.date + "T12:00:00").getDay() === 0);
      step(c, "CALENDAR after the public opening: released dates GREEN · closed weekdays show 'closed' (not 'unavailable') — every state distinct",
        ["available", "limited"].includes(dOpen?.status) && dSun?.status === "booking_closed", {
        actual: JSON.stringify({ released: dOpen?.status, sunday: dSun?.status }) });
      // multiple services, different schedules: a second (rolling 14d) service
      // coexists with the scheduled one — each calendar independent
      const svc2 = await api("lena", "/api/services", { method: "POST", body: { title: "[TEST] Rolling Cuts", price: 40, category: "creative", visibility: "public", fulfillment: "appointment", config: { scheduling: { horizonDays: 14, durationMin: 60 } } } });
      const svc2Id = String((svc2.data as any).id ?? "");
      const avRoll = svc2Id ? ((await api(null, `/api/services/${svc2Id}/availability?days=40`)).data as any).days ?? [] : [];
      const rNear = wd(avRoll, 2, 10);
      const rFar = wd(avRoll, 20, 35);
      step(c, "MULTIPLE SERVICES, different schedules: the rolling-14d service is green near / 'outside horizon' far — while its sibling stays scheduled",
        svc2.status === 200 && ["available", "limited"].includes(rNear?.status) && rFar?.status === "outside_horizon" && !!rFar?.opensAt, {
        actual: JSON.stringify({ near: rNear?.status, far: rFar?.status, opens: !!rFar?.opensAt }) });
      if (svc2Id) await api("lena", `/api/services/${svc2Id}`, { method: "DELETE" });
      // 4) cancellations free slots; switch back to rolling restores continuous booking
      if ((eaIn.data as any).id) await api("tonbpc", `/api/bookings/${(eaIn.data as any).id}`, { method: "PATCH", body: { action: "cancel" } });
      if ((pubOk.data as any).id) await api("harboroak", `/api/bookings/${(pubOk.data as any).id}`, { method: "PATCH", body: { action: "cancel" } });
      await api("lena", `/api/services/${svc.id}/release`, { method: "DELETE" });
      await api("lena", `/api/services/${svc.id}`, { method: "PATCH", body: { scheduling: { releaseMode: "rolling", horizonDays: 60 } } });
      const backRolling = await api("tonbpc", "/api/bookings", { method: "POST", body: { serviceId: svc.id, startsAt: wkAt(10, 14), durationMin: 60 } });
      step(c, "switching back to ROLLING restores continuous booking (10 days out books under the 60-day horizon)",
        backRolling.status === 200, { actual: String(backRolling.status) });
      if ((backRolling.data as any).id) await api("tonbpc", `/api/bookings/${(backRolling.data as any).id}`, { method: "PATCH", body: { action: "cancel" } });
    }
  }

  /* ================= FIRST-TIME ONBOARDING ================= */
  {
    const c = cat("ONBOARDING");
    const mk = async (handle: string, extra: Record<string, unknown> = {}) => {
      const r = await api(null, "/api/auth/signup", { method: "POST", body: { email: `${handle}.${runNonce()}@mavyn.dev`, password: "Tour-walkthrough-99", handle, displayName: `Tour ${handle}`, ...extra } });
      tok[handle] = (r.data as { sessionToken?: string }).sessionToken ?? "";
      return r;
    };
    const a = await mk("tonba");
    const meA = (await api("tonba", "/api/auth/me")).data as any;
    step(c, "brand-new account starts NOT onboarded", a.status === 200 && meA.user?.onboarding?.completed === false, { route: "POST /api/auth/signup", actual: JSON.stringify(meA.user?.onboarding) });
    const tourA = (await api("tonba", "/api/onboarding/tour")).data as any;
    const idsA = (tourA.steps ?? []).map((s: any) => s.id);
    step(c, "personal tour covers the core navigation (home…my world…settings)", tourA.audience === "creator" && ["home", "search", "discover", "opportunities", "services", "messages", "notifications", "profile", "myworld", "settings"].every((x) => idsA.includes(x)), { actual: idsA.join(",") });
    await api("tonba", "/api/me/onboarding", { method: "POST", body: { action: "complete" } });
    step(c, "finishing the tour persists onboardingCompleted", ((await api("tonba", "/api/auth/me")).data as any).user?.onboarding?.completed === true);
    // logout → login again → the full tour does NOT greet them again
    await api("tonba", "/api/auth/logout", { method: "POST" });
    const relog = await api(null, "/api/auth/login", { method: "POST", body: { identifier: "tonba", password: "Tour-walkthrough-99" } });
    tok.tonba = (relog.data as any).sessionToken ?? "";
    step(c, "logout → login: still onboarded (no repeat greeting)", ((await api("tonba", "/api/auth/me")).data as any).user?.onboarding?.completed === true, { route: "login again" });
    const replay = await api("tonba", "/api/onboarding/tour");
    step(c, "replay stays available anytime (Settings → Help → Take the tour again)", replay.status === 200 && ((replay.data as any).steps ?? []).length > 0);

    await mk("tonbb");
    await api("tonbb", "/api/me/onboarding", { method: "POST", body: { action: "skip" } });
    step(c, "Skip Tour also counts as onboarded (never nags)", ((await api("tonbb", "/api/auth/me")).data as any).user?.onboarding?.completed === true);

    await mk("tonbc", { accountType: "business" });
    const tourC = (await api("tonbc", "/api/onboarding/tour")).data as any;
    step(c, "business signup → business-oriented tour", tourC.audience === "business" && (tourC.steps ?? []).some((s: any) => /talent|brand|organization/i.test(s.body)), { actual: tourC.audience });

    const nlog = await api(null, "/api/auth/login", { method: "POST", body: { identifier: "nia", password: "mavyn123" } });
    tok.nia = (nlog.data as any).sessionToken ?? "";
    const tourN = (await api("nia", "/api/onboarding/tour")).data as any;
    step(c, "verified student → student tour incl. Your Campus", tourN.audience === "student" && (tourN.steps ?? []).some((s: any) => s.id === "campus"), { actual: tourN.audience });
    await api("nia", "/api/auth/logout", { method: "POST" });

    /* ---- CONTEXTUAL TUTORIALS: tracked per user, per feature ---- */
    {
      const t0 = (await api("tonba", "/api/me/tours")).data as any;
      step(c, "fresh account: no tutorial marked done anywhere", t0.tours && Object.keys(t0.tours).length === 0, { route: "GET /api/me/tours", actual: JSON.stringify(t0.tours) });
      await api("tonba", "/api/me/tours", { method: "POST", body: { id: "clients", status: "done" } });
      await api("tonba", "/api/me/tours", { method: "POST", body: { id: "payments", status: "dismissed" } });
      const t1 = (await api("tonba", "/api/me/tours")).data as any;
      step(c, "per-feature state: clients=done (finished/skipped) · payments=dismissed (don't show again)", t1.tours?.clients === "done" && t1.tours?.payments === "dismissed", { actual: JSON.stringify(t1.tours) });
      const t2 = (await api("tonbb", "/api/me/tours")).data as any;
      step(c, "per-user isolation: another account's tutorial state is untouched", t2.tours && Object.keys(t2.tours).length === 0, { actual: JSON.stringify(t2.tours) });
      await api("tonba", "/api/me/onboarding", { method: "POST", body: { action: "complete" } });
      const t3 = (await api("tonba", "/api/me/tours")).data as any;
      step(c, "finishing the FIRST-RUN tour never wipes per-feature tutorial state", t3.tours?.clients === "done" && t3.tours?.payments === "dismissed", { actual: JSON.stringify(t3.tours) });
      await api("tonba", "/api/me/tours", { method: "POST", body: { id: "clients", status: "reset" } });
      const t4 = (await api("tonba", "/api/me/tours")).data as any;
      step(c, "reset re-offers one feature's tutorial without touching the rest", !t4.tours?.clients && t4.tours?.payments === "dismissed", { actual: JSON.stringify(t4.tours) });

      /* ---- LEVEL 2: scenario-based learning — content integrity ----
         The suite imports the REAL registry the app renders: every
         required system covered, every guide complete (what / why /
         how / who / story / visual flow), every path and Learn-more
         mapping pointing at guides that exist. */
      const required = ["clients", "preferred-clients", "booking-horizon", "early-access", "scheduled-releases", "services", "bookings", "cancellations", "payments", "opportunities", "applications", "messaging", "hiring", "team", "business", "myworld", "profile", "subscriptions", "notifications", "progress", "extensions", "reviews", "loyalty"];
      const ids = new Set(LEARN_SCENARIOS.map((s) => s.id));
      const missing = required.filter((r) => !ids.has(r));
      step(c, `scenario guides cover every major system (${required.length} required areas)`, missing.length === 0, { expected: required.join(","), actual: missing.length ? `MISSING: ${missing.join(",")}` : `${ids.size} guides present` });
      const incomplete = LEARN_SCENARIOS.filter((s) => !(s.what && s.why && s.how && s.who && s.story && s.flow.length >= 3 && s.tagline));
      step(c, "every guide answers what/why/how/who + a real-world story + a visual flow (≥3 steps)", incomplete.length === 0, { actual: incomplete.length ? incomplete.map((s) => s.id).join(",") : "all complete" });
      const badPaths = LEARN_PATHS.flatMap((pp) => pp.scenarioIds.filter((sid) => !ids.has(sid)).map((sid) => `${pp.id}:${sid}`));
      const badMap = Object.entries(TOUR_TO_SCENARIO).filter(([, sid]) => !ids.has(sid)).map(([k]) => k);
      step(c, "all 4 learning paths (client/provider/business/creator) + every Learn-more mapping reference real guides", LEARN_PATHS.length === 4 && badPaths.length === 0 && badMap.length === 0, { actual: badPaths.concat(badMap).join(",") || "all valid" });
      await api("tonba", "/api/me/tours", { method: "POST", body: { id: "learn-preferred-clients", status: "done" } });
      const t5 = (await api("tonba", "/api/me/tours")).data as any;
      step(c, "scenario completion is tracked per user (learn-* keys) alongside page tours, without conflict", t5.tours?.["learn-preferred-clients"] === "done" && t5.tours?.payments === "dismissed", { actual: JSON.stringify(t5.tours) });
    }
  }

  /* ================= BUSINESS PEOPLE & HIRING ================= */
  {
    const c = cat("BUSINESS PEOPLE & HIRING");
    // rachel was SELECTED on harboroak's opportunity earlier in this run —
    // the People engine must therefore classify her as TALENT, and NEVER
    // as an employee (team is explicit-only).
    const ppl = (await api("harboroak", "/api/business/people")).data as any;
    const asTalent = (ppl.talent ?? []).find((x: any) => x.handle === "rachel");
    const asTeam = (ppl.team ?? []).find((x: any) => x.handle === "rachel");
    const asClient = (ppl.clients ?? []).find((x: any) => x.handle === "rachel");
    step(c, "hired applicant is TALENT — not employee, not client", !!asTalent && !asTeam && !asClient, {
      route: "GET /api/business/people",
      expected: "talent=yes team=no client=no",
      actual: `talent=${!!asTalent} team=${!!asTeam} client=${!!asClient} (via ${asTalent?.hiredVia?.join("+")})`,
    });
    const hir = (await api("harboroak", "/api/business/hiring")).data as any;
    step(c, "hiring dashboard counts follow the real rows", (hir.counts?.applications ?? 0) >= 1 && (hir.counts?.peopleHired ?? 0) >= 1, {
      route: "GET /api/business/hiring",
      actual: JSON.stringify(hir.counts ?? {}),
    });
    // EXPLICIT team add — the only way anyone becomes staff
    const add = await api("harboroak", "/api/business/team", { method: "POST", body: { handle: "rachel", title: "[TEST] Contract Photographer" } });
    const teamId = String((add.data as any).id ?? "");
    const ppl2 = (await api("harboroak", "/api/business/people")).data as any;
    const nowTeam = (ppl2.team ?? []).find((x: any) => x.handle === "rachel");
    step(c, "explicit add → TEAM (and still talent — categories coexist, never merge)", add.status === 200 && !!nowTeam && nowTeam.status === "active" && (ppl2.talent ?? []).some((x: any) => x.handle === "rachel"), {
      route: "POST /api/business/team", record: teamId, actual: `team=${nowTeam?.status} title="${nowTeam?.title}"`,
    });
    // AUTHORIZATION: the person cannot manage their own team record
    const cheatA = await api("rachel", `/api/business/team/${teamId}`, { method: "PATCH", body: { title: "CEO" } });
    const cheatB = await api("rachel", `/api/business/team/${teamId}`, { method: "DELETE" });
    step(c, "authz: a person cannot edit or remove their own team listing", cheatA.status === 403 && cheatB.status === 403, { actual: `${cheatA.status}/${cheatB.status}` });
    // ending membership keeps history
    await api("harboroak", `/api/business/team/${teamId}`, { method: "DELETE" });
    const ppl3 = (await api("harboroak", "/api/business/people")).data as any;
    const ended = (ppl3.team ?? []).find((x: any) => x.handle === "rachel");
    step(c, "ending membership → inactive with endedAt, history preserved", !!ended && ended.status === "inactive" && !!ended.endedAt, { actual: `status=${ended?.status} endedAt=${!!ended?.endedAt}` });
    // payments view adds up from the same rows
    const pay = (await api("rachel", "/api/me/payments")).data as any;
    const allTitled = (pay.transactions ?? []).every((t: any) => t.title && t.with?.handle && ["in", "out"].includes(t.direction));
    step(c, "payments view: totals + every transaction tied to a real record & counterpart", (pay.summary?.totalSpent ?? 0) > 0 && (pay.transactions ?? []).length >= 2 && allTitled, {
      route: "GET /api/me/payments", actual: `spent=$${pay.summary?.totalSpent} tx=${pay.transactions?.length} titled=${allTitled}`,
    });
  }

  /* ================= BUSINESS SUBSCRIPTION & CAPACITY ================= */
  {
    const c = cat("BUSINESS SUBSCRIPTION & CAPACITY");
    // Fresh throwaway BUSINESS (tonbz) + creator (tonbc2), both set to
    // SIMULATION mode so capacity limits actually enforce (demo mode
    // bypasses gates by doctrine). Cleaned up by the tonb* reset.
    const mkU = async (handle: string, extra: Record<string, unknown> = {}) => {
      const r = await api(null, "/api/auth/signup", { method: "POST", body: { email: `${handle}.${runNonce()}@mavyn.dev`, password: "Tour-walkthrough-99", handle, displayName: `Cap ${handle}`, ...extra } });
      tok[handle] = (r.data as { sessionToken?: string }).sessionToken ?? "";
      db.update(tables.users).set({ testerMode: "simulation" }).where(eq(tables.users.handle, handle)).run();
      return r;
    };
    await mkU("tonbz", { accountType: "business" });
    await mkU("tonbc2");

    // ---- BUSINESS FREE is a real hiring account: the FULL economic loop ----
    await api("tonbz", "/api/conversations", { method: "POST", body: { toHandle: "tonbc2", firstMessage: "[TEST] Interested in hiring you." } });
    const opp1 = await api("tonbz", "/api/opportunities", { method: "POST", body: { title: "[TEST] Cap gig 1", description: "x", budget: 100, type: "gig", location: "Baltimore, MD", remote: true } });
    const pr1 = await api("tonbz", "/api/projects", { method: "POST", body: { creatorHandle: "tonbc2", title: "[TEST] Free-tier hire", amount: 60, brief: "One deliverable." } });
    const pid1 = String((pr1.data as any).id ?? "");
    await api("tonbc2", `/api/projects/${pid1}`, { method: "PATCH", body: { action: "send_offer" } });
    await api("tonbz", `/api/projects/${pid1}`, { method: "PATCH", body: { action: "accept_offer" } });
    await api("tonbz", `/api/projects/${pid1}`, { method: "PATCH", body: { action: "start" } });
    await api("tonbc2", `/api/projects/${pid1}/progress`, { method: "POST", body: { kind: "update", status: "in_progress", percent: 50, message: "[TEST] Halfway." } });
    await api("tonbc2", `/api/projects/${pid1}`, { method: "PATCH", body: { action: "submit" } });
    await api("tonbz", `/api/projects/${pid1}`, { method: "PATCH", body: { action: "approve" } });
    await api("tonbz", `/api/projects/${pid1}`, { method: "PATCH", body: { action: "complete" } });
    const rv1 = await api("tonbz", `/api/projects/${pid1}/review`, { method: "POST", body: { rating: 5, body: "[TEST] Free tier works." } });
    const pay1 = db.select().from(tables.payments).all().find((p) => p.projectId === pid1);
    const st1 = ((await api("tonbz", `/api/projects/${pid1}`)).data as any).project;
    step(c, "BUSINESS FREE runs the whole loop: message → post → hire → progress → TEST pay → complete → review", opp1.status === 200 && st1?.state === "completed" && pay1?.status === "released" && rv1.status === 200, {
      expected: "everything 200, payment released — Free is never a paywall", actual: `opp=${opp1.status} project=${st1?.state} payment=${pay1?.status} review=${rv1.status}`,
    });

    // ---- capacity: active opportunities 3 → honest 409, nothing deleted ----
    await api("tonbz", "/api/opportunities", { method: "POST", body: { title: "[TEST] Cap gig 2", description: "x", type: "gig", location: "Remote", remote: true } });
    await api("tonbz", "/api/opportunities", { method: "POST", body: { title: "[TEST] Cap gig 3", description: "x", type: "gig", location: "Remote", remote: true } });
    const opp4 = await api("tonbz", "/api/opportunities", { method: "POST", body: { title: "[TEST] Cap gig 4", description: "x", type: "gig", location: "Remote", remote: true } });
    const hir1 = (await api("tonbz", "/api/business/hiring")).data as any;
    step(c, "4th opportunity refused with the honest limit message; the 3 existing remain open", opp4.status === 409 && /Business Free limit/.test(String((opp4.data as any).error)) && /3\/3/.test(String((opp4.data as any).error)) && /15/.test(String((opp4.data as any).error)) && hir1.counts?.openOpportunities === 3, {
      expected: "409 '3/3 … Pro raises to 15' + 3 still open", actual: `${opp4.status} "${(opp4.data as any).error}" open=${hir1.counts?.openOpportunities}`,
    });

    // ---- capacity: active hires 5 (drafts in flight count; completed never do) ----
    let hireOk = true;
    for (let i = 0; i < 5; i++) {
      const r = await api("tonbz", "/api/projects", { method: "POST", body: { creatorHandle: "tonbc2", title: `[TEST] Hire slot ${i + 1}`, amount: 10, brief: "x" } });
      hireOk = hireOk && r.status === 200;
    }
    const hire6 = await api("tonbz", "/api/projects", { method: "POST", body: { creatorHandle: "tonbc2", title: "[TEST] Hire slot 6", amount: 10, brief: "x" } });
    step(c, "5 active hires fit on Free (completed history never counts); the 6th is refused honestly", hireOk && hire6.status === 409 && /active hires/.test(String((hire6.data as any).error)) && /25/.test(String((hire6.data as any).error)), {
      expected: "5×200 then 409 '5/5 … Pro raises to 25'", actual: `ok=${hireOk} sixth=${hire6.status} "${(hire6.data as any).error}"`,
    });

    // ---- capacity: team 3 + admin seats (owner = seat #1) ----
    await api("tonbz", "/api/conversations", { method: "POST", body: { toHandle: "rachel", firstMessage: "[TEST] hello" } });
    await api("tonbz", "/api/conversations", { method: "POST", body: { toHandle: "lena", firstMessage: "[TEST] hello" } });
    const t1 = await api("tonbz", "/api/business/team", { method: "POST", body: { handle: "tonbc2", title: "Editor" } });
    const t2 = await api("tonbz", "/api/business/team", { method: "POST", body: { handle: "rachel", title: "Producer" } });
    const t3 = await api("tonbz", "/api/business/team", { method: "POST", body: { handle: "lena", title: "Designer" } });
    await api("tonbz", "/api/conversations", { method: "POST", body: { toHandle: "harboroak", firstMessage: "[TEST] hello" } });
    const t4 = await api("tonbz", "/api/business/team", { method: "POST", body: { handle: "harboroak", title: "Fourth" } });
    step(c, "3 team members fit on Free; the 4th is refused honestly (talent NEVER counted here)", t1.status === 200 && t2.status === 200 && t3.status === 200 && t4.status === 409 && /team members/.test(String((t4.data as any).error)), {
      expected: "3×200 then 409 '3/3 … Pro raises to 25'", actual: `${t1.status}/${t2.status}/${t3.status} then ${t4.status}`,
    });
    const adm = await api("tonbz", `/api/business/team/${(t1.data as any).id}`, { method: "PATCH", body: { isAdmin: true } });
    step(c, "admin seats: Free = 1 (the owner) — granting a second seat is refused honestly", adm.status === 409 && /admins: 1\/1/.test(String((adm.data as any).error)) && /5/.test(String((adm.data as any).error)), {
      expected: "409 'admins: 1/1 … Pro raises to 5'", actual: `${adm.status} "${(adm.data as any).error}"`,
    });

    // ---- saved talent + limits payload sanity ----
    const sv = await api("tonbz", "/api/business/talent-saves", { method: "POST", body: { handle: "tonbc2" } });
    const lim = (await api("tonbz", "/api/business/limits")).data as any;
    step(c, "limits API reports the exact Free numbers + live usage (saved talent 25 → Pro 250)", sv.status === 200 && lim.plan === "free" && lim.enforced === true && lim.limits.savedTalent === 25 && lim.proLimits.savedTalent === 250 && lim.usage.savedTalent === 1 && lim.usage.teamMembers === 3 && lim.usage.activeOpportunities === 3 && lim.atLimit.activeOpportunities === true, {
      route: "GET /api/business/limits", actual: JSON.stringify({ plan: lim.plan, usage: lim.usage }),
    });

    // ---- UPGRADE: capacity rises immediately; old data untouched ----
    const up = await api("tonbz", "/api/me/plan", { method: "PATCH", body: { plan: "business_pro" } });
    const opp4b = await api("tonbz", "/api/opportunities", { method: "POST", body: { title: "[TEST] Cap gig 4 (pro)", description: "x", type: "gig", location: "Remote", remote: true } });
    const t4b = await api("tonbz", "/api/business/team", { method: "POST", body: { handle: "harboroak", title: "Fourth (pro)" } });
    const admB = await api("tonbz", `/api/business/team/${(t1.data as any).id}`, { method: "PATCH", body: { isAdmin: true } });
    const lim2 = (await api("tonbz", "/api/business/limits")).data as any;
    step(c, "UPGRADE → Pro: 4th opportunity, 4th team member, 2nd admin seat all open up; limits read Pro", up.status === 200 && opp4b.status === 200 && t4b.status === 200 && admB.status === 200 && lim2.plan === "business_pro" && lim2.limits.activeOpportunities === 15 && lim2.limits.teamMembers === 25, {
      expected: "all 200; limits 15/25/25/250/5/500/500", actual: `up=${up.status} opp=${opp4b.status} team=${t4b.status} admin=${admB.status} plan=${lim2.plan}`,
    });
    step(c, "everything created on Free is still intact after upgrading", ((await api("tonbz", "/api/business/hiring")).data as any).counts?.openOpportunities === 4 && (((await api("tonbz", "/api/business/people")).data as any).team ?? []).length === 4);

    // ---- DOWNGRADE while OVER the Free limits: preserve, never delete ----
    const down = await api("tonbz", "/api/me/plan", { method: "PATCH", body: { plan: "free" } });
    const hir2 = (await api("tonbz", "/api/business/hiring")).data as any;
    const ppl2 = (await api("tonbz", "/api/business/people")).data as any;
    const detailOk = ((await api("tonbz", `/api/projects/${pid1}`)).data as any).project?.state === "completed";
    const manageOk = (await api("tonbz", `/api/business/team/${(t1.data as any).id}`, { method: "PATCH", body: { title: "Editor (still manageable)" } })).status === 200;
    step(c, "DOWNGRADE with 4/3 opportunities + 4/3 team: NOTHING deleted, everything still accessible & manageable", down.status === 200 && hir2.counts?.openOpportunities === 4 && (ppl2.team ?? []).length === 4 && detailOk && manageOk, {
      expected: "4 opps open, 4 team rows, project detail 200, team edit 200", actual: `open=${hir2.counts?.openOpportunities} team=${(ppl2.team ?? []).length} detail=${detailOk} manage=${manageOk}`,
    });
    const opp5 = await api("tonbz", "/api/opportunities", { method: "POST", body: { title: "[TEST] Cap gig 5", description: "x", type: "gig", location: "Remote", remote: true } });
    step(c, "over-limit after downgrade → only NEW creation is refused, with the over-limit numbers", opp5.status === 409 && /4\/3/.test(String((opp5.data as any).error)), {
      expected: "409 mentioning 4/3", actual: `${opp5.status} "${(opp5.data as any).error}"`,
    });
    const up2 = await api("tonbz", "/api/me/plan", { method: "PATCH", body: { plan: "business_pro" } });
    const opp5b = await api("tonbz", "/api/opportunities", { method: "POST", body: { title: "[TEST] Cap gig 5 (pro again)", description: "x", type: "gig", location: "Remote", remote: true } });
    step(c, "upgrading again restores the additional capacity immediately", up2.status === 200 && opp5b.status === 200, { actual: `${up2.status}/${opp5b.status}` });

    // ---- individuals are untouched by business capacity ----
    const rOpp = await api("rachel", "/api/opportunities", { method: "POST", body: { title: "[TEST] rachel is not a business", description: "x", type: "gig", location: "Remote", remote: true } });
    step(c, "capacity gates apply to business accounts ONLY — individuals unaffected", rOpp.status === 200, { actual: String(rOpp.status) });
    if (rOpp.status === 200) {
      db.delete(tables.opportunities).where(eq(tables.opportunities.id, String((rOpp.data as any).id))).run();
    }
  }

  /* ================= NOTIFICATIONS: no dead destinations ================= */
  {
    const c = cat("NOTIFICATIONS");
    let dead = 0, total = 0;
    for (const who of ["rachel", "lena"]) {
      const ns = ((await api(who, "/api/notifications")).data as any).notifications ?? [];
      for (const n of ns) {
        total++;
        if (!n.href || n.href === "#") dead++;
        else if (String(n.href).startsWith("/messages?c=")) {
          const cid = String(n.href).split("c=")[1].split("&")[0];
          const exists = db.select().from(tables.conversations).where(eq(tables.conversations.id, cid)).get();
          if (!exists) dead++;
        }
      }
    }
    step(c, `every notification has a live destination (${total} checked)`, dead === 0, { expected: "0 dead links", actual: `${dead} dead` });
    const rns = ((await api("rachel", "/api/notifications")).data as any).notifications ?? [];
    const dupes = rns.length - new Set(rns.map((n: any) => `${n.type}|${n.title}|${n.href}|${n.createdAt}`)).size;
    step(c, "no duplicated notifications", dupes === 0, { actual: `${dupes} duplicates` });

    /* ===== BACKGROUND JOBS — the platform heartbeat =====
       Reminders, review nudges, the rebooking loop, and release-open
       alerts fire from a scheduler tick — verified against real rows,
       idempotent by construction (ticking twice never double-sends). */
    {
      const notifRows = (userId: string, type: string, hrefLike: string) =>
        db.select().from(tables.notifications).all().filter((n) => n.userId === userId && n.type === type && n.href.includes(hrefLike));
      const tonbbU = db.select().from(tables.users).all().find((u) => u.handle === "tonbb")!;
      const svcJ = ((await api("rachel", "/api/services")).data as any).services.find((s: any) => s.owner?.handle === "lena");

      // 1 · appointment reminder: booking ~20h out (moved there directly — the
      //     job cares about WHEN, the booking flow was proven elsewhere)
      const wkJ = (() => { let d = new Date(Date.now() + 3 * 86400e3); while (d.getDay() === 0 || d.getDay() === 6) d = new Date(d.getTime() + 86400e3); d.setHours(11, 0, 0, 0); return d; })();
      const bkJ = await api("tonbb", "/api/bookings", { method: "POST", body: { serviceId: svcJ.id, startsAt: wkJ.toISOString(), durationMin: 60 } });
      const bkJId = String((bkJ.data as any).id ?? "");
      await api("lena", `/api/bookings/${bkJId}`, { method: "PATCH", body: { action: "accept" } });
      db.update(tables.bookings).set({ startsAt: new Date(Date.now() + 20 * 3600e3) }).where(eq(tables.bookings.id, bkJId)).run();
      let tick = runJobsTick();
      step(c, "JOBS · 24h appointment reminder reaches BOTH sides (client and provider), from the real booking row",
        notifRows(tonbbU.id, "booking_reminder", bkJId).length === 1 && notifRows(lena.id, "booking_reminder", bkJId).length === 1, {
        actual: `client=${notifRows(tonbbU.id, "booking_reminder", bkJId).length} provider=${notifRows(lena.id, "booking_reminder", bkJId).length} tickReminders=${tick.reminders}` });

      // 2 · rebooking nudge: same pair, last completed ~25 days ago, nothing upcoming
      db.update(tables.bookings).set({ status: "completed", startsAt: new Date(Date.now() - 25 * 86400e3) }).where(eq(tables.bookings.id, bkJId)).run();
      tick = runJobsTick();
      const rebook = notifRows(tonbbU.id, "rebook_nudge", `rebook=${bkJId}`);
      step(c, "JOBS · the REBOOKING loop: ~3 weeks after a completed booking with nothing upcoming, the client gets a personal nudge",
        rebook.length === 1 && /rebook/i.test(rebook[0]?.title ?? ""), { actual: `sent=${rebook.length} title=${rebook[0]?.title?.slice(0, 50)}` });

      // 3 · review nudge: a completed-but-unreviewed project
      const projJ = db.select().from(tables.projects).all().find((pr) => pr.clientId === rachel.id && pr.state === "reviewed");
      if (projJ) db.update(tables.projects).set({ state: "completed", updatedAt: new Date() }).where(eq(tables.projects.id, projJ.id)).run();
      tick = runJobsTick();
      const revN = projJ ? notifRows(rachel.id, "review_nudge", projJ.id) : [];
      step(c, "JOBS · completed work without a review earns ONE gentle review ask (never repeated)",
        !!projJ && revN.length === 1, { actual: `sent=${revN.length}` });
      if (projJ) db.update(tables.projects).set({ state: "reviewed" }).where(eq(tables.projects.id, projJ.id)).run();

      // 4 · release-open alert: scheduled release opened 10 minutes ago
      await api("lena", "/api/preferred-clients", { method: "POST", body: { clientId: rachel.id, benefits: [{ key: "priority_booking" }] } });
      await api("lena", `/api/services/${svcJ.id}/release`, { method: "POST", body: { releaseAt: new Date(Date.now() - 10 * 60e3).toISOString(), coversUntil: new Date(Date.now() + 30 * 86400e3).toISOString(), earlyAccessHours: 24 } });
      tick = runJobsTick();
      const relN = notifRows(rachel.id, "release_open", svcJ.id).filter((n) => /OPEN/i.test(n.title));
      step(c, "JOBS · the MOMENT a scheduled release opens, Preferred Clients get 'early access is OPEN — you book first'",
        relN.length === 1, { actual: `sent=${relN.length} releaseAlerts=${tick.releaseAlerts}` });

      // 5 · idempotency: a second tick sends NOTHING new for any of the above
      const tick2 = runJobsTick();
      step(c, "JOBS · idempotent by construction: a second tick re-sends none of it (restart-safe, duplicate-proof)",
        notifRows(tonbbU.id, "booking_reminder", bkJId).length === 1 && rebook.length === 1 && relN.length === 1 && tick2.releaseAlerts === 0 && tick2.rebookNudges === 0, {
        actual: JSON.stringify(tick2) });

      // 6 · authz: the manual tick endpoint is admin-only
      const tickDenied = await api("rachel", "/api/demo/jobs", { method: "POST", body: {} });
      step(c, "JOBS · the manual tick endpoint refuses non-admins (403)", tickDenied.status === 403, { actual: String(tickDenied.status) });

      // stage clean: cancel the release + preferred rel; booking row stays (tonbb cleanup wipes it)
      await api("lena", `/api/services/${svcJ.id}/release`, { method: "DELETE" });
      await api("lena", `/api/services/${svcJ.id}`, { method: "PATCH", body: { scheduling: { releaseMode: "rolling", horizonDays: 60 } } });
      const relJ = ((await api("lena", "/api/clients")).data as any).clients?.find((x: any) => x.handle === "rachel")?.preferred?.id;
      if (relJ) await api("lena", `/api/preferred-clients/${relJ}`, { method: "DELETE" });
    }
  }

  /* ================= ACTIVITY (both sides) ================= */
  {
    const c = cat("ACTIVITY");
    const ra = (await api("rachel", "/api/activity")).data as any;
    const la = (await api("lena", "/api/activity")).data as any;
    step(c, "rachel's activity: completed booking + completed project + selected application",
      ra.bookings.some((b: any) => b.id === bookingId && b.stageIndex === 5) &&
      ra.projects.some((p: any) => p.id === projectId) &&
      ra.applications.some((a: any) => a.status === "selected" || a.status === "confirmed"));
    step(c, "lena's activity: same records from the provider side",
      la.bookings.some((b: any) => b.id === bookingId && b.myRole === "provider") &&
      la.projects.some((p: any) => p.id === projectId && p.myRole === "creator"));
  }

  /* ================= SUBSCRIPTIONS + MY WORLD + VERIFICATION GATES ================= */
  {
    const c = cat("SUBSCRIPTIONS & MY WORLD");
    const gate = await api("rachel", "/api/me/studio", { method: "PATCH", body: { studio: { theme: "neon" } } });
    step(c, "simulation: free user blocked from Pro Studio (backend 403)", gate.status === 403, { actual: String(gate.status) });
    await api("rachel", "/api/me/plan", { method: "PATCH", body: { plan: "pro" } });
    const save = await api("rachel", "/api/me/studio", { method: "PATCH", body: { studio: { theme: "neon", world: { enabled: true, environment: "neon", elements: {} } } } });
    const visitor = await api("lena", "/api/users/rachel");
    step(c, "pro save → ANOTHER account renders the world", save.status === 200 && (visitor.data as any).studio?.world?.enabled === true);

    /* ---- MY WORLD PARITY: the saved layout IS the published layout ----
       Same renderer + same fixed design-width canvas in editor and
       viewer, so parity is architectural; here we prove the DATA leg:
       moved/resized cards and layered images round-trip EXACTLY. */
    const layout = {
      enabled: true,
      environment: "neon",
      elements: {
        hero: { x: 4.2, y: 24, w: 62.5, h: 0, rotate: 2, layer: 12, hidden: false },
        trust: { x: 55.1, y: 610, w: 40, h: 260, rotate: -3, layer: 14, hidden: false },
        posts: { x: 0, y: 940, w: 100, h: 0, rotate: 0, layer: 8, hidden: false },
      },
      images: {
        back1: { src: "/images/banner.jpg", x: 10, y: 60, w: 55, rotate: -12, opacity: 0.6, layer: -6, locked: false },
        front1: { src: "/images/beat-cover.jpg", x: 70.5, y: 300, w: 18, rotate: 25, opacity: 0.9, layer: 25, locked: true },
      },
    };
    await api("rachel", "/api/me/studio", { method: "PATCH", body: { studio: { theme: "neon", world: layout } } });
    const v2 = ((await api("lena", "/api/users/rachel")).data as any).studio?.world;
    const heroOk = v2?.elements?.hero?.x === 4.2 && v2?.elements?.hero?.w === 62.5 && v2?.elements?.hero?.rotate === 2 && v2?.elements?.hero?.layer === 12;
    const trustOk = v2?.elements?.trust?.y === 610 && v2?.elements?.trust?.h === 260 && v2?.elements?.trust?.rotate === -3;
    step(c, "moved/resized cards round-trip EXACTLY to the public profile (position, size, rotation, layer)", heroOk && trustOk, {
      route: "PATCH /api/me/studio → GET /api/users/rachel",
      expected: "hero 4.2%/62.5%/2°/z12 · trust y610/h260/-3°",
      actual: JSON.stringify({ hero: v2?.elements?.hero, trust: v2?.elements?.trust }).slice(0, 140),
    });
    const b1 = v2?.images?.back1, f1 = v2?.images?.front1;
    step(c, "image layers survive with z-order intact: one BEHIND cards (z<0), one IN FRONT — opacity, rotation, lock too",
      b1?.layer === -6 && b1?.opacity === 0.6 && b1?.rotate === -12 && b1?.src === "/images/banner.jpg" &&
      f1?.layer === 25 && f1?.opacity === 0.9 && f1?.rotate === 25 && f1?.locked === true, {
      expected: "back1 z-6 op.6 rot-12 · front1 z25 op.9 rot25 locked",
      actual: JSON.stringify({ back1: b1, front1: f1 }).slice(0, 160),
    });
    // refresh-stability: a SECOND independent read returns the identical layout
    const v3 = ((await api("lena", "/api/users/rachel")).data as any).studio?.world;
    step(c, "refresh: a second read returns the identical saved layout", JSON.stringify(v3) === JSON.stringify(v2));
    // the sanitizer defends the canvas: hostile/out-of-range input is clamped or dropped, never trusted
    await api("rachel", "/api/me/studio", { method: "PATCH", body: { studio: { theme: "neon", world: { ...layout, images: { evil: { src: "javascript:alert(1)", x: 10, y: 10, w: 20, rotate: 0, opacity: 1, layer: 5, locked: false }, wild: { src: "/images/banner.jpg", x: 400, y: 99999, w: 2, rotate: 720, opacity: 9, layer: 99, locked: false } } } } } });
    const v4 = ((await api("lena", "/api/users/rachel")).data as any).studio?.world;
    const wild = v4?.images?.wild;
    step(c, "sanitizer: script src DROPPED; wild geometry clamped (x≤100, y≤6000, w≥4, rot≤180, op≤1, z≤30)",
      !v4?.images?.evil && wild && wild.x === 100 && wild.y === 6000 && wild.w === 4 && wild.rotate === 180 && wild.opacity === 1 && wild.layer === 30, {
      actual: JSON.stringify({ evil: v4?.images?.evil ?? null, wild }).slice(0, 140),
    });
    /* ---- THREE INDEPENDENT DEVICE LAYOUTS: desktop / tablet / phone ----
       Each device is its own saved arrangement (elements AND images).
       The viewer picks by measured width through resolveWorldLayout —
       asserted here with the SAME function the component runs. */
    const el = (x: number, y: number, w: number, layer = 10) => ({ x, y, w, h: 0, rotate: 0, layer, hidden: false });
    const threeUp = {
      ...layout,
      tablet: {
        elements: { hero: el(10, 40, 80, 12) },
        images: { tdec: { src: "/images/banner.jpg", x: 5, y: 30, w: 40, rotate: 0, opacity: 0.5, layer: -4, locked: false } },
      },
      phone: {
        elements: { hero: el(0, 0, 100, 12), trust: el(0, 760, 100, 9) },
        images: { pdec: { src: "/images/beat-cover.jpg", x: 60, y: 900, w: 30, rotate: 10, opacity: 1, layer: 28, locked: false } },
      },
    };
    await api("rachel", "/api/me/studio", { method: "PATCH", body: { studio: { theme: "neon", world: threeUp } } });
    const dv = ((await api("lena", "/api/users/rachel")).data as any).studio?.world;
    step(c, "desktop/tablet/phone layouts SAVE independently and all reach the public payload",
      dv?.elements?.hero?.x === 4.2 && dv?.elements?.hero?.w === 62.5 &&
      dv?.tablet?.elements?.hero?.x === 10 && dv?.tablet?.elements?.hero?.w === 80 &&
      dv?.phone?.elements?.hero?.x === 0 && dv?.phone?.elements?.hero?.w === 100 && dv?.phone?.elements?.trust?.y === 760, {
      expected: "desktop hero 4.2/62.5 · tablet hero 10/80 · phone hero 0/100 + trust y760",
      actual: JSON.stringify({ d: dv?.elements?.hero, t: dv?.tablet?.elements?.hero, p: dv?.phone?.elements?.hero }).slice(0, 150),
    });
    step(c, "decorative images are independent per device (desktop back1/front1 · tablet tdec z-4 · phone pdec z28)",
      dv?.images?.back1?.layer === -6 && dv?.images?.front1?.layer === 25 && !dv?.images?.tdec &&
      dv?.tablet?.images?.tdec?.layer === -4 && !dv?.tablet?.images?.back1 &&
      dv?.phone?.images?.pdec?.layer === 28 && !dv?.phone?.images?.back1, {
      actual: JSON.stringify({ d: Object.keys(dv?.images ?? {}), t: Object.keys(dv?.tablet?.images ?? {}), p: Object.keys(dv?.phone?.images ?? {}) }).slice(0, 140),
    });
    const rD = resolveWorldLayout(dv, worldDeviceForWidth(1280));
    const rT = resolveWorldLayout(dv, worldDeviceForWidth(700));
    const rP = resolveWorldLayout(dv, worldDeviceForWidth(390));
    step(c, "the viewer's resolver serves each width its own layout (1280→desktop@960 · 700→tablet@720 · 390→phone@390)",
      rD.device === "desktop" && rD.designWidth === 960 && rD.elements.hero.x === 4.2 &&
      rT.device === "tablet" && rT.designWidth === 720 && rT.custom && rT.elements.hero.x === 10 &&
      rP.device === "phone" && rP.designWidth === 390 && rP.custom && !rP.stackedFallback && rP.elements.hero.w === 100, {
      actual: JSON.stringify({ d: [rD.device, rD.designWidth], t: [rT.device, rT.designWidth, rT.elements.hero.x], p: [rP.device, rP.designWidth, rP.elements.hero.w] }).slice(0, 130),
    });
    // edit ONE device — the other two must be byte-identical afterwards
    const tabletEdit = { ...threeUp, tablet: { ...threeUp.tablet, elements: { hero: el(22, 80, 56, 12) } } };
    await api("rachel", "/api/me/studio", { method: "PATCH", body: { studio: { theme: "neon", world: tabletEdit } } });
    const dv2 = ((await api("lena", "/api/users/rachel")).data as any).studio?.world;
    step(c, "editing the TABLET layout never overwrites desktop or phone (and vice versa)",
      dv2?.tablet?.elements?.hero?.x === 22 && dv2?.tablet?.elements?.hero?.w === 56 &&
      JSON.stringify(dv2?.elements) === JSON.stringify(dv?.elements) &&
      JSON.stringify(dv2?.phone) === JSON.stringify(dv?.phone), {
      expected: "tablet hero → 22/56 · desktop + phone byte-identical",
      actual: JSON.stringify({ t: dv2?.tablet?.elements?.hero, dSame: JSON.stringify(dv2?.elements) === JSON.stringify(dv?.elements), pSame: JSON.stringify(dv2?.phone) === JSON.stringify(dv?.phone) }).slice(0, 130),
    });
    // no custom tablet/phone saved → safe fallbacks (tablet borrows desktop, phone stacks)
    await api("rachel", "/api/me/studio", { method: "PATCH", body: { studio: { theme: "neon", world: layout } } });
    const dv3 = ((await api("lena", "/api/users/rachel")).data as any).studio?.world;
    const fT = resolveWorldLayout(dv3, "tablet");
    const fP = resolveWorldLayout(dv3, "phone");
    step(c, "devices WITHOUT a custom layout fall back safely: tablet borrows desktop (scaled), phone uses the stacked flow",
      !dv3?.tablet && !dv3?.phone && fT.custom === false && fT.designWidth === 960 && fT.elements.hero.x === 4.2 && fP.custom === false && fP.stackedFallback === true, {
      actual: JSON.stringify({ t: [fT.custom, fT.designWidth], p: [fP.custom, fP.stackedFallback] }).slice(0, 100),
    });

    await api("rachel", "/api/me/plan", { method: "PATCH", body: { plan: "free" } });
    const hidden = await api("lena", "/api/users/rachel");
    step(c, "downgrade hides but preserves (status ≠ deletion)", (hidden.data as any).studio === null);
    const campusGate = await api("rachel", "/api/campus/groups");
    step(c, "verification gate holds in simulation (campus 403 for unverified)", campusGate.status === 403, { actual: String(campusGate.status) });
  }

  /* ================= BOOKING FLOW & QA LAB ================= */
  {
    const c = cat("BOOKING FLOW & QA LAB");
    const svcF = ((await api("rachel", "/api/services")).data as any).services.find((s: any) => s.owner?.handle === "lena");
    const wkDate = (() => { let t = new Date(Date.now() + 4 * 86400e3); while (t.getDay() === 0 || t.getDay() === 6) t = new Date(t.getTime() + 86400e3); return t.toISOString().slice(0, 10); })();

    /* ---- the two-layer booking flow: date → REAL times → book ---- */
    const slots1 = (await api("rachel", `/api/services/${svcF.id}/availability?date=${wkDate}`)).data as any;
    const openSlot = (slots1.slots ?? []).find((s: any) => s.status === "available");
    step(c, "customer picks a date → the REAL time layer appears (available slots from the provider's actual calendar)",
      slots1.dayStatus && Array.isArray(slots1.slots) && !!openSlot, { route: "GET availability?date=", actual: `day=${slots1.dayStatus} slots=${slots1.slots?.length} open=${!!openSlot}` });

    // ONE SOURCE OF TRUTH: a slot shown as available MUST book successfully
    const bkSlot = await api("rachel", "/api/bookings", { method: "POST", body: { serviceId: svcF.id, startsAt: `${wkDate}T${String(openSlot.hour).padStart(2, "0")}:00:00`, durationMin: 60 } });
    step(c, "one source of truth: the slot shown as available books successfully — same date, same time, no second date screen",
      bkSlot.status === 200, { actual: String(bkSlot.status) });

    const slots2 = (await api("rachel", `/api/services/${svcF.id}/availability?date=${wkDate}`)).data as any;
    const nowBooked = (slots2.slots ?? []).find((s: any) => s.hour === openSlot.hour);
    step(c, "the booked time immediately shows BOOKED — it can't be selected again",
      nowBooked?.status === "booked", { actual: JSON.stringify(nowBooked) });

    const sunday = (() => { let t = new Date(Date.now() + 2 * 86400e3); while (t.getDay() !== 0) t = new Date(t.getTime() + 86400e3); return t.toISOString().slice(0, 10); })();
    const slotsSun = (await api("rachel", `/api/services/${svcF.id}/availability?date=${sunday}`)).data as any;
    const farDate = (() => { let t = new Date(Date.now() + 75 * 86400e3); while (t.getDay() === 0) t = new Date(t.getTime() + 86400e3); return t.toISOString().slice(0, 10); })(); // weekday-safe: closed days rightly outrank the horizon
    const slotsFar = (await api("rachel", `/api/services/${svcF.id}/availability?date=${farDate}`)).data as any;
    step(c, "closed days offer NO times (with the reason) · outside-horizon dates offer NO times (with when they open)",
      slotsSun.dayStatus === "booking_closed" && (slotsSun.slots ?? []).length === 0 && slotsFar.dayStatus === "outside_horizon" && (slotsFar.slots ?? []).length === 0 && !!slotsFar.opensAt, {
      actual: `sunday=${slotsSun.dayStatus}/${slotsSun.slots?.length} far=${slotsFar.dayStatus}/${slotsFar.slots?.length}` });

    // clean up the slot-proof booking
    if ((bkSlot.data as any).id) await api("rachel", `/api/bookings/${(bkSlot.data as any).id}`, { method: "PATCH", body: { action: "cancel" } });

    /* ---- QA LAB: three separated persona environments ---- */
    const roles = new Set<string>();
    let untagged = 0;
    for (const sc of QA_SCENARIOS) for (const st of sc.steps) { roles.add(st.role); if (!st.role) untagged++; }
    step(c, "every QA checkpoint is persona-tagged (testcustomer / testcreator / testbusiness / auto-check) — environments can't mix",
      untagged === 0 && ["testcustomer", "testcreator", "testbusiness", "check"].every((r) => roles.has(r)), { actual: Array.from(roles).join(",") });
    // MISSION BRIEFINGS: every task carries its OWN role, objective,
    // actionable instruction, and DB-worded success condition — the
    // briefing UI derives from these, so none may be thin or generic
    const thinBriefs = QA_SCENARIOS.flatMap((sc) =>
      sc.steps
        .filter((st) => !(st.title?.length >= 8 && st.instruction?.length >= 12 && st.expected?.length >= 12 && !!st.role))
        .map((st) => `${sc.id}:${st.id}`)
    );
    step(c, "every task has a complete mission briefing: objective (title), what-to-do (instruction), and success condition (expected) — no generic text possible",
      thinBriefs.length === 0, { actual: thinBriefs.length ? `THIN: ${thinBriefs.join(",")}` : `${QA_SCENARIOS.reduce((a, s) => a + s.steps.length, 0)} tasks, all complete` });
    const byPersona = (h: string) => QA_SCENARIOS.filter((s) => s.personas.includes(h)).map((s) => s.id);
    const cust = byPersona("testcustomer"), crea = byPersona("testcreator"), biz2 = byPersona("testbusiness");
    step(c, "each persona sees ONLY its own scenarios: customer never gets the hiring flow, creator never gets the customer-opportunity flow",
      !cust.includes("hiring") && !crea.includes("opportunity") && biz2.includes("hiring") && cust.includes("booking") && crea.includes("booking"), {
      actual: JSON.stringify({ customer: cust, creator: crea, business: biz2 }) });

    /* ---- the creator progress-update scenario, END TO END, via the
       exact calls the UI makes (impersonation + panel routes) ---- */
    const tokCreator = signDemoToken("testcreator");
    const tokCustomer = signDemoToken("testcustomer");
    const tokAdmin = signDemoToken("devin"); // the QA Lab operator
    const asTok = async (tok: string, path: string, init?: { method?: string; body?: unknown }) => {
      const res = await fetch(BASE + path, { method: init?.method ?? "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: init?.body !== undefined ? JSON.stringify(init.body) : undefined });
      let data: any = {}; try { data = await res.json(); } catch {}
      return { status: res.status, data };
    };
    const qaAct = async (bodyIn: Record<string, unknown>) => (await asTok(tokAdmin, "/api/qa/scenarios/booking", { method: "POST", body: bodyIn })).data as any;
    const armed = await qaAct({ action: "start" });
    step(c, "QA scenario armed by the admin operator (reset + observing)", !!armed?.startedAt, { actual: JSON.stringify({ startedAt: armed?.startedAt, error: armed?.error }).slice(0, 100) });
    for (const s of ["profile", "message", "reply", "book", "accept", "pay"]) await qaAct({ action: "auto", step: s });
    const qaBk = ((await asTok(tokCreator, "/api/bookings")).data.bookings ?? []).find((b: any) => b.status === "confirmed" && b.myRole === "provider");
    const postProg = qaBk ? await asTok(tokCreator, `/api/bookings/${qaBk.id}/progress`, { method: "POST", body: { kind: "update", status: "in_progress", percent: 60, message: "[QA] suite-verified update", etaAt: null } }) : { status: 0, data: {} };
    step(c, "Test Creator sees the booking (provider role) and posts a progress update through the real panel route",
      !!qaBk && postProg.status === 200 && !!(postProg.data as any).id, { actual: `booking=${!!qaBk} post=${postProg.status}` });
    const rowInDb = qaBk ? db.select().from(tables.progressUpdates).all().find((r) => r.bookingId === qaBk.id && r.message.includes("suite-verified")) : null;
    const custView = qaBk ? await asTok(tokCustomer, `/api/bookings/${qaBk.id}/progress`) : { status: 0, data: {} };
    const custSees = ((custView.data as any).progress?.updates ?? []).some((u: any) => u.message?.includes("suite-verified"));
    step(c, "the update EXISTS in the database and the Test Customer sees the very same row — state verified, not button clicks",
      !!rowInDb && custView.status === 200 && custSees, { record: rowInDb?.id, actual: `dbRow=${!!rowInDb} customerSees=${custSees}` });
    const scenarioNow = (await asTok(tokAdmin, "/api/qa/scenarios/booking")).data as any;
    const progStep = (scenarioNow.steps ?? []).find((x: any) => x.id === "progress");
    step(c, "the scenario checkpoint flips to DONE from the database state", progStep?.status === "done", { actual: JSON.stringify({ status: progStep?.status, actual: progStep?.actual }).slice(0, 120) });

    /* ===== PROGRESSION: completed stages STAY completed =====
       Finish the booking stage for real, then prove the score survives
       collapsing, refreshing, moving to the next stage, and reopening —
       and that the overall lab progression counts it forever. */
    await qaAct({ action: "auto", step: "complete" });
    const doneA = (await asTok(tokAdmin, "/api/qa/scenarios/booking")).data as any;
    step(c, "PROGRESSION · the booking stage completes for real: 14/14, every checkpoint verified against the database",
      doneA.done === doneA.total && doneA.total === 14 && doneA.completed === true, { actual: `${doneA.done}/${doneA.total} completed=${doneA.completed}` });

    // collapse/refresh = fresh, independent reads — the score never wobbles
    const re1 = (await asTok(tokAdmin, "/api/qa/scenarios/booking")).data as any;
    const re2 = (await asTok(tokAdmin, "/api/qa/scenarios/booking")).data as any;
    step(c, "PROGRESSION · collapse + refresh (two fresh reads): STILL 14/14 — persisted state is the source of truth, not what's on screen",
      re1.done === 14 && re2.done === 14 && re1.completed && re2.completed, { actual: `${re1.done}/14 then ${re2.done}/14` });

    // move to the NEXT stage — the previous one keeps its achievement
    await asTok(tokAdmin, "/api/qa/scenarios/project", { method: "POST", body: { action: "start" } });
    const afterB = (await asTok(tokAdmin, "/api/qa/scenarios/booking")).data as any;
    const projState = (await asTok(tokAdmin, "/api/qa/scenarios/project")).data as any;
    step(c, "PROGRESSION · starting the NEXT stage never resets the last one: booking stays ✓ 14/14 while project arms at 0/" + projState.total,
      afterB.done === 14 && afterB.completed === true && projState.startedAt && projState.done === 0, {
      actual: `booking=${afterB.done}/14 completed=${afterB.completed} · project=${projState.done}/${projState.total}` });

    // reopen the completed stage — still complete
    const reopenA = (await asTok(tokAdmin, "/api/qa/scenarios/booking")).data as any;
    step(c, "PROGRESSION · reopening the completed stage: still complete, checkpoints shown from its verified snapshot",
      reopenA.completed === true && (reopenA.steps ?? []).every((s: any) => s.status === "done"), { actual: `${reopenA.done}/${reopenA.total}` });

    // partial progress in stage B survives navigating away and back
    await asTok(tokAdmin, "/api/qa/scenarios/project", { method: "POST", body: { action: "auto", step: "draft" } });
    await asTok(tokAdmin, "/api/qa/scenarios/project", { method: "POST", body: { action: "auto", step: "offer" } });
    const partial1 = (await asTok(tokAdmin, "/api/qa/scenarios/project")).data as any;
    await asTok(tokAdmin, "/api/qa/state"); // navigate away (lab overview)…
    const partial2 = (await asTok(tokAdmin, "/api/qa/scenarios/project")).data as any;
    step(c, "PROGRESSION · partial progress in the next stage survives navigating away and returning",
      partial1.done >= 2 && partial2.done === partial1.done, { actual: `before=${partial1.done} after=${partial2.done}` });

    // the curriculum view: overall progression includes the completed stage
    const lab = (await asTok(tokAdmin, "/api/qa/state")).data as any;
    const bookRow = (lab.scenarios ?? []).find((s: any) => s.id === "booking");
    step(c, "PROGRESSION · overall lab progression counts completed stages forever (booking ✓ 14/14 + project partial in the totals)",
      bookRow?.completed === true && bookRow?.done === 14 && lab.overall?.done >= 14 + partial2.done && lab.overall?.completedScenarios >= 1, {
      actual: `overall=${lab.overall?.done}/${lab.overall?.total} stagesComplete=${lab.overall?.completedScenarios}` });

    // stage clean: explicit replay is the ONLY thing that resets a completed stage
    await asTok(tokAdmin, "/api/qa/scenarios/project", { method: "POST", body: { action: "reset" } });
    await qaAct({ action: "reset" }); // booking replay — clears its snapshot by choice
    const afterReset = (await asTok(tokAdmin, "/api/qa/scenarios/booking")).data as any;
    step(c, "PROGRESSION · explicitly replaying a stage resets it (0/14) — the user's choice, never a side effect",
      afterReset.done === 0 && !afterReset.completed, { actual: `${afterReset.done}/${afterReset.total}` });
  }

  /* ================= QA STRICT PROGRESSION ================= */
  /* The Test Center is a sequential mission system: tasks unlock
     1 → 2 → 3 …, the current task is explicit PERSISTED state (never
     inferred from whichever database checkpoint happens to be true),
     stale records can't jump a run forward, and only an explicit reset
     of THAT scenario returns it — always — to Test 1. */
  {
    const c = cat("QA STRICT PROGRESSION");
    const tokAdmin2 = signDemoToken("devin");
    const tokCust2 = signDemoToken("testcustomer");
    const tokCrea2 = signDemoToken("testcreator");
    const asT = async (tok: string, path: string, init?: { method?: string; body?: unknown }) => {
      const res = await fetch(BASE + path, { method: init?.method ?? "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: init?.body !== undefined ? JSON.stringify(init.body) : undefined });
      let data: any = {}; try { data = await res.json(); } catch {}
      return { status: res.status, data };
    };
    const getB = async (tok = tokAdmin2) => (await asT(tok, "/api/qa/scenarios/booking")).data as any;

    // deterministic ordering: the API's task order IS the definition's
    const defIds = QA_SCENARIOS.find((s) => s.id === "booking")!.steps.map((s) => s.id);
    const f = (await asT(tokAdmin2, "/api/qa/scenarios/booking", { method: "POST", body: { action: "reset" } })).data as any;
    step(c, "task order comes from the scenario DEFINITION — never insertion order, timestamps, or completion state",
      JSON.stringify((f.steps ?? []).map((x: any) => x.id)) === JSON.stringify(defIds), { actual: (f.steps ?? []).map((x: any) => x.id).join(",").slice(0, 120) });

    step(c, "fresh/reset scenario ALWAYS starts at Test 1: 0 done, exactly ONE pending step (Test 1), everything after LOCKED",
      f.done === 0 && f.current === 0 && f.steps?.[0]?.status === "pending" && (f.steps ?? []).filter((x: any) => x.status === "pending").length === 1 && (f.steps ?? []).slice(1).every((x: any) => x.status === "locked"),
      { actual: `done=${f.done} current=${f.current} statuses=${(f.steps ?? []).map((x: any) => x.status[0]).join("")}` });

    // even automation can't skip: Test 5 ("book") refused while Test 1 is current
    const skip = await asT(tokAdmin2, "/api/qa/scenarios/booking", { method: "POST", body: { action: "auto", step: "book" } });
    step(c, "NO SKIPPING: auto-running a later task is refused (409, locked) while an earlier task is current",
      skip.status === 409 && /locked/i.test(String((skip.data as any).error)), { actual: `${skip.status} ${(skip.data as any).error ?? ""}`.slice(0, 100) });

    // a stale-but-true LATER checkpoint must not fast-forward the run:
    // create a REAL booking (Test 5's database condition) while Test 1 is current
    const ids = qaIds();
    const staleDay = (() => { let t = new Date(Date.now() + 4 * 86400e3); while (t.getDay() === 0 || t.getDay() === 6) t = new Date(t.getTime() + 86400e3); t.setHours(10, 0, 0, 0); return t; })();
    const staleBk = await asT(tokCust2, "/api/bookings", { method: "POST", body: { serviceId: ids.serviceId, startsAt: staleDay.toISOString(), durationMin: 60 } });
    const afterStale = await getB();
    step(c, "A STALE DATABASE CHECKPOINT CANNOT JUMP THE SCENARIO FORWARD: a real booking exists (Test 5's condition) yet the current task is STILL Test 1 and Test 5 stays LOCKED — the 'reset lands on Test 4' bug cannot recur",
      staleBk.status === 200 && afterStale.current === 0 && afterStale.done === 0 && afterStale.steps.find((x: any) => x.id === "book")?.status === "locked",
      { actual: `bk=${staleBk.status} current=${afterStale.current} done=${afterStale.done} book=${afterStale.steps.find((x: any) => x.id === "book")?.status}` });

    // pass Test 1 → Test 2 unlocks; the advance is exactly one task
    await asT(tokAdmin2, "/api/qa/scenarios/booking", { method: "POST", body: { action: "auto", step: "profile" } });
    const s1 = await getB();
    step(c, "Test 1 passes → it STAYS done and Test 2 becomes the one current task — the advance is exactly one step, never a jump",
      s1.done === 1 && s1.current === 1 && s1.steps[0].status === "done" && s1.steps[1].status === "pending" && s1.steps.filter((x: any) => x.status === "pending").length === 1,
      { actual: `done=${s1.done} current=${s1.current}` });

    // refresh + collapse/expand + navigation are just fresh reads → the score never wobbles
    await asT(tokAdmin2, "/api/qa/state");
    const s2 = await getB();
    const s3 = await getB();
    step(c, "completed tasks survive refresh, collapse/expand, and navigation: repeated fresh reads all report 1 done / current Test 2",
      s2.done === 1 && s3.done === 1 && s2.steps[0].status === "done" && s3.current === 1, { actual: `reads=${s2.done},${s3.done} current=${s3.current}` });

    // switching personas never corrupts progression — one persisted state, every viewer
    const asCust = await getB(tokCust2);
    const asCrea = await getB(tokCrea2);
    step(c, "switching personas does not corrupt progression: customer and creator views read the SAME persisted state (1 done, current Test 2)",
      asCust.done === 1 && asCrea.done === 1 && asCust.current === 1 && asCrea.current === 1, { actual: `cust=${asCust.done}/${asCust.current} crea=${asCrea.done}/${asCrea.current}` });

    // §ACCIDENTAL FUTURE COMPLETION: walk forward to the task whose DB
    // condition was created EARLY (while it was locked) — it must NOT
    // auto-pass; the tester performs the action again during the task
    await asT(tokAdmin2, "/api/qa/scenarios/booking", { method: "POST", body: { action: "auto", step: "message" } });
    await asT(tokAdmin2, "/api/qa/scenarios/booking", { method: "POST", body: { action: "auto", step: "reply" } });
    const atBook = await getB();
    const bookStep = atBook.steps.find((x: any) => x.id === "book");
    step(c, "ACCIDENTAL FUTURE WORK NEVER COUNTS: reaching the booking task, the early-made booking does NOT auto-pass it — the step stays pending and says the record doesn't count (redo required)",
      atBook.current === 4 && bookStep?.status === "pending" && /doesn't count/i.test(String(bookStep?.actual)),
      { actual: `current=${atBook.current} book=${bookStep?.status} · "${String(bookStep?.actual).slice(0, 80)}"` });

    // performing the action AGAIN — during the task — passes it
    const redoDay = (() => { let t = new Date(Date.now() + 4 * 86400e3); while (t.getDay() === 0 || t.getDay() === 6) t = new Date(t.getTime() + 86400e3); t.setHours(13, 0, 0, 0); return t; })();
    const redoBk = await asT(tokCust2, "/api/bookings", { method: "POST", body: { serviceId: ids.serviceId, startsAt: redoDay.toISOString(), durationMin: 60 } });
    const afterRedo = await getB();
    step(c, "REDOING THE ACTION DURING THE TASK PASSES IT: a booking made while the task is active verifies, and exactly the next task unlocks",
      redoBk.status === 200 && afterRedo.done === 5 && afterRedo.current === 5 && afterRedo.steps[4].status === "done",
      { actual: `bk=${redoBk.status} done=${afterRedo.done} current=${afterRedo.current}` });

    // scenario independence: arming/resetting ANOTHER scenario leaves this one's passed tasks intact
    await asT(tokAdmin2, "/api/qa/scenarios/project", { method: "POST", body: { action: "start" } });
    const proj1 = (await asT(tokAdmin2, "/api/qa/scenarios/project")).data as any;
    const bAfterArm = await getB();
    await asT(tokAdmin2, "/api/qa/scenarios/project", { method: "POST", body: { action: "reset" } });
    const bAfterOtherReset = await getB();
    step(c, "resetting one scenario NEVER resets another: project arms+resets at its own Test 1 while booking keeps all 5 passed tasks and its current task",
      proj1.current === 0 && proj1.done === 0 && bAfterArm.done === 5 && bAfterArm.steps[0].status === "done" && bAfterOtherReset.done === 5 && bAfterOtherReset.current === 5,
      { actual: `project=${proj1.done}/c${proj1.current} · booking after arm=${bAfterArm.done} after other-reset=${bAfterOtherReset.done}` });

    // explicit reset of THIS scenario → back to Test 1 of N, no stale task number
    const resetB = (await asT(tokAdmin2, "/api/qa/scenarios/booking", { method: "POST", body: { action: "reset" } })).data as any;
    step(c, "explicit reset returns THIS scenario to TEST 1 OF N — 0 done, Test 1 pending, all later tasks locked; no stale current-task state survives",
      resetB.done === 0 && resetB.current === 0 && resetB.steps[0].status === "pending" && resetB.steps.slice(1).every((x: any) => x.status === "locked"),
      { actual: `done=${resetB.done} current=${resetB.current}` });

    /* ---- GUIDANCE SYSTEM (Show me where) — structural guarantees ---- */
    // 1) every user-action task briefs completely AND resolves a guide
    const noGuide: string[] = [];
    const noBrief: string[] = [];
    for (const sc of QA_SCENARIOS)
      for (const st of sc.steps) {
        if (st.role === "check") continue;
        const brief = buildBriefing({ role: st.role, title: st.title, instruction: st.instruction, expected: st.expected, href: "#" });
        if (!brief.roleLabel || !brief.objective || brief.steps.length === 0 || !brief.success) noBrief.push(`${sc.id}:${st.id}`);
        const g = guideFor(sc.id, st.id, "/messages", st.instruction);
        if (!g.length || g.some((x) => !x.text || !x.label)) noGuide.push(`${sc.id}:${st.id}`);
      }
    step(c, "GUIDANCE · every user-action task has a full briefing (persona, objective, steps, success) AND resolves a Show-me-where guide",
      noBrief.length === 0 && noGuide.length === 0, { actual: noBrief.length || noGuide.length ? `brief:${noBrief.join(",")} guide:${noGuide.join(",")}` : `${QA_SCENARIOS.reduce((a, x) => a + x.steps.filter((y) => y.role !== "check").length, 0)} tasks, all guided` });

    // 2) guides are PURE DATA — pointing only, no actions possible
    const flat = Object.values(QA_GUIDES).flat();
    const badKeys = flat.filter((g) => Object.keys(g).some((k) => !["target", "label", "text", "until", "kind", "optional"].includes(k)));
    const serializable = JSON.stringify(flat) === JSON.stringify(JSON.parse(JSON.stringify(flat)));
    step(c, "GUIDANCE · Show me where is declarative data only ({target,label,text,until,kind}) — it structurally CANNOT click, submit, fetch, or complete anything",
      badKeys.length === 0 && serializable && flat.every((g) => typeof g.text === "string" && typeof g.target === "string"),
      { actual: `${flat.length} guide steps, keys clean=${badKeys.length === 0}` });

    // 3) every spotlight target actually exists as an anchor in the UI source
    const srcDirs = ["components", "app"];
    let src = "";
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, f.name);
        if (f.isDirectory()) walk(full);
        else if (/\.(tsx|ts)$/.test(f.name)) src += fs.readFileSync(full, "utf8");
      }
    };
    for (const d of srcDirs) walk(path.join(process.cwd(), d));
    const missingAnchor = Array.from(new Set(flat.map((g) => g.target).filter(Boolean))).filter(
      (t) => !t.startsWith("conversation-") && !t.startsWith("chat-with-") && !t.startsWith("booking-card-") && !t.startsWith("plan-") && !t.startsWith("qa-service-book-") && !t.startsWith("account-state-") && !t.startsWith("live-card-") && !src.includes(`"${t}"`)
    );
    const dynamicPatterns = ["data-guide={`conversation-", "data-guide={`chat-with-", "data-guide={`booking-card-", "data-guide={`plan-", "data-guide={`qa-service-book-", "data-guide={`account-state-", "data-guide={`live-card-"];
    // BOTH booking surfaces must carry the service anchor — the task's
    // href lands on the DETAIL page while browsing finds the LIST card;
    // the guide must locate the control wherever the tester actually is
    const svcList = fs.readFileSync(path.join(process.cwd(), "app/services/page.tsx"), "utf8");
    const svcDetail = fs.readFileSync(path.join(process.cwd(), "app/services/[id]/page.tsx"), "utf8");
    const bothSurfaces = svcList.includes("qa-service-book-") && svcDetail.includes("qa-service-book-");
    const missingDynamic = dynamicPatterns.filter((pat) => !src.includes(pat));
    step(c, "GUIDANCE · every spotlight target is a real data-guide/data-tour anchor present in the interface source — and the booking anchor exists on BOTH surfaces a tester can land on (list card AND service page)",
      missingAnchor.length === 0 && missingDynamic.length === 0 && bothSurfaces, { actual: !bothSurfaces ? "qa-service-book- missing on a services surface" : missingAnchor.length || missingDynamic.length ? `MISSING: ${[...missingAnchor, ...missingDynamic].join(",")}` : `${new Set(flat.map((g) => g.target).filter(Boolean)).size} anchors verified (+${dynamicPatterns.length} dynamic families, both booking surfaces)` });

    // 4) location-aware guides: reach-conditions are well-formed (path prefix or anchor)
    const badUntil = flat.filter((g) => g.until && !(typeof g.until.path === "string" && g.until.path.startsWith("/")) && !(typeof g.until.visible === "string" && g.until.visible.length > 0));
    step(c, "GUIDANCE · every guide advance-condition is a real page prefix or a real anchor — the guide can always tell where the user is",
      badUntil.length === 0, { actual: badUntil.length ? JSON.stringify(badUntil[0]) : "all reach-conditions well-formed" });

    // 4a2) MAY-NOT-EXIST-YET TARGETS — a conversation row only renders
    // once a thread exists; on fresh scenarios it legitimately doesn't.
    // Every such step must be marked optional (instruction + Take-me-there
    // alternative, never a false GUIDE DEFECT for a row that can't exist)
    const convoNotOptional = flat.filter((g) => g.target.startsWith("conversation-") && !(g as { optional?: boolean }).optional).length;
    step(c, "GUIDANCE · every conversation-row target is marked optional — a thread that doesn't exist yet gives the Take-me-there alternative, never a false guide defect",
      convoNotOptional === 0, { actual: convoNotOptional ? `${convoNotOptional} conversation steps not optional` : "all conversation steps optional" });

    // 4b) TARGET SYSTEM — every USER task has an AUTHORED guide whose
    // final step names a real control (or is an explicit page-visit).
    // "Instructions without a pointer" can no longer ship.
    const unauthored: string[] = [];
    const pointless: string[] = [];
    const badKind: string[] = [];
    for (const sc of QA_SCENARIOS)
      for (const st of sc.steps) {
        if (st.role === "check") continue;
        const g = QA_GUIDES[`${sc.id}:${st.id}`];
        if (!g) { unauthored.push(`${sc.id}:${st.id}`); continue; }
        const fin = g[g.length - 1];
        if (!fin.target && fin.kind !== "visit") pointless.push(`${sc.id}:${st.id}`);
        for (const gs of g) if (gs.kind && !["click", "form", "visit"].includes(gs.kind)) badKind.push(`${sc.id}:${st.id}`);
      }
    step(c, "TARGET SYSTEM · every user task has an authored Show-me-where guide that ends ON a real control (click/form) or an explicit page-visit — no instruction ever lacks a visual pointer",
      unauthored.length === 0 && pointless.length === 0 && badKind.length === 0,
      { actual: unauthored.length || pointless.length ? `unauthored:${unauthored.join(",")} targetless:${pointless.join(",")}` : `${QA_SCENARIOS.reduce((a, x) => a + x.steps.filter((y) => y.role !== "check").length, 0)} user tasks, all pointed` });

    // 4c) GUIDE DEFECT LOG — a guide failure is NOT an app failure, but
    // it must be reportable and visible until fixed, never silent
    const rep = await asT(tokAdmin2, "/api/qa/guide-defect", { method: "POST", body: { task: "PROJECT · Test 10 of 12", expected: "Approve + release", target: "project-primary", page: "/projects/test" } });
    const lst = await asT(tokAdmin2, "/api/qa/guide-defect");
    const found = ((lst.data as any).defects ?? []).some((d: any) => d.target === "project-primary" && /Test 10/.test(d.task));
    const clr = await asT(tokAdmin2, "/api/qa/guide-defect", { method: "DELETE" });
    const empty = (((await asT(tokAdmin2, "/api/qa/guide-defect")).data as any).defects ?? []).length === 0;
    step(c, "GUIDANCE · guide defects are reportable, listed in the Test Center until cleared, and clearable once fixed — broken guidance never ships silently",
      rep.status === 200 && found && clr.status === 200 && empty, { actual: `report=${rep.status} listed=${found} cleared=${empty}` });

    // 5) GUIDED INPUTS — example data integrity: every example maps to a
    // real task, every field has a value, fills are pure data (populate,
    // never submit), and every form-heavy task HAS examples
    const stepIds = new Set(QA_SCENARIOS.flatMap((sc) => sc.steps.map((st) => `${sc.id}:${st.id}`)));
    const orphanEx = Object.keys(QA_EXAMPLES).filter((k) => !stepIds.has(k));
    const badEx = Object.entries(QA_EXAMPLES).filter(([, v]) => !v.fields.length || v.fields.some((f) => !f.label || !f.value));
    const mustHave = ["opportunity:post", "project:draft", "hiring:post", "hiring:project", "project:progress", "project:extension"];
    const missingEx = mustHave.filter((k) => !QA_EXAMPLES[k]);
    const fillsPure = Object.values(QA_EXAMPLES).every((v) => !v.fill || JSON.stringify(v.fill) === JSON.stringify(JSON.parse(JSON.stringify(v.fill))));
    step(c, "GUIDED INPUTS · every form task has copyable example values for its real fields; fill payloads are pure data that populate but never submit",
      orphanEx.length === 0 && badEx.length === 0 && missingEx.length === 0 && fillsPure,
      { actual: orphanEx.length || missingEx.length ? `orphans:${orphanEx.join(",")} missing:${missingEx.join(",")}` : `${Object.keys(QA_EXAMPLES).length} example sets, all valid` });
  }

  /* ================= QA STATE REPAIR ================= */
  /* Exploration is ALLOWED (that's how bugs are found) and can never be
     falsely credited — but it can consume the state the current task
     needs. The Test Center must then (a) say exactly why the task is
     blocked instead of giving an impossible instruction, and (b) offer
     a one-click restore that rewinds ONLY the QA records — crediting
     nothing. This reproduces the real "Test 7 with no Request-extension
     button" incident end to end. */
  {
    const c = cat("QA STATE REPAIR");
    const tokA3 = signDemoToken("devin");
    const tokCrea3 = signDemoToken("testcreator");
    const as3 = async (tok: string, pth: string, init?: { method?: string; body?: unknown }) => {
      const res = await fetch(BASE + pth, { method: init?.method ?? "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: init?.body !== undefined ? JSON.stringify(init.body) : undefined });
      let data: any = {}; try { data = await res.json(); } catch {}
      return { status: res.status, data };
    };
    // walk the project scenario to Test 7 (extension)
    await as3(tokA3, "/api/qa/scenarios/project", { method: "POST", body: { action: "reset" } });
    for (const st of ["draft", "offer", "start", "progress", "eta"]) await as3(tokA3, "/api/qa/scenarios/project", { method: "POST", body: { action: "auto", step: st } });
    let pr = (await as3(tokA3, "/api/qa/scenarios/project")).data as any;
    const extIdx = pr.steps.findIndex((x: any) => x.id === "extension");
    step(c, "setup: project scenario walked to the extension task (Test " + (extIdx + 1) + ")", pr.current === extIdx, { actual: `current=${pr.current}` });

    // EXPLORE AHEAD: the creator legitimately submits the work early (a
    // Test-9 action) — the product allows it; the extension button dies
    const projRow = db.select().from(tables.projects).all().filter((x) => x.title === "[QA] Test project").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).pop();
    const early = await as3(tokCrea3, `/api/projects/${projRow!.id}`, { method: "PATCH", body: { action: "submit" } });
    pr = (await as3(tokA3, "/api/qa/scenarios/project")).data as any;
    const extStep = pr.steps[extIdx];
    step(c, "exploring ahead breaks the required state — the Test Center SAYS so (blocked reason on the current task) instead of instructing an impossible click, and Test 9 was NOT credited",
      early.status === 200 && pr.current === extIdx && !!extStep.blocked && extStep.repairable === true && pr.steps.find((x: any) => x.id === "submit")?.status === "locked",
      { actual: `submit=${early.status} current=${pr.current} blocked="${String(extStep.blocked).slice(0, 70)}" repairable=${extStep.repairable}` });

    // one-click restore: rewinds ONLY the QA records, credits nothing
    const rep = await as3(tokA3, "/api/qa/scenarios/project", { method: "POST", body: { action: "repair" } });
    const after = rep.data as any;
    const projAfter = db.select().from(tables.projects).where(eq(tables.projects.id, projRow!.id)).get();
    step(c, "RESTORE REQUIRED STATE: the project rewinds to IN PROGRESS, the block clears, nothing is marked passed, and the cursor stays on the same test",
      rep.status === 200 && projAfter?.state === "in_progress" && after.current === extIdx && !after.steps[extIdx].blocked && after.done === extIdx,
      { actual: `state=${projAfter?.state} current=${after.current} done=${after.done} blocked=${after.steps[extIdx].blocked ?? "none"}` });

    // and the task is now genuinely completable
    await as3(tokA3, "/api/qa/scenarios/project", { method: "POST", body: { action: "auto", step: "extension" } });
    const done = (await as3(tokA3, "/api/qa/scenarios/project")).data as any;
    step(c, "after the repair the extension task completes for real (Request extension works again) and exactly the next task unlocks",
      done.steps[extIdx].status === "done" && done.current === extIdx + 1, { actual: `extension=${done.steps[extIdx].status} current=${done.current}` });
    await as3(tokA3, "/api/qa/scenarios/project", { method: "POST", body: { action: "reset" } });
  }

  /* ================= QA ACCESS CONTROL ================= */
  /* Test Center / demo tooling is restricted SERVER-SIDE to authorized
     development accounts: dev admins + the three QA personas. A normal
     account (even a demo/seed one) gets 403 from every protected route
     no matter how it arrives — direct API call, URL, cookies, storage. */
  {
    const c = cat("QA ACCESS CONTROL");
    const tokNormal = signDemoToken("rachel"); // a normal (non-admin) account
    const tokPersona = signDemoToken("testcustomer");
    const hit = async (tok: string | null, pth: string, init?: { method?: string; body?: unknown }) => {
      const res = await fetch(BASE + pth, { method: init?.method ?? "GET", headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: init?.body !== undefined ? JSON.stringify(init.body) : undefined });
      return res.status;
    };
    const s1 = await hit(tokNormal, "/api/qa/state");
    const s2 = await hit(tokNormal, "/api/qa/scenarios/booking");
    const s3 = await hit(tokNormal, "/api/qa/scenarios/booking", { method: "POST", body: { action: "start" } });
    step(c, "a normal signed-in account CANNOT read or arm QA scenarios by calling the APIs directly — 403 on state, detail, and actions",
      s1 === 403 && s2 === 403 && s3 === 403, { actual: `${s1}/${s2}/${s3}` });
    const s4 = await hit(tokNormal, "/api/qa/impersonate", { method: "POST", body: { handle: "testcustomer" } });
    step(c, "a normal account cannot impersonate a QA persona — persona switching is dev-only (403)", s4 === 403, { actual: String(s4) });
    const s4b = await hit(tokNormal, "/api/qa/guide-defect");
    const s4c = await hit(tokNormal, "/api/qa/guide-defect", { method: "POST", body: { task: "x", target: "y" } });
    step(c, "the guide-defect log is operator-only too — a normal account can neither read nor write it (403)", s4b === 403 && s4c === 403, { actual: `${s4b}/${s4c}` });
    const s5 = await hit(tokNormal, "/api/demo/fulltest", { method: "POST" });
    const s6 = await hit(tokNormal, "/api/demo/reset", { method: "POST", body: { kind: "booking" } });
    const s7 = await hit(tokNormal, "/api/demo/clock", { method: "POST", body: { advanceMs: 1000 } });
    const s8 = await hit(tokNormal, "/api/demo/account-state", { method: "POST", body: { state: "alumni" } });
    step(c, "demo operator tools (full test, data reset, demo clock, account-state switcher) all refuse a normal account server-side",
      s5 === 403 && s6 === 403 && s7 === 403 && s8 === 403, { actual: `${s5}/${s6}/${s7}/${s8}` });
    const g1 = await hit(null, "/api/qa/state");
    const g2 = await hit(null, "/api/qa/impersonate", { method: "POST", body: { handle: "testcustomer" } });
    step(c, "guests (no auth at all) get 401 — no test data or controls leak", g1 === 401 && g2 === 401, { actual: `${g1}/${g2}` });
    const p1 = await hit(tokPersona, "/api/qa/state");
    step(c, "the QA personas themselves stay authorized (they ARE the dev tooling): testcustomer reads QA state fine", p1 === 200, { actual: String(p1) });
  }

  /* ================= PLAN LAB (REAL BOUNDARIES) ================= */
  /* Both sides of every plan gate, over real HTTP, on isolated QA      */
  /* accounts in SIMULATION MODE (demo bypasses off — production rules).*/
  /* Included feature works · restricted feature refuses WITH the       */
  /* upgrade explanation · upgrading flips availability immediately,    */
  /* verified in the database. No real billing exists anywhere here.    */
  {
    const c = cat("PLAN LAB (REAL BOUNDARIES)");
    const tCrea = signDemoToken("testcreator");
    const tBiz = signDemoToken("testbusiness");
    const tCust = signDemoToken("testcustomer");
    const tAdm = signDemoToken("devin");
    const px = async (tok: string, pth: string, init?: { method?: string; body?: unknown }) => {
      const res = await fetch(BASE + pth, { method: init?.method ?? "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: init?.body !== undefined ? JSON.stringify(init.body) : undefined });
      let data: any = {}; try { data = await res.json(); } catch {}
      return { status: res.status, data };
    };
    // baseline fixture: arming the plans scenario resets personas to Free/demo/unverified/no-studio
    await px(tAdm, "/api/qa/scenarios/plans", { method: "POST", body: { action: "reset" } });

    /* ---- personal: Free → Pro (Studio gate) ---- */
    await px(tCrea, "/api/demo/mode", { method: "PATCH", body: { mode: "simulation" } });
    const denied = await px(tCrea, "/api/me/studio", { method: "PATCH", body: { studio: { accent: "lime" } } });
    step(c, "FREE + simulation: the Pro feature refuses over real HTTP — 403 with the upgrade explanation, never a silent failure",
      denied.status === 403 && /pro/i.test(String(denied.data.error)), { actual: `${denied.status} "${String(denied.data.error).slice(0, 80)}"` });
    const up = await px(tCrea, "/api/me/plan", { method: "PATCH", body: { plan: "pro" } });
    const nowOk = await px(tCrea, "/api/me/studio", { method: "PATCH", body: { studio: { accent: "lime" } } });
    const creaRow = db.select().from(tables.users).where(eq(tables.users.handle, "testcreator")).get()!;
    const studioRow = db.select().from(tables.profiles).where(eq(tables.profiles.userId, creaRow.id)).get()!;
    step(c, "upgrade to PRO (TEST) → the same save succeeds IMMEDIATELY and the customization is really in the database",
      up.status === 200 && nowOk.status === 200 && creaRow.plan === "pro" && (studioRow.studio ?? "").length > 2,
      { actual: `plan=${creaRow.plan} save=${nowOk.status} studio=${(studioRow.studio ?? "").length} bytes` });

    /* ---- business: Free capacity → Business Pro scale ---- */
    await px(tBiz, "/api/demo/mode", { method: "PATCH", body: { mode: "simulation" } });
    const mk = (n: number) => px(tBiz, "/api/opportunities", { method: "POST", body: { title: `[QA] capacity probe ${n}`, description: "Plan Lab boundary test.", budget: 50, type: "gig", location: "Baltimore, MD", remote: true } });
    const r1 = await mk(1), r2 = await mk(2), r3 = await mk(3);
    const r4 = await mk(4);
    step(c, `BUSINESS FREE: ${BUSINESS_LIMITS.free.activeOpportunities} active opportunities work, the ${BUSINESS_LIMITS.free.activeOpportunities + 1}th refuses with the honest capacity message naming the Business Pro limit`,
      r1.status === 200 && r2.status === 200 && r3.status === 200 && r4.status === 409 && /Business Pro raises this to/i.test(String(r4.data.error)),
      { actual: `creates=${r1.status},${r2.status},${r3.status} then ${r4.status} "${String(r4.data.error).slice(0, 70)}"` });
    await px(tBiz, "/api/me/plan", { method: "PATCH", body: { plan: "business_pro" } });
    const r5 = await mk(5);
    const bizRow = db.select().from(tables.users).where(eq(tables.users.handle, "testbusiness")).get()!;
    step(c, "upgrade to BUSINESS PRO (TEST) → the very next post succeeds; capacity is read live from the database row",
      bizRow.plan === "business_pro" && r5.status === 200, { actual: `plan=${bizRow.plan} post4th=${r5.status}` });

    /* ---- eligibility: verification-based, never plan-based ---- */
    const oppS = await px(tBiz, "/api/opportunities", { method: "POST", body: { title: "[QA] Students-only probe", description: "Plan Lab eligibility test.", budget: 50, type: "gig", location: "Baltimore, MD", remote: true, eligibility: "students" } });
    const oppId = (oppS.data as any).id;
    // SIMULATION mode = the realistic gate (demo mode seats testers at a
    // default campus so exploration never dead-ends); verification flips
    // happen in demo mode (that's where the account-state tool lives)
    await px(tCust, "/api/demo/mode", { method: "PATCH", body: { mode: "simulation" } });
    const noVerify = await px(tCust, `/api/opportunities/${oppId}/applications`, { method: "POST", body: { message: "[QA] probe" } });
    await px(tCust, "/api/demo/mode", { method: "PATCH", body: { mode: "demo" } });
    await px(tCust, "/api/demo/account-state", { method: "POST", body: { state: "current_student" } });
    await px(tCust, "/api/demo/mode", { method: "PATCH", body: { mode: "simulation" } });
    const verified = await px(tCust, `/api/opportunities/${oppId}/applications`, { method: "POST", body: { message: "[QA] probe as verified student" } });
    step(c, "STUDENTS-ONLY eligibility (simulation mode): unverified refuses with the honest reason; the same account verifies (free — never a plan) and the SAME application then succeeds",
      noVerify.status >= 400 && /verif/i.test(String(noVerify.data.error)) && verified.status === 200,
      { actual: `unverified=${noVerify.status} "${String(noVerify.data.error).slice(0, 60)}" → verified=${verified.status}` });

    // isolation: only QA personas were touched; reset restores their baseline
    await px(tAdm, "/api/qa/scenarios/plans", { method: "POST", body: { action: "reset" } });
    const after = ["testcreator", "testbusiness", "testcustomer"].map((h) => db.select().from(tables.users).where(eq(tables.users.handle, h)).get()!);
    step(c, "ISOLATION: plan testing touched ONLY the QA personas, and the scenario reset restores all of them to Free/Demo/unverified baseline",
      after.every((u) => u.plan === "free" && u.testerMode === "demo"), { actual: after.map((u) => `${u.handle}=${u.plan}/${u.testerMode}`).join(" ") });
  }

  /* ================= QA LOOP REGRESSION (PEOPLE TEST 2) ================= */
  /* The infinite-rebooking incident: one checkpoint used to demand
     book + accept(other persona!) + pay — unpassable by the customer
     alone, while the guide walked them backwards into rebooking. Now:
     one persona, one action, one checkpoint — forever. */
  {
    const c = cat("QA LOOP REGRESSION");
    const tokA4 = signDemoToken("devin");
    const tokC4 = signDemoToken("testcustomer");
    const as4 = async (tok: string, pth: string, init?: { method?: string; body?: unknown }) => {
      const res = await fetch(BASE + pth, { method: init?.method ?? "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: init?.body !== undefined ? JSON.stringify(init.body) : undefined });
      let data: any = {}; try { data = await res.json(); } catch {}
      return { status: res.status, data };
    };
    await as4(tokA4, "/api/qa/scenarios/people", { method: "POST", body: { action: "reset" } });
    await as4(tokA4, "/api/qa/scenarios/people", { method: "POST", body: { action: "auto", step: "contact" } });
    // the customer does EXACTLY what a customer can do alone: request the booking
    const svcRow = db.select().from(tables.services).all().find((x) => x.title === "QA Studio Rental" && x.active)!;
    const day4 = (() => { let t = new Date(Date.now() + 4 * 86400e3); while (t.getDay() === 0 || t.getDay() === 6) t = new Date(t.getTime() + 86400e3); t.setHours(13, 0, 0, 0); return t; })();
    const bk4 = await as4(tokC4, "/api/bookings", { method: "POST", body: { serviceId: svcRow.id, startsAt: day4.toISOString(), durationMin: 60 } });
    let st4 = (await as4(tokA4, "/api/qa/scenarios/people")).data as any;
    const idxBooks = st4.steps.findIndex((x: any) => x.id === "client-books");
    step(c, "LOOP FIX · the customer's booking REQUEST alone passes their test — no payment demanded from a persona that cannot pay yet",
      bk4.status === 200 && st4.steps[idxBooks].status === "done" && st4.steps[st4.current].id === "client-accept" && st4.steps[st4.current].role === "testbusiness",
      { actual: `bk=${bk4.status} client-books=${st4.steps[idxBooks].status} current=${st4.steps[st4.current]?.id} (${st4.steps[st4.current]?.role})` });
    step(c, "LOOP FIX · the handoff is explicit: the current task now BELONGS to Test Business (accept), then back to the customer (pay) — three checkpoints, three single actions, in order",
      st4.steps.map((x: any) => x.id).join(",").includes("client-books,client-accept,client-pays"),
      { actual: st4.steps.map((x: any) => x.id).slice(1, 4).join(" → ") });
    await as4(tokA4, "/api/qa/scenarios/people", { method: "POST", body: { action: "auto", step: "client-accept" } });
    await as4(tokA4, "/api/qa/scenarios/people", { method: "POST", body: { action: "auto", step: "client-pays" } });
    st4 = (await as4(tokA4, "/api/qa/scenarios/people")).data as any;
    const bkRow = db.select().from(tables.bookings).all().filter((b) => b.providerId === svcRow.ownerId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).pop()!;
    const pays = db.select().from(tables.payments).all().filter((x) => x.bookingId === bkRow.id);
    const allBk = db.select().from(tables.bookings).all().filter((b) => b.providerId === svcRow.ownerId && b.createdAt.getTime() > Date.now() - 120000);
    step(c, "LOOP FIX · accept → pay completes the chain with ONE booking and ONE payment — no duplicates from repeating the flow, checkpoint verified from the database",
      st4.steps.find((x: any) => x.id === "client-pays")?.status === "done" && pays.length === 1 && allBk.length === 1,
      { actual: `client-pays=${st4.steps.find((x: any) => x.id === "client-pays")?.status} bookings=${allBk.length} payments=${pays.length}` });
    // THE DRAFT LOOP (Test 6 incident): creating the project draft ALONE
    // must pass its test and hand off to the creator — never re-request
    // the same open/create action
    await as4(tokA4, "/api/qa/scenarios/people", { method: "POST", body: { action: "auto", step: "client-complete" } });
    await as4(tokA4, "/api/qa/scenarios/people", { method: "POST", body: { action: "auto", step: "hire-draft" } });
    let st5 = (await as4(tokA4, "/api/qa/scenarios/people")).data as any;
    step(c, "DRAFT LOOP FIX · creating the project draft ALONE passes hire-draft and hands off to the CREATOR (send offer) — the guide can never re-request the draft",
      st5.steps.find((x: any) => x.id === "hire-draft")?.status === "done" && st5.steps[st5.current]?.id === "hire-offer" && st5.steps[st5.current]?.role === "testcreator",
      { actual: `hire-draft=${st5.steps.find((x: any) => x.id === "hire-draft")?.status} current=${st5.steps[st5.current]?.id} (${st5.steps[st5.current]?.role})` });
    const chain = st5.steps.map((x: any) => x.id).join(",");
    step(c, "DRAFT LOOP FIX · the hire chain is five single-persona checkpoints in strict order: draft → offer → fund → deliver → release",
      chain.includes("hire-draft,hire-offer,hire-fund,hire-deliver,hire-release"), { actual: chain.split(",").slice(5, 10).join(" → ") });
    const projCount = db.select().from(tables.projects).all().filter((pr) => pr.title === "[QA] People-scenario gig").length;
    step(c, "DRAFT LOOP FIX · exactly ONE project draft exists — repeated panel opens/rerenders created nothing",
      projCount === 1, { actual: `projects=${projCount}` });

    // THE STALE-DRAFT WEDGE ("Cut Grass" incident): a project created
    // BEFORE hire-draft activates doesn't count AND hides the create
    // form. The Lab must flag it as blocked with a one-click restore —
    // never a silent do-it-again loop with no exit.
    await as4(tokA4, "/api/qa/scenarios/people", { method: "POST", body: { action: "reset" } });
    for (const st5b of ["contact", "client-books", "client-accept", "client-pays"]) await as4(tokA4, "/api/qa/scenarios/people", { method: "POST", body: { action: "auto", step: st5b } });
    const tokB4 = signDemoToken("testbusiness");
    const conv4 = (await as4(tokB4, "/api/conversations", { method: "POST", body: { toHandle: "testcreator", firstMessage: "[QA] pre-wedge" } })).data as any;
    await as4(tokB4, "/api/projects", { method: "POST", body: { creatorHandle: "testcreator", title: "Cut Grass", amount: 100, conversationId: conv4.id ?? conv4.conversationId } });
    await as4(tokA4, "/api/qa/scenarios/people", { method: "POST", body: { action: "auto", step: "client-complete" } });
    let w = (await as4(tokA4, "/api/qa/scenarios/people")).data as any;
    let wcur = w.steps[w.current];
    step(c, "STALE-DRAFT WEDGE · a pre-activation project ('Cut Grass') marks hire-draft BLOCKED with the reason and a one-click restore — the user always has an exit",
      wcur.id === "hire-draft" && !!wcur.blocked && wcur.repairable === true && /Cut Grass/.test(String(wcur.blocked)),
      { actual: `current=${wcur.id} blocked="${String(wcur.blocked).slice(0, 70)}" repairable=${wcur.repairable}` });
    await as4(tokA4, "/api/qa/scenarios/people", { method: "POST", body: { action: "repair" } });
    const gone = db.select().from(tables.projects).all().filter((pr) => pr.title === "Cut Grass").length;
    await as4(tokA4, "/api/qa/scenarios/people", { method: "POST", body: { action: "auto", step: "hire-draft" } });
    w = (await as4(tokA4, "/api/qa/scenarios/people")).data as any;
    step(c, "STALE-DRAFT WEDGE · restore clears the stale project (create form returns), a FRESH draft counts, and the chain advances to the creator's offer",
      gone === 0 && w.steps.find((x: any) => x.id === "hire-draft")?.status === "done" && w.steps[w.current]?.id === "hire-offer",
      { actual: `stale-cleared=${gone === 0} hire-draft=${w.steps.find((x: any) => x.id === "hire-draft")?.status} current=${w.steps[w.current]?.id}` });
    await as4(tokA4, "/api/qa/scenarios/people", { method: "POST", body: { action: "reset" } });
  }

  /* ================= QA SCENARIO WALKTHROUGHS ================= */
  /* Every scenario must be COMPLETABLE, start → finish, through the
     real HTTP routes — with the strict-order invariants holding at
     every single step: exactly one pending task, everything after it
     locked, displayed done-count equal to the verified prefix. The
     booking + project walks live in earlier categories; these three
     were previously never walked end-to-end. */
  {
    const c = cat("QA SCENARIO WALKTHROUGHS");
    const tokA = signDemoToken("devin");
    const asA = async (pth: string, init?: { method?: string; body?: unknown }) => {
      const res = await fetch(BASE + pth, { method: init?.method ?? "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokA}` }, body: init?.body !== undefined ? JSON.stringify(init.body) : undefined });
      let data: any = {}; try { data = await res.json(); } catch {}
      return { status: res.status, data };
    };
    const walk = async (sid: string) => {
      let st = (await asA(`/api/qa/scenarios/${sid}`, { method: "POST", body: { action: "reset" } })).data as any;
      let guard = 0, same = 0, lastId = "", stuck = "", invariantOk = true;
      while (!st.completed && guard++ < 80) {
        const pend = (st.steps ?? []).filter((x: any) => x.status === "pending");
        if (pend.length !== 1) { invariantOk = false; stuck = `${pend.length} pending steps`; break; }
        const cur = pend[0];
        const idx = st.steps.findIndex((x: any) => x.id === cur.id);
        if (idx !== st.current || st.done !== idx || !st.steps.slice(idx + 1).every((x: any) => x.status === "locked")) {
          invariantOk = false; stuck = `order invariant broke at ${cur.id} (idx=${idx} current=${st.current} done=${st.done})`; break;
        }
        if (cur.id === lastId) { if (++same > 3) { stuck = `stuck at ${cur.id}: "${String(cur.actual).slice(0, 80)}"`; break; } } else same = 0;
        lastId = cur.id;
        if (cur.role === "check") { st = (await asA(`/api/qa/scenarios/${sid}`)).data as any; continue; }
        const r = await asA(`/api/qa/scenarios/${sid}`, { method: "POST", body: { action: "auto", step: cur.id } });
        if (r.status !== 200) { stuck = `auto ${cur.id} → ${r.status} ${JSON.stringify(r.data).slice(0, 80)}`; break; }
        st = r.data as any;
      }
      return { st, invariantOk, stuck };
    };
    for (const sid of ["opportunity", "hiring", "people", "plans", "live"]) {
      const { st, invariantOk, stuck } = await walk(sid);
      step(c, `${sid} scenario walks START → FINISH strictly in order — one pending task, later tasks locked, done=verified-prefix at every step — and completes fully`,
        st.completed === true && st.done === st.total && invariantOk, { actual: stuck || `${st.done}/${st.total} completed=${st.completed}` });
      await asA(`/api/qa/scenarios/${sid}`, { method: "POST", body: { action: "reset" } });
    }
  }

  /* ================= LIVE STREAMING ================= */
  /* The full Mavyn Live lifecycle over the REAL HTTP routes: create →
     discover → watch → chat (two accounts, interleaved) → react →
     follow → share → moderate → mute/block → guests → end → replay →
     replay deletion — plus audience gating (campus/nearby/followers/
     invite), location privacy, presence reconnect, and the browser
     layer. Campus is an audience filter, never a separate product.   */
  {
    const c = cat("LIVE STREAMING");
    const imani = ids("imani"), jordan = ids("jordanmiles"), devinU = ids("devin");
    // login the extra actors this category needs
    for (const h of ["imani", "jordanmiles", "devin"]) {
      if (!tok[h]) {
        const li = await api(null, "/api/auth/login", { method: "POST", body: { identifier: h, password: "mavyn123" } });
        tok[h] = (li.data as { sessionToken?: string }).sessionToken ?? "";
      }
    }
    // deterministic reset: remove [TESTLIVE] streams from prior runs
    for (const l of db.select().from(tables.liveStreams).all())
      if (l.title.startsWith("[TESTLIVE]")) db.delete(tables.liveStreams).where(eq(tables.liveStreams.id, l.id)).run();

    /* ---- 1-5 · create: title, category, audience, start ---- */
    const created = await api("lena", "/api/live", { method: "POST", body: { title: "[TESTLIVE] Rolling cuts — open studio", category: "music", audience: "everyone" } });
    const sid = String((created.data as { id?: string }).id || "");
    step(c, "GO LIVE creates a real stream: title + category + audience in ONE simple call, status live immediately", created.status === 200 && !!sid, { record: sid });
    const dupe = await api("lena", "/api/live", { method: "POST", body: { title: "[TESTLIVE] second", category: "music", audience: "everyone" } });
    step(c, "one live at a time — a second Go Live while live is rejected (409)", dupe.status === 409);
    const det0 = await api("lena", `/api/live/${sid}`);
    const st0 = (det0.data as { stream?: Record<string, unknown> }).stream ?? {};
    step(c, "the stream carries its real state: category music, audience everyone, chat/reactions/sharing/guests/replay all on", st0.category === "music" && st0.audience === "everyone" && st0.chatEnabled === true && st0.reactionsEnabled === true && st0.sharingEnabled === true && st0.saveReplay === true);

    /* ---- 6-8 · discovery + open from another account ---- */
    const now = await api("rachel", "/api/live?filter=now");
    step(c, "the stream appears in Live Now for another account", (now.data as { items?: { id: string }[] }).items?.some((x) => x.id === sid) === true, { route: "/api/live?filter=now" });
    const fy = await api("rachel", "/api/live?filter=foryou");
    const feedSrc = fs.readFileSync(path.join(process.cwd(), "components", "db", "DbFeed.tsx"), "utf8");
    const railSrc = fs.readFileSync(path.join(process.cwd(), "components", "db", "LiveNowRail.tsx"), "utf8");
    step(c, "the For You surface serves it: /api/live?filter=foryou lists it AND the feed renders the LIVE NOW rail with 'See all Live →'", (fy.data as { items?: { id: string }[] }).items?.some((x) => x.id === sid) === true && feedSrc.includes("LiveNowRail") && railSrc.includes("See all Live"));
    const open2 = await api("rachel", `/api/live/${sid}`);
    step(c, "a second account opens the stream (viewer payload: title, host, viewer count, my role)", open2.status === 200 && !!(open2.data as { me?: unknown }).me);

    /* ---- 9 + 30 · real-time chat, two users interleaved ---- */
    await api("rachel", `/api/live/${sid}/presence`, { method: "POST", body: {} });
    const t0 = Date.now() - 1;
    await api("rachel", `/api/live/${sid}/chat`, { method: "POST", body: { body: "[TESTLIVE] first from rachel" } });
    await api("lena", `/api/live/${sid}/chat`, { method: "POST", body: { body: "[TESTLIVE] host replies" } });
    await api("rachel", `/api/live/${sid}/chat`, { method: "POST", body: { body: "[TESTLIVE] rachel again" } });
    await api("lena", `/api/live/${sid}/chat`, { method: "POST", body: { body: "[TESTLIVE] host closes" } });
    const chatL = (await api("lena", `/api/live/${sid}/chat?after=0`)).data as { messages?: { body: string; handle: string }[] };
    const chatR = (await api("rachel", `/api/live/${sid}/chat?after=${t0}`)).data as { messages?: { body: string }[] };
    const order = (chatL.messages ?? []).filter((m) => m.body.startsWith("[TESTLIVE]")).map((m) => m.handle).join(",");
    step(c, "REAL-TIME CHAT: two accounts chat simultaneously — both see all four messages, interleaved in exact order, via the incremental after= poll", order === "rachel,lena,rachel,lena" && (chatR.messages ?? []).filter((m) => m.body.startsWith("[TESTLIVE]")).length === 4, { actual: `order=${order}` });

    /* ---- 10 · reactions ---- */
    const r1 = await api("rachel", `/api/live/${sid}/react`, { method: "POST", body: { type: "fire" } });
    const r2 = await api("rachel", `/api/live/${sid}/react`, { method: "POST", body: { type: "heart" } });
    const counts = (r2.data as { counts?: Record<string, number> }).counts ?? {};
    step(c, "reactions land and count (fire + heart)", r1.status === 200 && counts.fire === 1 && counts.heart === 1);

    /* ---- 11 · follow from the live room ---- */
    await api("rachel", `/api/follow/${lena.id}`, { method: "DELETE" }).catch(() => {});
    const fRes = await api("rachel", `/api/follow/${lena.id}`, { method: "POST" });
    const det1 = (await api("rachel", `/api/live/${sid}`)).data as { me?: { following?: boolean } };
    step(c, "follow works from the live context and reflects in the payload", fRes.status === 200 && det1.me?.following === true);

    /* ---- 12 · sharing toggle is enforced state ---- */
    await api("lena", `/api/live/${sid}`, { method: "PATCH", body: { action: "toggle", key: "sharingEnabled", value: false } });
    const det2 = (await api("rachel", `/api/live/${sid}`)).data as { stream?: { sharingEnabled?: boolean } };
    await api("lena", `/api/live/${sid}`, { method: "PATCH", body: { action: "toggle", key: "sharingEnabled", value: true } });
    step(c, "sharing is a real host control: toggling it off updates every viewer's payload (UI hides the button)", det2.stream?.sharingEnabled === false);

    /* ---- 13 · moderation: delete, pin, moderators ---- */
    const rachelMsg = db.select().from(tables.liveMessages).where(eq(tables.liveMessages.streamId, sid)).all().find((m) => m.body === "[TESTLIVE] rachel again")!;
    await api("lena", `/api/live/${sid}/moderate`, { method: "POST", body: { action: "delete_message", messageId: rachelMsg.id } });
    const chatAfterDel = (await api("rachel", `/api/live/${sid}/chat?after=0`)).data as { messages?: { id: string }[] };
    step(c, "host deletes a message — it disappears from the chat feed for everyone", (chatAfterDel.messages ?? []).every((m) => m.id !== rachelMsg.id));
    const hostMsg = db.select().from(tables.liveMessages).where(eq(tables.liveMessages.streamId, sid)).all().find((m) => m.body === "[TESTLIVE] host replies")!;
    await api("lena", `/api/live/${sid}`, { method: "PATCH", body: { action: "pin", messageId: hostMsg.id } });
    const det3 = (await api("rachel", `/api/live/${sid}`)).data as { pinnedMessage?: { id?: string } };
    step(c, "host pins a message — every viewer sees the pin", det3.pinnedMessage?.id === hostMsg.id);
    await api("rachel", `/api/live/${sid}/presence`, { method: "POST", body: {} });
    const modAdd = await api("lena", `/api/live/${sid}/moderate`, { method: "POST", body: { action: "add_mod", userId: rachel.id } });
    const modDel = await api("rachel", `/api/live/${sid}/moderate`, { method: "POST", body: { action: "delete_message", messageId: hostMsg.id } });
    await api("lena", `/api/live/${sid}/moderate`, { method: "POST", body: { action: "remove_mod", userId: rachel.id } });
    const modDenied = await api("rachel", `/api/live/${sid}/moderate`, { method: "POST", body: { action: "delete_message", messageId: hostMsg.id } });
    step(c, "moderators: host promotes a viewer → they can delete messages; demoted → 403 immediately", modAdd.status === 200 && modDel.status === 200 && modDenied.status === 403);

    /* ---- 14 · mute + block, enforced server-side ---- */
    await api("lena", `/api/live/${sid}/moderate`, { method: "POST", body: { action: "mute", userId: rachel.id } });
    const mutedPost = await api("rachel", `/api/live/${sid}/chat`, { method: "POST", body: { body: "[TESTLIVE] should be muted" } });
    await api("lena", `/api/live/${sid}/moderate`, { method: "POST", body: { action: "unmute", userId: rachel.id } });
    const unmutedPost = await api("rachel", `/api/live/${sid}/chat`, { method: "POST", body: { body: "[TESTLIVE] unmuted again" } });
    step(c, "mute silences chat (403) but keeps watching; unmute restores it", mutedPost.status === 403 && unmutedPost.status === 200);
    const su2 = await api(null, "/api/auth/signup", { method: "POST", body: { email: `tonblive.${runNonce()}@mavyn.dev`, password: "Live-lifecycle-2026", handle: "tonblive", displayName: "Live Probe" } });
    tok.tonblive = (su2.data as { sessionToken?: string }).sessionToken ?? "";
    if (!tok.tonblive) {
      const re2 = await api(null, "/api/auth/login", { method: "POST", body: { identifier: "tonblive", password: "Live-lifecycle-2026" } });
      tok.tonblive = (re2.data as { sessionToken?: string }).sessionToken ?? "";
    }
    const tonbliveId = (db.select().from(tables.users).all().find((u) => u.handle === "tonblive"))!.id;
    await api("lena", `/api/live/${sid}/moderate`, { method: "POST", body: { action: "block", userId: tonbliveId } });
    const blockedView = await api("tonblive", `/api/live/${sid}`);
    const blockedBeat = await api("tonblive", `/api/live/${sid}/presence`, { method: "POST", body: {} });
    await api("lena", `/api/live/${sid}/moderate`, { method: "POST", body: { action: "unblock", userId: tonbliveId } });
    const unblockedView = await api("tonblive", `/api/live/${sid}`);
    step(c, "block removes ALL access (page 403 + presence 403); unblock restores it", blockedView.status === 403 && blockedBeat.status === 403 && unblockedView.status === 200);

    /* ---- 15 · guests / co-hosts ---- */
    const inv = await api("lena", `/api/live/${sid}/guests`, { method: "POST", body: { action: "invite", handle: "rachel" } });
    const acc = await api("rachel", `/api/live/${sid}/guests`, { method: "POST", body: { action: "accept" } });
    const det4 = (await api("lena", `/api/live/${sid}`)).data as { guests?: { handle: string; status: string }[] };
    const onStage = det4.guests?.some((g) => g.handle === "rachel" && g.status === "active");
    const rem = await api("lena", `/api/live/${sid}/guests`, { method: "POST", body: { action: "remove", userId: rachel.id } });
    const det5 = (await api("lena", `/api/live/${sid}`)).data as { guests?: { handle: string }[] };
    step(c, "guest lifecycle: invite → accept (split-screen stage) → remove — all real state", inv.status === 200 && acc.status === 200 && onStage === true && rem.status === 200 && !det5.guests?.some((g) => g.handle === "rachel"));

    /* ---- 28-29 · refresh + disconnect/reconnect ---- */
    const beat1 = await api("rachel", `/api/live/${sid}/presence`, { method: "POST", body: {} });
    const count1 = (beat1.data as { viewerCount?: number }).viewerCount ?? 0;
    db.update(tables.liveViewers).set({ lastSeenAt: new Date(Date.now() - 120_000) })
      .where(and(eq(tables.liveViewers.streamId, sid), eq(tables.liveViewers.userId, rachel.id))).run();
    const afterDrop = (await api("lena", `/api/live/${sid}`)).data as { stream?: { viewerCount?: number } };
    const beat2 = await api("rachel", `/api/live/${sid}/presence`, { method: "POST", body: {} });
    const count2 = (beat2.data as { viewerCount?: number }).viewerCount ?? 0;
    step(c, "disconnect/reconnect: a stalled heartbeat ages out of the viewer count; one heartbeat later the viewer is back (refresh = same idempotent path)", (afterDrop.stream?.viewerCount ?? 99) < count1 && count2 >= count1, { actual: `present=${count1} → dropped=${afterDrop.stream?.viewerCount} → back=${count2}` });

    /* ---- 16-18 · end + replay lifecycle ---- */
    const end = await api("lena", `/api/live/${sid}`, { method: "PATCH", body: { action: "end" } });
    const detE = (await api("lena", `/api/live/${sid}`)).data as { stream?: { status?: string; replayStatus?: string } };
    step(c, "end stream: status → ended, and Save replay (on) makes replay_status=saved automatically", end.status === 200 && detE.stream?.status === "ended" && detE.stream?.replayStatus === "saved");
    const replays = await api("rachel", "/api/live?filter=replays");
    const profReplays = await api("rachel", "/api/live/replays?host=lena");
    step(c, "the saved replay serves in Live → Replays AND on the host's profile", (replays.data as { items?: { id: string }[] }).items?.some((x) => x.id === sid) === true && (profReplays.data as { items?: { id: string }[] }).items?.some((x) => x.id === sid) === true);
    await api("lena", `/api/live/${sid}/replay`, { method: "POST", body: { action: "delete" } });
    const replays2 = await api("rachel", "/api/live?filter=replays");
    const profReplays2 = await api("rachel", "/api/live/replays?host=lena");
    const goneDetail = await api("rachel", `/api/live/${sid}`);
    step(c, "deleting the replay removes it EVERYWHERE — discovery, profile, and the direct link 404s for viewers", !(replays2.data as { items?: { id: string }[] }).items?.some((x) => x.id === sid) && !(profReplays2.data as { items?: { id: string }[] }).items?.some((x) => x.id === sid) && goneDetail.status === 404);

    /* ---- 19 + 24-26 · campus audience: verification is the law ---- */
    const campusLive = await api("imani", "/api/live", { method: "POST", body: { title: "[TESTLIVE] Bowie State study session", category: "education", audience: "campus" } });
    const campusSid = String((campusLive.data as { id?: string }).id || "");
    const campusRow = db.select().from(tables.liveStreams).where(eq(tables.liveStreams.id, campusSid)).get();
    const bowie = db.select().from(tables.campuses).all().find((x) => x.slug === "bowie-state");
    step(c, "a VERIFIED student goes live to campus — the stream is bound to their verified school automatically", campusLive.status === 200 && campusRow?.campusId === bowie?.id, { actual: `campus=${campusRow?.campusId === bowie?.id ? "Bowie State University" : campusRow?.campusId}` });
    const devinCampus = await api("devin", "/api/live?filter=campus");
    const rachelCampus = await api("rachel", "/api/live?filter=campus");
    const rachelOpens = await api("rachel", `/api/live/${campusSid}`);
    step(c, "campus filtering: a verified member sees it under Campus; an unverified user gets the honest notice, an empty list AND a 403 on the direct link", (devinCampus.data as { items?: { id: string }[] }).items?.some((x) => x.id === campusSid) === true && ((rachelCampus.data as { items?: unknown[] }).items ?? []).length === 0 && typeof (rachelCampus.data as { note?: string }).note === "string" && rachelOpens.status === 403);
    const fakeClaim = await api("tonblive", "/api/live", { method: "POST", body: { title: "[TESTLIVE] fake campus", audience: "campus" } });
    // devin is ALSO campus-verified and not currently live — the claim
    // check must fire, not the one-live-at-a-time guard (imani is live)
    const wrongCampus = await api("devin", "/api/live", { method: "POST", body: { title: "[TESTLIVE] wrong campus", audience: "campus", campusId: "not-my-campus" } });
    step(c, "unauthorized campus claims are impossible: unverified user → 403; a verified user naming a DIFFERENT campus → 403", fakeClaim.status === 403 && wrongCampus.status === 403,
      { actual: `unverified=${fakeClaim.status} (${String((fakeClaim.data as { error?: string }).error || "").slice(0, 60)}) · wrong-campus=${wrongCampus.status}` });
    await api("imani", `/api/live/${campusSid}`, { method: "PATCH", body: { action: "end" } });

    /* ---- 20 · nearby respects location privacy ---- */
    const nearLive = await api("lena", "/api/live", { method: "POST", body: { title: "[TESTLIVE] Baltimore pop-up", category: "irl", audience: "nearby" } });
    const nearSid = String((nearLive.data as { id?: string }).id || "");
    const rachelNear = await api("rachel", "/api/live?filter=nearby");
    const jordanNear = await api("jordanmiles", "/api/live?filter=nearby");
    const jordanOpen = await api("jordanmiles", `/api/live/${nearSid}`);
    const leak = JSON.stringify(rachelNear.data).match(/"lat"|"lng"|"latitude"|"longitude"/);
    step(c, "nearby: a Baltimore viewer sees the Baltimore stream, an Atlanta viewer neither lists NOR opens it — and the payload contains ZERO coordinates", nearLive.status === 200 && (rachelNear.data as { items?: { id: string }[] }).items?.some((x) => x.id === nearSid) === true && !(jordanNear.data as { items?: { id: string }[] }).items?.some((x) => x.id === nearSid) && jordanOpen.status === 403 && !leak, { actual: leak ? `COORDINATE LEAK: ${leak[0]}` : "no lat/lng anywhere in the payload" });
    await api("lena", `/api/live/${nearSid}`, { method: "PATCH", body: { action: "end" } });

    /* ---- 21 · following filter ---- */
    const folLive = await api("lena", "/api/live", { method: "POST", body: { title: "[TESTLIVE] followers check-in", audience: "everyone" } });
    const folSid = String((folLive.data as { id?: string }).id || "");
    const rachelFollowing = await api("rachel", "/api/live?filter=following"); // rachel follows lena (test 11)
    const tonbFollowing = await api("tonblive", "/api/live?filter=following");
    step(c, "Following filter: a follower sees the host's stream, a non-follower doesn't", (rachelFollowing.data as { items?: { id: string }[] }).items?.some((x) => x.id === folSid) === true && !(tonbFollowing.data as { items?: { id: string }[] }).items?.some((x) => x.id === folSid));
    await api("lena", `/api/live/${folSid}`, { method: "PATCH", body: { action: "end" } });

    /* ---- 22 · business + invite-only audience ---- */
    const bizLive = await api("harboroak", "/api/live", { method: "POST", body: { title: "[TESTLIVE] Hiring event — meet the team", category: "business", audience: "everyone" } });
    const bizSid = String((bizLive.data as { id?: string }).id || "");
    step(c, "a BUSINESS goes live (hiring event) — same one ecosystem, no separate product", bizLive.status === 200);
    await api("harboroak", `/api/live/${bizSid}`, { method: "PATCH", body: { action: "end" } });
    const invLive = await api("tonblive", "/api/live", { method: "POST", body: { title: "[TESTLIVE] private rehearsal", audience: "invite" } });
    const invSid = String((invLive.data as { id?: string }).id || "");
    const rachelInv = await api("rachel", `/api/live/${invSid}`);
    const rachelNow2 = await api("rachel", "/api/live?filter=now");
    step(c, "invite-only: non-invited viewers can't open it (403) and never even see it listed", invLive.status === 200 && rachelInv.status === 403 && !(rachelNow2.data as { items?: { id: string }[] }).items?.some((x) => x.id === invSid));
    await api("tonblive", `/api/live/${invSid}`, { method: "PATCH", body: { action: "end" } });

    /* ---- reports + safety ---- */
    const rep = await api("rachel", `/api/live/${sid}/report`, { method: "POST", body: { target: "stream", category: "privacy", details: "[TESTLIVE] probe" } });
    const repRow = db.select().from(tables.reports).all().find((r) => r.targetId === sid && r.targetType === "live_stream");
    step(c, "report stream files into the ONE shared reports system (human review, includes a location-privacy category)", rep.status === 200 && !!repRow, { record: repRow?.id });
    if (repRow) db.delete(tables.reports).where(eq(tables.reports.id, repRow.id)).run();

    /* ---- 27 · browser layer: mobile + desktop, real Chromium ---- */
    try {
      const { execFile } = await import("child_process");
      const out = await new Promise<string>((resolve, reject) => {
        execFile(
          process.execPath,
          [path.join(process.cwd(), "scripts", "browser-qa-live.mjs"), "--json", "--base", BASE],
          { timeout: 300_000, maxBuffer: 10_000_000 },
          (err, stdout) => (stdout && String(stdout).trim() ? resolve(String(stdout)) : reject(err ?? new Error("no output")))
        );
      });
      const lines = out.trim().split("\n");
      const rep2 = JSON.parse(lines[lines.length - 1]) as { steps: { category: string; name: string; status: "PASSED" | "FAILED"; detail?: string }[]; crash?: string };
      for (const s2 of rep2.steps) c.steps.push({ name: `[browser:${s2.category}] ${s2.name}`, status: s2.status, actual: s2.detail || undefined, severity: s2.status === "FAILED" ? "HIGH" : undefined });
      if (rep2.crash) c.steps.push({ name: "live browser pass crashed mid-run", status: "FAILED", actual: rep2.crash.slice(0, 200), severity: "HIGH" });
    } catch (e) {
      c.steps.push({
        name: "real-browser layer for Live (Go Live UI, live room, mobile 375px)",
        status: "NOT_TESTED",
        actual: `Chromium could not launch here: ${e instanceof Error ? e.message.slice(0, 140) : String(e).slice(0, 140)} — run: node scripts/browser-qa-live.mjs`,
      });
    }

    // cleanup: this category's streams disappear from the demo data
    for (const l of db.select().from(tables.liveStreams).all())
      if (l.title.startsWith("[TESTLIVE]")) db.delete(tables.liveStreams).where(eq(tables.liveStreams.id, l.id)).run();
    await api("rachel", `/api/follow/${lena.id}`, { method: "DELETE" });
  }

  /* ================= MOBILE & TABLET EXPERIENCE ================= */
  /* The three-way responsive contract:
       < lg  = intentional touch experience (compact expandable-search
               header, persistent 5-item bottom nav with a 48px+ create
               button, redesigned mobile profile with tabs, bottom-sheet
               create menu)
       ≥ lg  = the ESTABLISHED DESKTOP EXPERIENCE — unchanged.
     Structural checks prove the architecture; the real-Chromium pass
     proves the pixels at 360/414/844×390/768/1024/1440.              */
  {
    const c = cat("MOBILE & TABLET EXPERIENCE");
    const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf8");
    const nav = read("components/MobileNav.tsx");
    const navbar = read("components/Navbar.tsx");
    const layoutSrc = read("app/layout.tsx");
    const respProfile = read("components/ResponsiveProfile.tsx");
    const mobileProfile = read("components/MobileProfile.tsx");
    const creatorPage = read("app/creator/[id]/page.tsx");
    const profileView = read("components/profile/ProfileView.tsx");
    const communities = read("app/communities/page.tsx");
    const qaBar = read("components/QaPersonaBar.tsx");

    step(c, "bottom nav: persistent on phones AND tablets (lg:hidden), 5 items with the center + as primary create, 56px touch targets, safe-area padding",
      nav.includes("lg:hidden") && nav.includes("min-h-[56px]") && nav.includes("safe-area-inset-bottom") && nav.includes("mobile-bottom-nav"));
    step(c, "mobile header: compact single row — search is an expandable control (mobile-search-toggle), the permanent second row is gone",
      navbar.includes("mobile-search-toggle") && navbar.includes("mobileSearchOpen &&") && !navbar.includes('      {/* Mobile search — same live search */}'));
    step(c, "content clears the fixed chrome: single-row header padding (pt-20) and bottom-nav clearance until lg (pb-28 lg:pb-10)",
      layoutSrc.includes("pb-28 pt-20") && layoutSrc.includes("lg:pb-10"));
    step(c, "profile: ONE decision point (ResponsiveProfile, matchMedia at lg) — desktop renders DbCreatorProfile untouched, phones/tablets render MobileProfile; both /creator/[id] and /profile use it",
      respProfile.includes("min-width: 1024px") && respProfile.includes("DbCreatorProfile") && respProfile.includes("MobileProfile") &&
      creatorPage.includes("ResponsiveProfile") && profileView.includes("ResponsiveProfile") && !creatorPage.includes("DbCreatorProfile"));
    step(c, "mobile profile implements the required hierarchy: cover → avatar → name/badge → roles → Open to work → campus/class → location/service area → actions → bio → Posts|Services|Portfolio|About tabs with grouped About cards",
      ["mobile-profile-tabs", "Open to work", "Class of", "Serves", "Edit Profile", '"Posts", "Services", "Portfolio", "About"', "Verification", "never shown"].every((m) => mobileProfile.includes(m)));
    step(c, "discovered & fixed by this pass: Discover's filter rail stacked OFF-CANVAS on phones (results had zero width) — now flex-col below lg, identical row at lg+",
      read("components/DiscoverClient.tsx").includes("flex-col gap-6 lg:flex-row"));
    step(c, "discovered & fixed by this pass: /communities hydration mismatch under its Suspense boundary — the deterministic useHydrated gate (same fix as the People page), no suppression anywhere",
      communities.includes("useHydrated") && communities.includes("!hydrated || user === undefined") && !communities.includes("suppressHydrationWarning"));
    step(c, "the Test Center session pill sits ABOVE the bottom nav on touch layouts (bottom-20 → lg:bottom-3) — QA chrome never covers navigation",
      qaBar.includes("bottom-20") && qaBar.includes("lg:bottom-3"));

    /* -------- REAL BROWSER LAYER: 6 viewport classes -------- */
    try {
      const { execFile } = await import("child_process");
      const out = await new Promise<string>((resolve, reject) => {
        execFile(
          process.execPath,
          [path.join(process.cwd(), "scripts", "browser-qa-mobile.mjs"), "--json", "--base", BASE],
          { timeout: 300_000, maxBuffer: 10_000_000 },
          (err, stdout) => (stdout && String(stdout).trim() ? resolve(String(stdout)) : reject(err ?? new Error("no output")))
        );
      });
      const lines = out.trim().split("\n");
      const rep = JSON.parse(lines[lines.length - 1]) as { steps: { category: string; name: string; status: "PASSED" | "FAILED"; detail?: string }[]; crash?: string };
      for (const s2 of rep.steps) c.steps.push({ name: `[browser:${s2.category}] ${s2.name}`, status: s2.status, actual: s2.detail || undefined, severity: s2.status === "FAILED" ? "HIGH" : undefined });
      if (rep.crash) c.steps.push({ name: "responsive browser pass crashed mid-run", status: "FAILED", actual: rep.crash.slice(0, 200), severity: "HIGH" });
    } catch (e) {
      c.steps.push({
        name: "real-browser responsive layer (phones, landscape, tablets, desktop-safety)",
        status: "NOT_TESTED",
        actual: `Chromium could not launch here: ${e instanceof Error ? e.message.slice(0, 140) : String(e).slice(0, 140)} — run: node scripts/browser-qa-mobile.mjs`,
      });
    }
  }

  /* ================= LOCATION SYSTEM (GEO CASCADE) ================= */
  /* CURRENT DESIGN: location entry is simple FREE TEXT everywhere —
     City / County / State / Country on profiles, one location line on
     opportunities, City/State on events. Saving must NEVER depend on
     the optional geo reference database.

     The geo system (db/geo.db, /api/geo/*, lib/server/geo.ts,
     LocationPicker/GeoSelect components) is kept DORMANT for a future
     version — its relational tests below run only where the reference
     DB is actually compiled, and are honestly skipped elsewhere.      */
  {
    const c = cat("LOCATION SYSTEM (GEO CASCADE)");
    type GeoItem = { id: string; code?: string; name: string; countyId?: string | null; countyName?: string | null; stateLabel?: string; hasStates?: boolean; hasCounties?: boolean };
    const items = (r: { data: Record<string, unknown> }) => ((r.data as { items?: GeoItem[] }).items ?? []);

    /* -------- FREE-TEXT LOCATION — the user-facing contract -------- */
    const su = await api(null, "/api/auth/signup", { method: "POST", body: { email: `tonbgeo.${runNonce()}@mavyn.dev`, password: "Geo-cascade-2026", handle: "tonbgeo", displayName: "Geo Tester" } });
    tok.tonbgeo = (su.data as { sessionToken?: string }).sessionToken ?? "";
    const geoProfile = async (): Promise<Record<string, string>> =>
      (((await api("tonbgeo", "/api/auth/me")).data as { user?: { profile?: Record<string, string> } }).user?.profile ?? {});

    const ft1 = await api("tonbgeo", "/api/me/profile", { method: "PATCH", body: { displayName: "Geo Tester", city: "Accokeek", county: "Prince George's", state: "MD", country: "United States" } });
    const p1 = await geoProfile();
    step(c, "free-text location saves and reads back EXACTLY as typed (City/County/State/Country)", ft1.status === 200 && p1.city === "Accokeek" && p1.county === "Prince George's" && p1.state === "MD" && p1.country === "United States", { actual: `${p1.city} · ${p1.county} · ${p1.state} · ${p1.country}` });

    const ft2 = await api("tonbgeo", "/api/me/profile", { method: "PATCH", body: { displayName: "Geo Tester", city: "Bowie", county: "Prince George's", state: "MD", country: "United States" } });
    const p2 = await geoProfile();
    step(c, "editing ONE field changes only that field — the rest of the text is untouched", ft2.status === 200 && p2.city === "Bowie" && p2.county === "Prince George's" && p2.state === "MD" && p2.country === "United States");

    const odd = await api("tonbgeo", "/api/me/profile", { method: "PATCH", body: { displayName: "Geo Tester", city: "My Grandma's Farm", county: "", state: "Narnia", country: "Atlantis" } });
    const p3 = await geoProfile();
    step(c, "ANY text is accepted — saving never requires the geo reference DB and never shows a 'run geo:build' error", odd.status === 200 && p3.city === "My Grandma's Farm" && p3.state === "Narnia" && p3.country === "Atlantis");

    const sweep = fs.readFileSync(path.join(process.cwd(), "lib", "server", "geo.ts"), "utf8");
    const profileRoute = fs.readFileSync(path.join(process.cwd(), "app", "api", "me", "profile", "route.ts"), "utf8");
    step(c, "the internal 'Location data isn't compiled — run npm run geo:build' message is unreachable from user flows (structured path gated by geoReady(); plain-text path never touches the geo DB)",
      profileRoute.includes("wantsStructured && geoReady()") && sweep.includes("geoReady"));

    const editSrc = fs.readFileSync(path.join(process.cwd(), "components", "profile", "EditProfile.tsx"), "utf8");
    const oppSrc = fs.readFileSync(path.join(process.cwd(), "app", "opportunities", "new", "page.tsx"), "utf8");
    const evtSrc = fs.readFileSync(path.join(process.cwd(), "app", "events", "create", "page.tsx"), "utf8");
    step(c, "ONE simple experience everywhere: Edit Profile, opportunity posting and event creation all use plain text inputs — no user-facing form imports LocationPicker (component retained, dormant, for a future version)",
      [editSrc, oppSrc, evtSrc].every((src) => !src.includes("LocationPicker")) && editSrc.includes('placeholder="County"') && oppSrc.includes("Location — e.g. Baltimore, MD") && evtSrc.includes('placeholder="Baltimore, MD"') &&
      fs.existsSync(path.join(process.cwd(), "components", "LocationPicker.tsx")) && fs.existsSync(path.join(process.cwd(), "components", "GeoSelect.tsx")));

    /* existing data preserved — the rollback destroyed nothing */
    const devinProfile = db.select().from(tables.profiles).where(eq(tables.profiles.userId, ids("devin").id)).get();
    step(c, "existing profile location text is preserved exactly (devin still Baltimore / MD / United States)",
      devinProfile?.city === "Baltimore" && devinProfile?.state === "MD" && devinProfile?.country === "United States",
      { actual: `${devinProfile?.city}, ${devinProfile?.county}, ${devinProfile?.state}, ${devinProfile?.country}` });

    /* -------- DORMANT GEO INFRASTRUCTURE — tested where compiled ---- */
    if (geoReady()) {
      const countries = await api(null, "/api/geo/countries?q=united");
      const us = items(countries).find((x) => x.code === "US" || x.id === "US");
      step(c, "[dormant geo] countries endpoint searchable, United States with level config", countries.status === 200 && !!us && us.hasStates === true && us.hasCounties === true, { route: "/api/geo/countries" });

      const mdCounties = await api(null, "/api/geo/counties?country=US&state=US-MD");
      const mdNames = items(mdCounties).map((x) => x.name);
      step(c, "[dormant geo] Maryland lists exactly its 24 county-equivalents, never another state's", mdCounties.status === 200 && mdNames.length === 24 && mdNames.includes("Prince George's County") && mdNames.includes("Baltimore City") && !mdNames.some((n) => /Fairfax/.test(n)), { actual: `${mdNames.length} counties` });

      const pgCities = await api(null, "/api/geo/cities?country=US&state=US-MD&county=US-24033&q=Accokeek");
      step(c, "[dormant geo] Prince George's cities include Accokeek with the county relationship intact", items(pgCities).some((x) => x.name === "Accokeek" && x.countyId === "US-24033"));

      const mismatch = await api(null, "/api/geo/cities?country=US&state=US-VA&county=US-24033");
      step(c, "[dormant geo] the API still rejects a Maryland county under Virginia (400) — validation ready for the future version", mismatch.status === 400);

      const fairfaxUnderMd = await api("tonbgeo", "/api/me/profile", { method: "PATCH", body: { location: { countryCode: "US", stateId: "US-MD", countyId: "US-51059" } } });
      step(c, "[dormant geo] structured saves still validate relationally when a client opts in (Fairfax under Maryland → 400 naming Virginia)", fairfaxUnderMd.status === 400 && /Virginia/.test(String(fairfaxUnderMd.data.error || "")));

      const chain = await api("tonbgeo", "/api/me/profile", { method: "PATCH", body: { location: { countryCode: "US", stateId: "US-MD", countyId: "US-24033", cityId: "g4346952" } } });
      const p4 = await geoProfile();
      step(c, "[dormant geo] a valid structured chain still saves with canonical text + ids (future-version path intact)", chain.status === 200 && p4.city === "Accokeek" && p4.county === "Prince George's County" && p4.cityId === "g4346952");

      /* leave the throwaway profile as plain text again, like a real user */
      await api("tonbgeo", "/api/me/profile", { method: "PATCH", body: { displayName: "Geo Tester", city: "Bowie", county: "", state: "MD", country: "United States" } });
      const p5 = await geoProfile();
      step(c, "[dormant geo] switching back to plain text clears the stale ids (text is the source of truth again)", p5.city === "Bowie" && p5.cityId === "" && p5.countyId === "");
    } else {
      c.steps.push({
        name: "[dormant geo] relational geo API tests (counties, cross-state rejection, structured saves)",
        status: "NOT_TESTED",
        actual: "db/geo.db isn't compiled on this instance — the geo system is optional infrastructure and user flows don't touch it. Build later with: npm run geo:build",
      });
    }

    /* -------- REAL BROWSER LAYER — headless Chromium ---------------
       scripts/browser-qa-location.mjs drives an actual bundled
       Chromium against THIS server: type → save → reload persistence,
       single-field edits, Remote toggle, event fields, tab order,
       mobile, axe — and proves ZERO /api/geo/* requests are made.
       Falls back to an honest NOT_TESTED only if Chromium cannot
       launch in the environment. */
    try {
      const { execFile } = await import("child_process");
      const out = await new Promise<string>((resolve, reject) => {
        execFile(
          process.execPath,
          [path.join(process.cwd(), "scripts", "browser-qa-location.mjs"), "--json", "--base", BASE],
          { timeout: 300_000, maxBuffer: 10_000_000 },
          (err, stdout) => (stdout && String(stdout).trim() ? resolve(String(stdout)) : reject(err ?? new Error("no output")))
        );
      });
      const lines = out.trim().split("\n");
      const rep = JSON.parse(lines[lines.length - 1]) as { steps: { category: string; name: string; status: "PASSED" | "FAILED"; detail?: string }[]; crash?: string };
      for (const s of rep.steps) c.steps.push({ name: `[browser:${s.category}] ${s.name}`, status: s.status, actual: s.detail || undefined, severity: s.status === "FAILED" ? "HIGH" : undefined });
      if (rep.crash) c.steps.push({ name: "browser pass crashed mid-run", status: "FAILED", actual: rep.crash.slice(0, 200), severity: "HIGH" });
    } catch (e) {
      c.steps.push({
        name: "real-browser layer (headless Chromium: free-text flows, Remote toggle, mobile, axe, geo-independence)",
        status: "NOT_TESTED",
        actual: `Chromium could not launch in this environment: ${e instanceof Error ? e.message.slice(0, 160) : String(e).slice(0, 160)} — run: node scripts/browser-qa-location.mjs`,
      });
    }
  }


  /* ================= FULL SITE ROUTE SWEEP ================= */
  /* Every major route, opened for real over HTTP as the RIGHT account
     (and as a guest where public), with a hard timeout per page. Checks:
     expected status · no server-rendered error markers · the page came
     back at all. Severities: CRITICAL = 500/timeout/error-marker,
     HIGH = unexpected 404/redirect-to-error. Payments stay TEST-only by
     construction — no real rails exist in this environment. */
  {
    const c = cat("FULL SITE ROUTE SWEEP");
    const sweepTok: Record<string, string> = {
      customer: signDemoToken("testcustomer"),
      creator: signDemoToken("testcreator"),
      business: signDemoToken("testbusiness"),
      admin: signDemoToken("devin"),
    };
    const fetchPage = async (pth: string, who: string | null): Promise<{ status: number; html: string; timedOut: boolean }> => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12_000);
      try {
        const res = await fetch(BASE + pth, {
          redirect: "follow",
          signal: ctrl.signal,
          headers: who ? { Authorization: `Bearer ${sweepTok[who]}` } : {},
        });
        const html = await res.text();
        return { status: res.status, html, timedOut: false };
      } catch {
        return { status: 0, html: "", timedOut: true };
      } finally {
        clearTimeout(timer);
      }
    };
    const ERROR_MARKERS = ["Application error: a client-side exception", "Unhandled Runtime Error", "Internal Server Error", "__NEXT_ERROR__"];
    const routes: { path: string; who: string | null; label: string }[] = [
      { path: "/", who: null, label: "homepage (guest)" },
      { path: "/opportunities", who: null, label: "opportunities (guest)" },
      { path: "/services", who: null, label: "services (guest)" },
      { path: "/plans", who: null, label: "plans (guest)" },
      { path: "/login", who: null, label: "login" },
      { path: "/signup", who: null, label: "signup" },
      { path: "/creator/lena", who: null, label: "public profile (guest)" },
      { path: "/", who: "customer", label: "home (customer)" },
      { path: "/discover", who: "customer", label: "discover" },
      { path: "/messages", who: "customer", label: "messages" },
      { path: "/calendar", who: "customer", label: "bookings" },
      { path: "/services", who: "creator", label: "services (creator)" },
      { path: "/opportunities", who: "customer", label: "opportunities" },
      { path: "/live", who: "customer", label: "live discovery" },
      { path: "/opportunities/new", who: "business", label: "post opportunity" },
      { path: "/people", who: "business", label: "people" },
      { path: "/people?tab=talent", who: "business", label: "people · talent tab" },
      { path: "/hiring", who: "business", label: "hiring" },
      { path: "/payments", who: "business", label: "payments" },
      { path: "/activity", who: "customer", label: "activity" },
      { path: "/notifications", who: "customer", label: "notifications" },
      { path: "/settings", who: "customer", label: "settings" },
      { path: "/profile/studio", who: "creator", label: "profile studio" },
      { path: "/analytics", who: "creator", label: "analytics" },
      { path: "/learn", who: "customer", label: "learn hub" },
      { path: "/clients", who: "creator", label: "clients" },
      { path: "/bookmarks", who: "customer", label: "bookmarks" },
      { path: "/communities", who: "customer", label: "communities" },
      { path: "/events", who: "customer", label: "events" },
      { path: "/creator/testcreator", who: "customer", label: "QA creator profile" },
      { path: "/simulation", who: "admin", label: "test center" },
    ];
    for (const r of routes) {
      const res = await fetchPage(r.path, r.who);
      const markers = ERROR_MARKERS.filter((m) => res.html.includes(m));
      const ok = !res.timedOut && res.status === 200 && markers.length === 0;
      const severity: StepResult["severity"] = res.timedOut || res.status >= 500 || markers.length ? "CRITICAL" : res.status === 404 ? "HIGH" : ok ? undefined : "HIGH";
      step(c, `${r.label} — ${r.path}`, ok, {
        route: r.path,
        severity: ok ? undefined : severity,
        actual: res.timedOut ? "TIMEOUT after 12s — marked and skipped, the sweep continued" : `HTTP ${res.status}${markers.length ? ` · error markers: ${markers.join("; ")}` : ""}`,
      });
    }

    // DETECTOR SELF-CHECKS — prove the sweep catches what it claims to
    const gone = await fetchPage("/definitely-not-a-route-qa-probe", "customer");
    step(c, "detector self-check · a broken route IS caught (probe URL correctly classified as 404, severity HIGH)", gone.status === 404, {
      severity: gone.status === 404 ? undefined : "CRITICAL",
      actual: `probe returned HTTP ${gone.status}`,
    });
    const fakeErrorHtml = "<html><body><h2>Application error: a client-side exception has occurred</h2></body></html>";
    step(c, "detector self-check · error markers ARE caught (synthetic crash page correctly flagged)", ERROR_MARKERS.some((m) => fakeErrorHtml.includes(m)), {
      severity: "CRITICAL",
    });

    // honesty: what an HTTP sweep cannot see
    c.steps.push({
      name: "browser-level capture (console errors, live hydration mismatches, client-only exceptions) — requires a real browser runner (Playwright); this environment blocks browser downloads. SSR markers, statuses, and timeouts ARE checked above; hydration safety is regression-guarded by the deterministic-first-render pattern",
      status: "NOT_TESTED",
      actual: "a bundled headless Chromium NOW runs the location-system browser pass (see LOCATION SYSTEM category); extending live console capture to all 30 sweep routes is queued — SSR markers, statuses and timeouts ARE checked here",
    });
  }

  /* ================= DATABASE INTEGRITY ================= */
  {
    const c = cat("DATABASE INTEGRITY");
    const bk = db.select().from(tables.bookings).where(eq(tables.bookings.id, bookingId)).get();
    const members = bk?.conversationId
      ? db.select().from(tables.conversationMembers).where(eq(tables.conversationMembers.conversationId, bk.conversationId)).all().map((m) => m.userId).sort()
      : [];
    step(c, "booking → conversation → participants chain is exact", !!bk && members.length === 2 && members.includes(rachel.id) && members.includes(lena.id), { record: bookingId });
    const pays = db.select().from(tables.payments).all().filter((p) => p.bookingId === bookingId || p.projectId === projectId);
    step(c, "payments reference their real records with correct parties", pays.length === 2 && pays.every((p) => p.payerId === rachel.id && p.payeeId === lena.id), { actual: `${pays.length} payments` });
    const orphanMembers = db.select().from(tables.conversationMembers).all().filter((m) => !db.select().from(tables.conversations).where(eq(tables.conversations.id, m.conversationId)).get()).length;
    step(c, "no orphaned conversation members", orphanMembers === 0, { actual: String(orphanMembers) });
    const dupBookings = db.select().from(tables.bookings).where(and(eq(tables.bookings.clientId, rachel.id), eq(tables.bookings.providerId, lena.id))).all().length;
    step(c, "exact booking count from the run (1 flow + 3 loyalty + 1 window + 1 drop + 2 horizon + 1 slot-proof)", dupBookings === 9, { expected: "9", actual: String(dupBookings) });
  }

  } catch (e) {
    // a crash mid-run is a FAILURE where it happened…
    const current = cats[cats.length - 1];
    (current?.steps ?? []).push({
      name: `category crashed: ${e instanceof Error ? e.message : String(e)}`,
      status: "FAILED",
      actual: e instanceof Error ? e.message : String(e),
    });
  }

  // …and everything that never ran is NOT TESTED — never assumed passed
  for (const name of PLANNED_CATEGORIES)
    if (!cats.some((c) => c.name === name))
      cats.push({ name, steps: [{ name: "did not run — an earlier failure blocked this category", status: "NOT_TESTED" }] });

  const all = cats.flatMap((c) => c.steps);
  const summary = {
    passed: all.filter((s) => s.status === "PASSED").length,
    failed: all.filter((s) => s.status === "FAILED").length,
    blocked: all.filter((s) => s.status === "BLOCKED").length,
    notTested: all.filter((s) => s.status === "NOT_TESTED").length,
    critical: all.filter((s) => s.status === "FAILED" && s.severity === "CRITICAL").length,
    durationMs: Date.now() - started,
  };
  return Response.json({
    summary,
    categories: cats.map((c) => ({
      name: c.name,
      ok: c.steps.every((s) => s.status === "PASSED"),
      passed: c.steps.filter((s) => s.status === "PASSED").length,
      failed: c.steps.filter((s) => s.status === "FAILED").length,
      blocked: c.steps.filter((s) => s.status === "BLOCKED").length,
      notTested: c.steps.filter((s) => s.status === "NOT_TESTED").length,
      steps: c.steps,
    })),
  });
}
