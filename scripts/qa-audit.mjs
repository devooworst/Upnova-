/* ------------------------------------------------------------------ */
/*  TEST CENTER FULL AUDIT — walks EVERY QA scenario start → finish    */
/*  through the real HTTP routes, validating at every single step:     */
/*   · exactly ONE pending task, everything after LOCKED               */
/*   · the pending index === server's `current` (no stale indexes)     */
/*   · the task's destination page loads (200) for the RIGHT persona   */
/*   · autos only ever advance; auto-checks cascade                    */
/*   · displayed done-count === verified database state                */
/*   · persona switching works for all three QA personas               */
/*  Usage: MAVYN_URL=http://localhost:3001 node scripts/qa-audit.mjs   */
/* ------------------------------------------------------------------ */
const BASE = process.env.MAVYN_URL || "http://localhost:3000";
const failures = [];
const ok = (s) => console.log(`  ✓ ${s}`);
const bad = (s) => { failures.push(s); console.log(`  ✕ ${s}`); };

const login = async (id) => {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: id, password: "mavyn123" }) });
  const d = await r.json();
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  return { token: d.sessionToken, cookie };
};
const sessions = {};
for (const h of ["devin", "testcustomer", "testcreator", "testbusiness"]) sessions[h] = await login(h);

const api = async (who, path, init) => {
  const r = await fetch(BASE + path, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessions[who].token}` },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const page = async (who, href) => {
  const r = await fetch(BASE + href, { headers: { cookie: sessions[who].cookie }, redirect: "follow" });
  return r.status;
};

/* ---- persona switching (the exact route the UI buttons call) ---- */
console.log("\nPERSONA SWITCHING");
for (const h of ["testcustomer", "testcreator", "testbusiness"]) {
  const r = await api("devin", "/api/qa/impersonate", { method: "POST", body: { handle: h } });
  if (r.status === 200) ok(`impersonate → ${h}`);
  else bad(`impersonate ${h} failed: ${r.status} ${JSON.stringify(r.data).slice(0, 80)}`);
}

/* ---- walk every scenario, in full, strictly in order ---- */
const SCENARIOS = ["booking", "project", "opportunity", "hiring", "people", "plans", "live"];
for (const sid of SCENARIOS) {
  console.log(`\nSCENARIO: ${sid}`);
  const arm = await api("devin", `/api/qa/scenarios/${sid}`, { method: "POST", body: { action: "reset" } });
  if (arm.status !== 200) { bad(`${sid}: arm failed ${arm.status}`); continue; }
  let st = arm.data;
  if (st.current !== 0 || st.done !== 0) bad(`${sid}: fresh arm not at Test 1 (current=${st.current} done=${st.done})`);

  let lastPending = null, stuckCount = 0, guard = 0;
  const visitedPages = new Set();
  while (!st.completed && guard++ < 120) {
    const pendings = st.steps.filter((x) => x.status === "pending");
    if (pendings.length !== 1) { bad(`${sid}: ${pendings.length} pending steps (must be exactly 1)`); break; }
    const cur = pendings[0];
    const idx = st.steps.findIndex((x) => x.id === cur.id);
    if (idx !== st.current) bad(`${sid}:${cur.id}: index mismatch — pending idx=${idx} but current=${st.current}`);
    const lockedAfter = st.steps.slice(idx + 1).every((x) => x.status === "locked");
    if (!lockedAfter) bad(`${sid}:${cur.id}: a step after the current one is not locked`);
    if (st.done !== idx) bad(`${sid}:${cur.id}: displayed done=${st.done} ≠ verified prefix=${idx}`);

    // destination page must load for the acting persona
    const who = cur.role === "check" ? "devin" : cur.role;
    const href = (cur.href && cur.href !== "#" ? cur.href : "/simulation").split("?")[0] + (cur.href.includes("?") ? "?" + cur.href.split("?")[1] : "");
    const pkey = `${who}:${href}`;
    if (!visitedPages.has(pkey)) {
      visitedPages.add(pkey);
      const ps = await page(who, cur.href);
      if (ps === 200) ok(`${cur.id} [${cur.role}] page ${cur.href} → 200`);
      else bad(`${sid}:${cur.id}: destination ${cur.href} → HTTP ${ps} for ${who}`);
    }

    if (cur.id === lastPending) {
      stuckCount++;
      if (stuckCount > 3) { bad(`${sid}:${cur.id}: STUCK — actual: "${cur.actual}"`); break; }
      await new Promise((r) => setTimeout(r, 400));
    } else stuckCount = 0;
    lastPending = cur.id;

    if (cur.role === "check") {
      // checks verify themselves on evaluation — just re-read
      st = (await api("devin", `/api/qa/scenarios/${sid}`)).data;
      continue;
    }
    if (!cur.canAuto) { bad(`${sid}:${cur.id}: user step has no perform — cannot walk`); break; }
    const auto = await api("devin", `/api/qa/scenarios/${sid}`, { method: "POST", body: { action: "auto", step: cur.id } });
    if (auto.status !== 200) { bad(`${sid}:${cur.id}: auto failed ${auto.status} ${JSON.stringify(auto.data).slice(0, 100)}`); break; }
    const before = st.done;
    st = auto.data;
    if (st.done < before) bad(`${sid}:${cur.id}: done went BACKWARDS ${before} → ${st.done}`);
  }
  if (st.completed && st.done === st.total) ok(`${sid} COMPLETE — ${st.done}/${st.total}, every checkpoint database-verified`);
  else if (!failures.some((f) => f.startsWith(sid))) bad(`${sid}: did not complete (${st.done}/${st.total})`);

  // completed state survives fresh reads + the overview agrees
  const re = (await api("devin", `/api/qa/scenarios/${sid}`)).data;
  const lab = (await api("devin", "/api/qa/state")).data;
  const row = (lab.scenarios ?? []).find((x) => x.id === sid);
  if (re.completed && re.done === re.total && row?.completed && row?.done === re.total) ok(`${sid} score persists (detail ${re.done}/${re.total} · overview ${row.done}/${row.total})`);
  else bad(`${sid}: score mismatch after completion — detail=${re.done}/${re.total} overview=${row?.done}/${row?.total}`);
}

/* ---- resets are scoped ---- */
console.log("\nRESET SCOPING");
const before = (await api("devin", "/api/qa/state")).data;
await api("devin", "/api/qa/scenarios/booking", { method: "POST", body: { action: "reset" } });
const after = (await api("devin", "/api/qa/state")).data;
const bookingRow = after.scenarios.find((x) => x.id === "booking");
const othersKept = ["project", "opportunity", "hiring", "people"].every((id) => {
  const b = before.scenarios.find((x) => x.id === id);
  const a = after.scenarios.find((x) => x.id === id);
  return a.completed === b.completed && a.done === b.done;
});
if (bookingRow.done === 0 && !bookingRow.completed && othersKept) ok("resetting booking → 0/14; all four other scenarios keep their completed scores");
else bad(`reset scoping broken: booking=${bookingRow.done} othersKept=${othersKept}`);
await api("devin", "/api/qa/scenarios/booking", { method: "POST", body: { action: "reset" } });

console.log(`\n${"=".repeat(60)}\nAUDIT ${failures.length === 0 ? "CLEAN" : `FOUND ${failures.length} FAILURE(S)`}`);
for (const f of failures) console.log(`  ✕ ${f}`);
process.exit(failures.length ? 1 : 0);
