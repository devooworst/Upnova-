/* CLI runner for the full system test — the same real-HTTP journey the
   Test Center runs (Playwright is the right production harness for
   browser-level flows, but its browser downloads are blocked in this
   sandbox; this exercises the identical API surface). */
const BASE = process.env.MAVYN_URL || "http://localhost:3000";
const login = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: "devin", password: "mavyn123" }) });
const { sessionToken } = await login.json();
if (!sessionToken) { console.error("login failed"); process.exit(1); }
const res = await fetch(`${BASE}/api/demo/fulltest`, { method: "POST", headers: { Authorization: `Bearer ${sessionToken}` } });
const report = await res.json();
if (!res.ok) { console.error("run failed:", report.error); process.exit(1); }
console.log(`\nFULL MAVYN SYSTEM TEST — ${(report.summary.durationMs / 1000).toFixed(1)}s`);
console.log(`PASSED ${report.summary.passed} · FAILED ${report.summary.failed} · BLOCKED ${report.summary.blocked}\n`);
for (const c of report.categories) {
  console.log(`${c.ok ? "✓" : "✕"} ${c.name}`);
  for (const s of c.steps) {
    if (s.status !== "PASSED") console.log(`   ${s.status === "BLOCKED" ? "◌" : "✕"} ${s.name}\n     expected: ${s.expected ?? "-"} | actual: ${s.actual ?? "-"} | route: ${s.route ?? "-"} | record: ${s.record ?? "-"}`);
  }
}
process.exit(report.summary.failed ? 1 : 0);
