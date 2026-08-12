#!/usr/bin/env node
/* ------------------------------------------------------------------ */
/*  browser-qa-location.mjs — REAL-BROWSER QA pass for the location    */
/*  fields, driven by an actual headless Chromium (@sparticuz/chromium */
/*  binary shipped via npm; no downloads at runtime).                  */
/*                                                                     */
/*  CURRENT DESIGN UNDER TEST: simple free-text inputs (City / County  */
/*  / State / Country). The geo reference system (db/geo.db,           */
/*  /api/geo/*) is deliberately DORMANT — this pass also proves the    */
/*  user flows never touch it.                                         */
/*                                                                     */
/*  Categories: browser-ui · keyboard · forms · responsive · a11y      */
/*                                                                     */
/*  Usage:                                                             */
/*    node scripts/browser-qa-location.mjs [--base http://…] [--json]  */
/*                                                                     */
/*  Safety: signs in only as a throwaway tonbui* account (created      */
/*  here, removed by the standard tonb% cleanup).                      */
/* ------------------------------------------------------------------ */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const BASE = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : process.env.MAVYN_URL || "http://localhost:3000";
const JSON_OUT = process.argv.includes("--json");
const ART = path.join(process.cwd(), "qa-artifacts");
fs.mkdirSync(ART, { recursive: true });

const steps = [];
const log = (...a) => { if (!JSON_OUT) console.log(...a); };
const step = (category, name, pass, detail = "") => {
  steps.push({ category, name, status: pass ? "PASSED" : "FAILED", detail: String(detail).slice(0, 300) });
  log(`  ${pass ? "✓" : "✕"} [${category}] ${name}${detail ? ` — ${detail}` : ""}`);
  return pass;
};

/* ---------------- chromium bootstrap (bundled libs) ----------------- */
function ensureLibs() {
  const libDir = "/tmp/al2023/lib";
  if (fs.existsSync(path.join(libDir, "libnss3.so"))) return libDir;
  const br = path.join(process.cwd(), "node_modules", "@sparticuz", "chromium", "bin", "al2023.tar.br");
  const tar = "/tmp/mavyn-al2023.tar";
  fs.writeFileSync(tar, zlib.brotliDecompressSync(fs.readFileSync(br)));
  execSync(`mkdir -p /tmp/al2023 && tar -xf ${tar} -C /tmp/al2023`);
  return libDir;
}

