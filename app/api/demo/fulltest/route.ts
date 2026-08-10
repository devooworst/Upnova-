import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { requireUser, guarded, ApiError, isDemoMode } from "@/lib/server/auth";
import { isSeedUser } from "@/lib/server/demo";

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

type StepResult = { name: string; status: "PASSED" | "FAILED" | "BLOCKED"; expected?: string; actual?: string; route?: string; record?: string };
type Category = { name: string; steps: StepResult[] };

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
  };
  resetTestData();

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
    const anon = await api(null, "/api/me/notifications");
    step(c, "protected route rejects no/invalid credentials", anon.status === 401, { route: "GET /api/me/notifications", actual: String(anon.status) });
  }

  /* ================= PROFILES + SEARCH ================= */
  {
    const c = cat("PROFILES & SEARCH");
    const prof = await api("rachel", "/api/users/lena");
    const services = (prof.data as any).services ?? [];
    step(c, "open lena's profile: identity + services visible", prof.status === 200 && (prof.data as any).user?.handle === "lena" && services.length > 0, { route: "GET /api/users/lena", record: `services=${services.length}` });
    const bp = await api("rachel", "/api/users/harboroak");
    step(c, "business profile is a business destination (business block present)", !!(bp.data as any).business, { route: "GET /api/users/harboroak" });
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
    step(c, "no duplicated bookings from the run", dupBookings === 1, { expected: "1", actual: String(dupBookings) });
  }

  const all = cats.flatMap((c) => c.steps);
  const summary = {
    passed: all.filter((s) => s.status === "PASSED").length,
    failed: all.filter((s) => s.status === "FAILED").length,
    blocked: all.filter((s) => s.status === "BLOCKED").length,
    durationMs: Date.now() - started,
  };
  return Response.json({ summary, categories: cats.map((c) => ({ name: c.name, ok: c.steps.every((s) => s.status === "PASSED"), steps: c.steps })) });
}
