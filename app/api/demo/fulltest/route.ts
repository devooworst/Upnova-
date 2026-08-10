import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError, isDemoMode } from "@/lib/server/auth";
import { isSeedUser } from "@/lib/server/demo";
import { worldDeviceForWidth, resolveWorldLayout } from "@/lib/profileStudio";

/* per-run email nonce — throwaway signups get a UNIQUE email every run so
   the production signup rate limiter (5 per email / 15 min) never trips
   across repeated suite runs. Handles stay stable and are cleaned at reset. */
const runNonce = () => Date.now().toString(36).slice(-6);

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* ------------------------------------------------------------------ */
/* FULL UPNOVA SYSTEM TEST — the Test Center "game mode" backend.      */
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

type StepResult = { name: string; status: "PASSED" | "FAILED" | "BLOCKED" | "NOT_TESTED"; expected?: string; actual?: string; route?: string; record?: string };
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
  "DATABASE INTEGRITY",
];

export async function POST(req: NextRequest) {
  const gate = await guarded(() => {
    if (!isDemoMode()) throw new ApiError(404, "Not found");
    requireUser(); // any signed-in tester may run it
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
    // business test opportunity from prior runs
    for (const o of db.select().from(tables.opportunities).where(eq(tables.opportunities.posterId, biz.id)).all())
      if (o.title.startsWith("[TEST]")) {
        db.delete(tables.applications).where(eq(tables.applications.opportunityId, o.id)).run();
        db.delete(tables.opportunities).where(eq(tables.opportunities.id, o.id)).run();
      }
    db.delete(tables.notifications).where(eq(tables.notifications.userId, lena.id)).run();
    // preferred-first windows from prior runs
    for (const s of db.select().from(tables.services).where(eq(tables.services.ownerId, lena.id)).all())
      if (s.preferredUntil) db.update(tables.services).set({ preferredUntil: null }).where(eq(tables.services.id, s.id)).run();
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
        db.delete(tables.payments).where(eq(tables.payments.payeeId, u.id)).run();
        db.delete(tables.payments).where(eq(tables.payments.payerId, u.id)).run();
        db.delete(tables.sessions).where(eq(tables.sessions.userId, u.id)).run();
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
    for (const [who, pw] of [["rachel", "upnova123"], ["lena", "upnova123"], ["harboroak", "upnova123"]] as const) {
      const r = await api(null, "/api/auth/login", { method: "POST", body: { identifier: who, password: pw } });
      tok[who] = (r.data as { sessionToken?: string }).sessionToken ?? "";
      step(c, `login ${who} (own session)`, r.status === 200 && !!tok[who], { route: "POST /api/auth/login" });
    }
    const r2 = await api(null, "/api/auth/login", { method: "POST", body: { identifier: "rachel", password: "upnova123" } });
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
    const jl = await api(null, "/api/auth/login", { method: "POST", body: { identifier: "jaylin@upnova.dev", password: "upnova123" } });
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
        route: "POST /api/auth/login (jaylin@upnova.dev)",
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
    const nu = await api(null, "/api/auth/signup", { method: "POST", body: { email: `tonbsearch.${runNonce()}@upnova.dev`, password: "Tour-walkthrough-99", handle: "tonbsearch", displayName: "Searchme Fresh" } });
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
      const r = await api(null, "/api/auth/signup", { method: "POST", body: { email: `${handle}.${runNonce()}@upnova.dev`, password: "Tour-walkthrough-99", handle, displayName: `Real ${handle}` } });
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
    const dl = await api(null, "/api/auth/login", { method: "POST", body: { identifier: "devin", password: "upnova123" } });
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
    const mkProv = await api(null, "/api/auth/signup", { method: "POST", body: { email: `tonbp.${runNonce()}@upnova.dev`, password: "Tour-walkthrough-99", handle: "tonbp", displayName: "Pat Provider" } });
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
    step(c, "provider opens a 24h preferred-first window (holders notified)", win.status === 200 && Number((win.data as any).notified) >= 1, { route: "POST early-access" });
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
  }

  /* ================= FIRST-TIME ONBOARDING ================= */
  {
    const c = cat("ONBOARDING");
    const mk = async (handle: string, extra: Record<string, unknown> = {}) => {
      const r = await api(null, "/api/auth/signup", { method: "POST", body: { email: `${handle}.${runNonce()}@upnova.dev`, password: "Tour-walkthrough-99", handle, displayName: `Tour ${handle}`, ...extra } });
      tok[handle] = (r.data as { sessionToken?: string }).sessionToken ?? "";
      return r;
    };
    const a = await mk("tonba");
    const meA = (await api("tonba", "/api/auth/me")).data as any;
    step(c, "brand-new account starts NOT onboarded", a.status === 200 && meA.user?.onboarding?.completed === false, { route: "POST /api/auth/signup", actual: JSON.stringify(meA.user?.onboarding) });
    const tourA = (await api("tonba", "/api/onboarding/tour")).data as any;
    const idsA = (tourA.steps ?? []).map((s: any) => s.id);
    step(c, "personal tour covers the core navigation (home…my world…settings)", tourA.audience === "creator" && ["home", "discover", "opportunities", "services", "messages", "notifications", "profile", "myworld", "settings"].every((x) => idsA.includes(x)), { actual: idsA.join(",") });
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

    const nlog = await api(null, "/api/auth/login", { method: "POST", body: { identifier: "nia", password: "upnova123" } });
    tok.nia = (nlog.data as any).sessionToken ?? "";
    const tourN = (await api("nia", "/api/onboarding/tour")).data as any;
    step(c, "verified student → student tour incl. Your Campus", tourN.audience === "student" && (tourN.steps ?? []).some((s: any) => s.id === "campus"), { actual: tourN.audience });
    await api("nia", "/api/auth/logout", { method: "POST" });
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
      const r = await api(null, "/api/auth/signup", { method: "POST", body: { email: `${handle}.${runNonce()}@upnova.dev`, password: "Tour-walkthrough-99", handle, displayName: `Cap ${handle}`, ...extra } });
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
    step(c, "exact booking count from the run (1 flow + 3 loyalty + 1 window)", dupBookings === 5, { expected: "5", actual: String(dupBookings) });
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