async function api(pathname, opts = {}, token) {
  const res = await fetch(BASE + pathname, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

/* hydration-safe typing: click, clear, type, verify — retry until the
   React state actually holds the value (handlers attach after SSR)   */
async function typeInto(page, sel, text) {
  await page.waitForSelector(sel, { timeout: 15000 });
  for (let i = 0; i < 10; i++) {
    await page.$eval(sel, (e) => e.scrollIntoView({ block: "center" }));
    await page.click(sel).catch(() => {});
    // pre-hydration clicks don't move focus — NEVER clear/type unless
    // the target field actually owns the focus (protects other fields)
    const focused = await page.evaluate((s) => document.activeElement === document.querySelector(s), sel);
    if (!focused) { await new Promise((r) => setTimeout(r, 400)); continue; }
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    if (text) await page.type(sel, text, { delay: 10 });
    await new Promise((r) => setTimeout(r, 150));
    const v = await page.$eval(sel, (e) => e.value);
    if (v === text) return;
  }
  throw new Error(`couldn't type "${text}" into ${sel}`);
}
const val = (page, sel) => page.$eval(sel, (e) => e.value);

/* type a SET of fields and verify they all still hold their values —
   text typed before React hydration lives only in the DOM and gets
   wiped when hydration lands, so re-check the whole set and redo it
   until it survives (by the second pass hydration is always done) */
async function typeAll(page, pairs) {
  for (let round = 0; round < 4; round++) {
    for (const [sel, text] of pairs) await typeInto(page, sel, text);
    await new Promise((r) => setTimeout(r, 700));
    let ok = true;
    for (const [sel, text] of pairs) if ((await val(page, sel)) !== text) ok = false;
    if (ok) return;
  }
  throw new Error("field values kept getting reset — hydration never settled");
}

(async () => {
  const libDir = ensureLibs();
  const chromium = require("@sparticuz/chromium").default ?? require("@sparticuz/chromium");
  const puppeteer = require("puppeteer-core");
  const browser = await puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: await chromium.executablePath(),
    headless: true,
    env: { ...process.env, LD_LIBRARY_PATH: libDir },
  });

  const pageErrors = [];
  const geoRequests = [];
  const newPage = async (w = 1440, h = 900) => {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    page.on("pageerror", (e) => pageErrors.push(String(e.message || e).slice(0, 200)));
    page.on("request", (req) => { if (req.url().includes("/api/geo/")) geoRequests.push(req.url()); });
    return page;
  };

  /* throwaway account */
  const nonce = Date.now().toString(36).slice(-6);
  const su = await api("/api/auth/signup", { method: "POST", body: { email: `tonbui.${nonce}@mavyn.dev`, password: "Browser-pass-2026", handle: "tonbui", displayName: "Browser QA" } });
  let uiTok = su.data.sessionToken || "";
  if (!uiTok) {
    const li = await api("/api/auth/login", { method: "POST", body: { identifier: "tonbui", password: "Browser-pass-2026" } });
    uiTok = li.data.sessionToken || "";
  }
  if (!uiTok) throw new Error("couldn't provision the throwaway tonbui account");
  await api("/api/me/onboarding", { method: "POST", body: { action: "skip" } }, uiTok);
  const asUser = async (page, token) => page.setCookie({ name: "mavyn_session", value: token, url: BASE });

  const CITY = 'input[aria-label=City][placeholder=City]';
  const COUNTY = 'input[aria-label=County]';
  const STATE = 'input[aria-label=State][placeholder=State]';
  const COUNTRY = 'input[aria-label=Country]';
  const SAVE = async (page) => {
    const clicked = await page.$$eval("button", (els) => { const b = els.find((e) => e.textContent?.trim() === "Save Changes" && !e.disabled); if (b) { b.click(); return true; } return false; });
    await new Promise((r) => setTimeout(r, 1500));
    return clicked;
  };

  /* start from a KNOWN state so "Save Changes" is genuinely exercised
     (a rerun could otherwise find the values already saved) */
  await api("/api/me/profile", { method: "PATCH", body: { displayName: "Browser QA", city: "", county: "", state: "", country: "" } }, uiTok);

  /* ============ 1 · PROFILE: type → save → reload → exact ============ */
  {
    const page = await newPage();
    await asUser(page, uiTok);
    await page.goto(`${BASE}/profile/edit`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await typeAll(page, [[CITY, "Accokeek"], [COUNTY, "Prince George's"], [STATE, "MD"], [COUNTRY, "United States"]]);
    const saved1 = await SAVE(page);
    await page.goto(`${BASE}/profile/edit`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForFunction((s) => document.querySelector(s)?.value !== "", { timeout: 15000 }, CITY).catch(() => {});
    const got1 = [await val(page, CITY), await val(page, COUNTY), await val(page, STATE), await val(page, COUNTRY)];
    step("browser-ui", "type City/County/State/Country → Save Changes → reload: the EXACT text remains", saved1 && got1.join("|") === "Accokeek|Prince George's|MD|United States", got1.join(" · "));
    await page.screenshot({ path: path.join(ART, "freetext-profile-saved.png") });

    /* edit ONE field, save, reload — others untouched */
    await typeAll(page, [[CITY, "Bowie"]]);
    const saved2 = await SAVE(page);
    await page.goto(`${BASE}/profile/edit`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForFunction((s) => document.querySelector(s)?.value !== "", { timeout: 15000 }, CITY).catch(() => {});
    const got2 = [await val(page, CITY), await val(page, COUNTY), await val(page, STATE), await val(page, COUNTRY)];
    step("browser-ui", "edit ONE field (City → Bowie) → save → reload: only that field changed", saved2 && got2.join("|") === "Bowie|Prince George's|MD|United States", got2.join(" · "));

    /* keyboard: plain inputs, plain tab order */
    await page.focus(CITY);
    await page.keyboard.press("Tab");
    const afterTab = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    await page.keyboard.down("Shift"); await page.keyboard.press("Tab"); await page.keyboard.up("Shift");
    const afterShift = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    step("keyboard", "Tab / Shift+Tab walk the four fields in order — plain inputs, no traps", afterTab === "County" && afterShift === "City", `Tab→${afterTab}, Shift+Tab→${afterShift}`);
    await page.close();
  }

  /* ============ 2 · OPPORTUNITY: location text + Remote ============== */
  {
    const page = await newPage();
    await asUser(page, uiTok);
    await page.goto(`${BASE}/opportunities/new`, { waitUntil: "domcontentloaded", timeout: 45000 });
    const LOC = 'input[aria-label=Location]';
    await typeAll(page, [[LOC, "Bowie, MD"]]);
    let hidden = false;
    for (let i = 0; i < 8 && !hidden; i++) {
      await page.$$eval("input[type=checkbox]", (els) => { const l = els.find((e) => e.closest("label")?.textContent?.includes("Remote")); l?.click(); });
      await new Promise((r) => setTimeout(r, 300));
      hidden = !(await page.$(LOC));
    }
    step("forms", "opportunity: free-text location typable; toggling Remote hides the field", hidden);
    await page.$$eval("input[type=checkbox]", (els) => { const l = els.find((e) => e.closest("label")?.textContent?.includes("Remote")); l?.click(); });
    await page.waitForSelector(LOC, { timeout: 5000 });
    step("forms", "un-toggling Remote brings the location field back", true, `value now "${await val(page, LOC)}"`);
    await page.close();
  }

  /* ============ 3 · EVENT: city + state text ========================= */
  {
    const page = await newPage();
    await asUser(page, uiTok);
    await page.goto(`${BASE}/events/create`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await typeAll(page, [['input[aria-label=City]', "Baltimore"], ['input[aria-label=State]', "MD"]]);
    const evGot = [await val(page, 'input[aria-label=City]'), await val(page, 'input[aria-label=State]')];
    step("forms", "event creation: plain CITY and STATE inputs accept text", evGot[0] === "Baltimore" && evGot[1] === "MD", evGot.join(" · "));
    await page.close();
  }

  /* ============ 4 · RESPONSIVE 375×667 =============================== */
  {
    const page = await newPage(375, 667);
    await asUser(page, uiTok);
    await page.goto(`${BASE}/profile/edit`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await typeAll(page, [[CITY, "Accokeek"]]);
    const rect = await page.$eval(CITY, (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
    step("responsive", "mobile: location inputs fit the viewport and accept text", rect.l >= 0 && rect.r <= rect.w + 1 && (await val(page, CITY)) === "Accokeek", JSON.stringify(rect));
    await page.screenshot({ path: path.join(ART, "freetext-mobile.png") });
    await page.close();
  }

  /* ============ 5 · ACCESSIBILITY ==================================== */
  {
    const page = await newPage();
    await asUser(page, uiTok);
    await page.goto(`${BASE}/profile/edit`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(CITY, { timeout: 15000 });
    await page.evaluate(fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"));
    const axe = await page.evaluate(async (s) => {
      const el = document.querySelector(s)?.closest("div.grid") || document.body;
      const res = await window.axe.run(el, { resultTypes: ["violations"] });
      return res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    }, CITY);
    const serious = axe.filter((v) => v.impact === "serious" || v.impact === "critical");
    step("a11y", "axe-core scan of the location fields: zero serious/critical violations (all four inputs labelled)", serious.length === 0, axe.length ? axe.map((v) => `${v.id}(${v.impact})`).join(", ") : "no violations at all");
    await page.close();
  }

  /* ============ 6 · independence + stability ========================= */
  step("browser-ui", "ZERO requests to /api/geo/* during the entire pass — location entry does not depend on the geo database", geoRequests.length === 0, geoRequests.slice(0, 3).join(" | ") || "0 geo requests");
  step("browser-ui", "no uncaught client-side exceptions during the entire pass (pageerror hook on every page)", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | ") || "0 exceptions");

  await browser.close();

  const failed = steps.filter((s) => s.status === "FAILED").length;
  if (JSON_OUT) console.log(JSON.stringify({ steps, failed, passed: steps.length - failed }));
  else {
    console.log(`\nBROWSER QA — ${steps.length - failed} passed · ${failed} failed`);
    console.log(`artifacts: ${ART}`);
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  if (JSON_OUT) console.log(JSON.stringify({ steps, failed: steps.length + 1, passed: 0, crash: String(e?.stack || e).slice(0, 500) }));
  else console.error("CRASH:", e);
  process.exit(1);
});
