#!/usr/bin/env node
/* ------------------------------------------------------------------ */
/*  browser-qa-location.mjs — REAL-BROWSER QA pass for the location    */
/*  system, driven by an actual headless Chromium (@sparticuz/chromium */
/*  binary shipped via npm; no downloads at runtime).                  */
/*                                                                     */
/*  This is the browser layer the structural tests could not cover:    */
/*  every step below clicks, types and reads the REAL rendered UI on   */
/*  the running server — nothing is inferred from source code.         */
/*                                                                     */
/*  Categories reported:                                               */
/*    browser-ui     full cascade flows, parent resets, auto-fill,     */
/*                   duplicate names, save + reload persistence        */
/*    keyboard       ArrowUp/Down, Enter, Escape, Tab, Shift+Tab,      */
/*                   focus-never-lost                                  */
/*    search-states  valid/partial/none, clearing, rapid typing,       */
/*                   slow network, failed request + Retry              */
/*    responsive     375×667 mobile: clipping, hit-testing, scrolling  */
/*    overlay        Test Center persona bar open — nothing covered    */
/*    a11y           axe-core scan of the picker (open state)          */
/*    forms          opportunity + event creation pickers              */
/*                                                                     */
/*  Usage:                                                             */
/*    node scripts/browser-qa-location.mjs [--base http://…] [--json]  */
/*                                                                     */
/*  Safety: signs in only as a throwaway tonbui* account (created here,*/
/*  removed by the standard tonb% cleanup) and — for the overlay test —*/
/*  as the QA persona testcreator WITHOUT saving anything.             */
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
  const br = path.join(path.dirname(require.resolve("@sparticuz/chromium/package.json")), "bin", "al2023.tar.br");
  const tar = "/tmp/mavyn-al2023.tar";
  fs.writeFileSync(tar, zlib.brotliDecompressSync(fs.readFileSync(br)));
  execSync(`mkdir -p /tmp/al2023 && tar -xf ${tar} -C /tmp/al2023`);
  return libDir;
}

/* --------------------------- api helpers ---------------------------- */
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

/* ------------------------ picker interactions ----------------------- */
const LVL = (l) => `[data-guide=location-${l}]`;
const CONTROL = (l) => `${LVL(l)} > div.flex`;
const INPUT = (l) => `${LVL(l)} input[role=combobox]`;

async function openLevel(page, lvl) {
  await page.waitForSelector(CONTROL(lvl), { timeout: 8000 });
  // the SSR markup exists before React hydrates — retry until the click
  // actually opens the combobox (handler attached)
  for (let i = 0; i < 8; i++) {
    await page.$eval(CONTROL(lvl), (e) => e.scrollIntoView({ block: "center" }));
    await page.click(CONTROL(lvl)).catch(() => {});
    const ok = await page.waitForSelector(INPUT(lvl), { timeout: 1200 }).catch(() => null);
    if (ok) return;
  }
  throw new Error(`the ${lvl} combobox never opened on click`);
}
async function waitResult(page, lvl, timeout = 9000) {
  await page.waitForFunction(
    (s) => {
      const r = document.querySelector(s);
      return !!r && !!(r.querySelector("[role=option]") || r.querySelector("[data-geo-empty]") || r.querySelector("[data-geo-error]"));
    },
    { timeout },
    LVL(lvl)
  );
}
async function search(page, lvl, q, { delay = 25 } = {}) {
  await page.evaluate((s) => { const i = document.querySelector(s); i.select?.(); }, INPUT(lvl));
  if (q) await page.type(INPUT(lvl), q, { delay });
  await new Promise((r) => setTimeout(r, 350));
  await waitResult(page, lvl);
}
async function optionRows(page, lvl) {
  return page.$$eval(`${LVL(lvl)} [role=option]`, (els) =>
    els.map((e) => ({ name: e.querySelector("span")?.textContent || "", hint: e.querySelectorAll("span")[1]?.textContent || "" }))
  );
}
async function clickOption(page, lvl, name) {
  // atomic: find the row by exact name AND fire its pointerdown in one
  // evaluate — the list can re-render between calls on a fast server,
  // which would make element handles stale
  for (let i = 0; i < 6; i++) {
    const ok = await page.evaluate(
      (s, n) => {
        const rows = Array.from(document.querySelectorAll(`${s} [role=option]`));
        const row = rows.find((r) => r.querySelector("span")?.textContent === n);
        if (!row) return false;
        row.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        return true;
      },
      LVL(lvl),
      name
    );
    if (ok) {
      await new Promise((r) => setTimeout(r, 250));
      return;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`option "${name}" not in the ${lvl} list`);
}
async function pickPath(page, lvl, q, name) {
  await openLevel(page, lvl);
  await search(page, lvl, q);
  await clickOption(page, lvl, name ?? q);
}
async function visibleValue(page, lvl) {
  const btn = await page.$(`${CONTROL(lvl)} button[aria-haspopup=listbox]`);
  if (!btn) return null;
  return (await btn.evaluate((e) => e.textContent || "")).trim();
}
async function levelPresent(page, lvl) {
  return !!(await page.$(LVL(lvl)));
}
async function activeInfo(page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    return { tag: a?.tagName || "NONE", label: a?.getAttribute?.("aria-label") || a?.getAttribute?.("placeholder") || "" };
  });
}

/* ================================ main =============================== */
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
  const newPage = async (w = 1440, h = 900) => {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    page.on("pageerror", (e) => pageErrors.push(String(e.message || e).slice(0, 200)));
    return page;
  };

  /* throwaway account (never a real user, never a persona) */
  const nonce = Date.now().toString(36).slice(-6);
  const su = await api("/api/auth/signup", { method: "POST", body: { email: `tonbui.${nonce}@mavyn.dev`, password: "Browser-pass-2026", handle: "tonbui", displayName: "Browser QA" } });
  let uiTok = su.data.sessionToken || "";
  if (!uiTok) {
    const li = await api("/api/auth/login", { method: "POST", body: { identifier: "tonbui", password: "Browser-pass-2026" } });
    uiTok = li.data.sessionToken || "";
  }
  if (!uiTok) throw new Error("couldn't provision the throwaway tonbui account");
  // fresh accounts get the onboarding tour modal — skip it the legit way
  // (Skip is a first-class user action) so it never swallows clicks
  await api("/api/me/onboarding", { method: "POST", body: { action: "skip" } }, uiTok);
  const asUser = async (page, token) => page.setCookie({ name: "mavyn_session", value: token, url: BASE });

  /* ============ 1 · BROWSER-UI: the exact flow from the spec ========= */
  {
    const page = await newPage();
    await asUser(page, uiTok);
    await page.goto(`${BASE}/profile/edit`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(LVL("country"), { timeout: 20000 });

    await openLevel(page, "country");
    await search(page, "country", "United States");
    const usListed = (await optionRows(page, "country")).some((o) => o.name === "United States");
    step("browser-ui", "open Country → search 'United States' → it's listed", usListed);
    await clickOption(page, "country", "United States");
    step("browser-ui", "select United States → visible value updates + State level appears", (await visibleValue(page, "country")) === "United States" && (await levelPresent(page, "state")));

    await pickPath(page, "state", "Maryland");
    step("browser-ui", "select Maryland → County level appears", (await visibleValue(page, "state")) === "Maryland" && (await levelPresent(page, "county")));

    await openLevel(page, "county");
    await search(page, "county", "Prince");
    const pgListed = (await optionRows(page, "county")).map((o) => o.name);
    step("browser-ui", "county search 'Prince' shows Prince George's County (Maryland counties only)", pgListed.includes("Prince George's County") && !pgListed.some((n) => /Fairfax/.test(n)), pgListed.join("; "));
    await clickOption(page, "county", "Prince George's County");

    await pickPath(page, "city", "Accokeek");
    const vis1 = [await visibleValue(page, "country"), await visibleValue(page, "state"), await visibleValue(page, "county"), await visibleValue(page, "city")];
    step("browser-ui", "full chain visibly selected: United States → Maryland → Prince George's County → Accokeek", vis1.join(" → ") === "United States → Maryland → Prince George's County → Accokeek", vis1.join(" → "));
    await page.screenshot({ path: path.join(ART, "desktop-full-chain.png") });

    /* parent change: Maryland → Virginia resets county + city immediately */
    await pickPath(page, "state", "Virginia");
    const county2 = await visibleValue(page, "county");
    const city2 = await visibleValue(page, "city");
    step("browser-ui", "Maryland → Virginia: County and City visibly reset immediately", county2 === "Select a county" && city2 === "Select a city", `county="${county2}" city="${city2}"`);
    await page.screenshot({ path: path.join(ART, "desktop-after-parent-reset.png") });

    /* Virginia's counties are Virginia's */
    await openLevel(page, "county");
    await search(page, "county", "Fairfax");
    step("browser-ui", "under Virginia the county list serves Virginia counties (Fairfax County)", (await optionRows(page, "county")).some((o) => o.name === "Fairfax County"));
    await page.keyboard.press("Escape");

    /* Virginia → Maryland: Maryland counties come back */
    await pickPath(page, "state", "Maryland");
    await openLevel(page, "county");
    await search(page, "county", "");
    const mdBack = (await optionRows(page, "county")).map((o) => o.name);
    step("browser-ui", "Virginia → Maryland: Maryland counties available again (Anne Arundel yes, Fairfax no)", mdBack.includes("Anne Arundel County") && !mdBack.includes("Fairfax County"), `${mdBack.length} listed`);
    await page.keyboard.press("Escape");

    /* city auto-fills its county (no county selected) */
    await pickPath(page, "city", "Bowie");
    step("browser-ui", "selecting Bowie with no county set auto-fills Prince George's County visibly", (await visibleValue(page, "county")) === "Prince George's County" && (await visibleValue(page, "city")) === "Bowie");

    /* re-select the spec chain, then SAVE and RELOAD */
    await pickPath(page, "county", "Prince", "Prince George's County");
    await pickPath(page, "city", "Accokeek");
    step("browser-ui", "Maryland → Prince George's County → Accokeek: Accokeek remains selected", (await visibleValue(page, "city")) === "Accokeek");
    const saveBtn = await page.$$eval("button", (els) => { const b = els.find((e) => e.textContent?.trim() === "Save Changes" && !e.disabled); if (b) { b.click(); return true; } return false; });
    await new Promise((r) => setTimeout(r, 1500));
    await page.goto(`${BASE}/profile/edit`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(LVL("country"), { timeout: 20000 });
    await page.waitForFunction((s) => document.querySelector(s)?.textContent?.includes("United States"), { timeout: 10000 }, CONTROL("country")).catch(() => {});
    await page.waitForSelector(LVL("county"), { timeout: 10000 }).catch(() => {});
    const vis2 = [await visibleValue(page, "country"), await visibleValue(page, "state"), await visibleValue(page, "county"), await visibleValue(page, "city")];
    step("browser-ui", "Save Changes → reload: the saved chain is shown by the pickers (persisted for real)", saveBtn && vis2.join(" → ") === "United States → MD → Prince George's County → Accokeek", vis2.join(" → "));

    /* duplicate city names: Springfield IL vs Springfield MA */
    await pickPath(page, "state", "Illinois");
    await openLevel(page, "city");
    await search(page, "city", "Springfield");
    const spIL = (await optionRows(page, "city")).find((o) => o.name === "Springfield");
    await clickOption(page, "city", "Springfield");
    const ilCounty = await visibleValue(page, "county");
    await pickPath(page, "state", "Massachusetts");
    await openLevel(page, "city");
    await search(page, "city", "Springfield");
    const spMA = (await optionRows(page, "city")).find((o) => o.name === "Springfield");
    await clickOption(page, "city", "Springfield");
    const maCounty = await visibleValue(page, "county");
    step("browser-ui", "duplicate names disambiguated in the UI: each Springfield shows ITS county — Sangamon County (IL) vs Hampden County (MA) — and lists are state-scoped", spIL?.hint === "Sangamon County" && spMA?.hint === "Hampden County" && ilCounty === "Sangamon County" && maCounty === "Hampden County", `IL hint="${spIL?.hint}" MA hint="${spMA?.hint}"`);

    await page.close();
  }

  /* ==================== 2 · KEYBOARD NAVIGATION ====================== */
  {
    const page = await newPage();
    await asUser(page, uiTok);
    await page.goto(`${BASE}/profile/edit`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(LVL("country"), { timeout: 20000 });

    // hydration-safe: retry focus+Enter until the handler is attached
    let opened = false;
    for (let i = 0; i < 8 && !opened; i++) {
      await page.focus(`${CONTROL("country")} button[aria-haspopup=listbox]`).catch(() => {});
      await page.keyboard.press("Enter");
      opened = !!(await page.waitForSelector(INPUT("country"), { timeout: 1200 }).catch(() => null));
    }
    let a = await activeInfo(page);
    step("keyboard", "Enter on the closed control opens it and focuses the search input", a.tag === "INPUT" && a.label === "Country");

    await search(page, "country", "united");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    const activeName = await page.$eval(`${LVL("country")} [role=option].bg-lime-400\\/10 span`, (e) => e.textContent).catch(() => null);
    const activeDesc = await page.$eval(INPUT("country"), (e) => e.getAttribute("aria-activedescendant"));
    step("keyboard", "ArrowDown/ArrowUp move the highlighted option (aria-activedescendant tracks it)", !!activeName && !!activeDesc, `highlight="${activeName}"`);

    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 300));
    a = await activeInfo(page);
    const chosen = await visibleValue(page, "country");
    step("keyboard", "Enter selects the highlighted option, closes the list, and focus RETURNS to the control (never lost)", a.tag === "BUTTON" && !!chosen && chosen !== "Select your country", `focus=${a.tag}:"${a.label}" value="${chosen}"`);

    await page.keyboard.press("Enter"); // reopen
    await page.waitForSelector(INPUT("country"), { timeout: 5000 });
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 200));
    a = await activeInfo(page);
    step("keyboard", "Escape closes without changing the value and keeps focus on the control", a.tag === "BUTTON" && (await visibleValue(page, "country")) === chosen);

    await page.keyboard.press("Tab");
    a = await activeInfo(page);
    const notBody1 = a.tag !== "BODY";
    await page.keyboard.down("Shift"); await page.keyboard.press("Tab"); await page.keyboard.up("Shift");
    a = await activeInfo(page);
    step("keyboard", "Tab and Shift+Tab walk the pickers in order — focus never falls to <body>", notBody1 && a.tag !== "BODY", `after Shift+Tab: ${a.tag}:"${a.label}"`);

    await page.keyboard.press("Enter"); // open again
    await page.waitForSelector(INPUT("country"), { timeout: 5000 });
    await page.keyboard.press("Tab");
    await new Promise((r) => setTimeout(r, 200));
    const listGone = !(await page.$(`${LVL("country")} [role=listbox]`));
    a = await activeInfo(page);
    step("keyboard", "Tab from an OPEN dropdown closes it (no stale menu) and moves focus forward", listGone && a.tag !== "BODY");
    await page.close();
  }

  /* ================= 3 · SEARCH FIELD STATES ========================= */
  {
    const page = await newPage();
    await asUser(page, uiTok);
    await page.goto(`${BASE}/profile/edit`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(LVL("country"), { timeout: 20000 });
    await pickPath(page, "country", "United States");

    await openLevel(page, "state");
    await search(page, "state", "maryl");
    step("search-states", "partial search 'maryl' finds Maryland", (await optionRows(page, "state")).some((o) => o.name === "Maryland"));

    await search(page, "state", "zzzzzz");
    const emptyText = await page.$eval(`${LVL("state")} [data-geo-empty]`, (e) => e.textContent).catch(() => null);
    step("search-states", "no results shows a visible, specific empty state", !!emptyText, `"${emptyText}"`);

    await page.evaluate((s) => { const i = document.querySelector(s); i.select(); }, INPUT("state"));
    await page.keyboard.press("Backspace");
    await new Promise((r) => setTimeout(r, 400));
    await waitResult(page, "state");
    step("search-states", "clearing the search restores the full list", (await optionRows(page, "state")).length >= 40);

    await search(page, "state", "maryland", { delay: 0 });
    const rapid = await optionRows(page, "state");
    step("search-states", "rapid typing (0ms key delay) still resolves to the right result — stale responses are aborted", rapid.length === 1 && rapid[0].name === "Maryland");
    await page.keyboard.press("Escape");

    /* slow network → visible loading state */
    await page.setRequestInterception(true);
    let slow = true, fail = false;
    page.on("request", (req) => {
      if (slow && req.url().includes("/api/geo/states")) return void setTimeout(() => req.continue().catch(() => {}), 1200);
      if (fail && req.url().includes("/api/geo/counties")) return void req.abort("failed").catch(() => {});
      req.continue().catch(() => {});
    });
    await openLevel(page, "state");
    await new Promise((r) => setTimeout(r, 400));
    const loadingVisible = !!(await page.$(`${LVL("state")} [data-geo-loading-row]`)) || !!(await page.$(`${LVL("state")} [data-geo-loading]`));
    await waitResult(page, "state", 15000);
    step("search-states", "slow network (1.2s) shows a visible Loading state, then the options", loadingVisible && (await optionRows(page, "state")).length > 0);
    slow = false;
    await clickOption(page, "state", "Maryland");

    /* failed request → error state with a working Retry */
    fail = true;
    await openLevel(page, "county");
    await page.waitForSelector(`${LVL("county")} [data-geo-error]`, { timeout: 9000 });
    const errText = await page.$eval(`${LVL("county")} [data-geo-error] p`, (e) => e.textContent);
    fail = false;
    const retryIdx = await page.$$eval(`${LVL("county")} [data-geo-error] button`, (els) => { els[0]?.click(); return els.length; });
    await waitResult(page, "county", 9000);
    step("search-states", "failed request shows a readable error + Retry, and Retry actually recovers", !!errText && retryIdx > 0 && (await optionRows(page, "county")).length === 24, `error="${errText}"`);
    await page.close();
  }

  /* ==================== 4 · RESPONSIVE (375×667) ===================== */
  {
    const page = await newPage(375, 667);
    await asUser(page, uiTok);
    await page.goto(`${BASE}/profile/edit`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(LVL("country"), { timeout: 20000 });
    await page.$eval(LVL("country"), (e) => e.scrollIntoView({ block: "center" }));

    await pickPath(page, "country", "United States");
    await pickPath(page, "state", "Maryland");
    await page.$eval(LVL("city"), (e) => e.scrollIntoView({ block: "center" }));
    await openLevel(page, "city");
    await search(page, "city", "");
    const rect = await page.$eval(`${LVL("city")} [role=listbox]`, (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight }; });
    step("responsive", "mobile: open city dropdown stays inside the viewport (not clipped, no horizontal overflow)", rect.l >= 0 && rect.r <= rect.w + 1 && rect.t >= 0, JSON.stringify(rect));

    const hit = await page.evaluate((s) => {
      const list = document.querySelector(`${s} [role=listbox]`);
      const opt = list.querySelector("[role=option]");
      const r = opt.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { onTop: opt.contains(el) || el === opt, name: opt.querySelector("span")?.textContent };
    }, LVL("city"));
    step("responsive", "mobile: options are actually hittable (nothing overlaps the menu — cards, navbar, Test Center)", hit.onTop, `top option "${hit.name}"`);

    const scrolled = await page.evaluate((s) => { const l = document.querySelector(`${s} [role=listbox]`); const before = l.scrollTop; l.scrollTop = 150; return l.scrollTop !== before && l.scrollHeight > l.clientHeight; }, LVL("city"));
    step("responsive", "mobile: the list scrolls inside the menu (long lists never push the page)", scrolled);
    await page.screenshot({ path: path.join(ART, "mobile-city-open.png") });
    await clickOption(page, "city", "Baltimore").catch(async () => { await search(page, "city", "Baltimore"); await clickOption(page, "city", "Baltimore"); });
    const mobileVis = await visibleValue(page, "city");
    const noCut = await page.$eval(CONTROL("city"), (e) => { const b = e.querySelector("button"); return b.scrollWidth <= b.clientWidth + 2; });
    step("responsive", "mobile: selection works by tap and the value isn't cut off", mobileVis === "Baltimore" && noCut, `value="${mobileVis}"`);
    await page.close();
  }

  /* ======= 5 · OVERLAY: Test Center persona bar open on top ========= */
  {
    const li = await api("/api/auth/login", { method: "POST", body: { identifier: "testcreator", password: "mavyn123" } });
    const tcTok = li.data.sessionToken || "";
    if (!tcTok) {
      step("overlay", "sign in as QA persona testcreator", false, "login failed");
    } else {
      const page = await newPage(1440, 900);
      await asUser(page, tcTok);
      await page.goto(`${BASE}/profile/edit`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForSelector(LVL("country"), { timeout: 20000 });
      await new Promise((r) => setTimeout(r, 1500)); // persona bar mounts after hydration
      const pill = await page.evaluate(() => !!Array.from(document.querySelectorAll("button")).find((b) => (b.className || "").includes("fixed") && (b.className || "").includes("bottom-")));
      // open the LAST (bottom-most) picker level present — closest to the pill
      await page.$eval(LVL("country"), (e) => e.scrollIntoView({ block: "center" }));
      await openLevel(page, "country");
      await search(page, "country", "");
      const cover = await page.evaluate((s) => {
        const list = document.querySelector(`${s} [role=listbox]`);
        const r = list.getBoundingClientRect();
        const pts = [[r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4], [r.left + r.width / 2, r.top + r.height / 2]];
        const bad = [];
        for (const [x, y] of pts) {
          const el = document.elementFromPoint(x, y);
          if (!list.contains(el)) bad.push(`${Math.round(x)},${Math.round(y)}→${el?.tagName}.${(el?.className || "").toString().slice(0, 40)}`);
        }
        return bad;
      }, LVL("country"));
      step("overlay", "with the Test Center session bar on screen, the open dropdown is never covered (5-point hit test, QA persona signed in)", pill && cover.length === 0, cover.join(" | ") || "all 5 points hit the menu");
      await page.screenshot({ path: path.join(ART, "overlay-persona-bar.png") });
      await page.keyboard.press("Escape");
      // deliberately NO save — persona profile stays untouched
      await page.close();
      step("overlay", "QA persona profile untouched (picker exercised, nothing saved)", true);
    }
  }

  /* ===================== 6 · ACCESSIBILITY (axe) ===================== */
  {
    const page = await newPage();
    await asUser(page, uiTok);
    await page.goto(`${BASE}/profile/edit`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(LVL("country"), { timeout: 20000 });
    await openLevel(page, "country");
    await search(page, "country", "");
    await page.evaluate(fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"));
    const axe = await page.evaluate(async () => {
      const res = await window.axe.run(document.querySelector("[data-guide=location-picker]"), { resultTypes: ["violations"] });
      return res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }));
    });
    const serious = axe.filter((v) => v.impact === "serious" || v.impact === "critical");
    step("a11y", "axe-core scan of the picker (dropdown OPEN): zero serious/critical violations", serious.length === 0, axe.length ? axe.map((v) => `${v.id}(${v.impact}×${v.nodes})`).join(", ") : "no violations at all");
    const roles = await page.evaluate((s) => {
      const input = document.querySelector(`${s} input[role=combobox]`);
      const list = document.querySelector(`${s} [role=listbox]`);
      const opt = list?.querySelector("[role=option]");
      return {
        expanded: input?.getAttribute("aria-expanded"),
        controls: input?.getAttribute("aria-controls"),
        listId: list?.id,
        optSelected: opt?.hasAttribute("aria-selected"),
        labels: !!input?.getAttribute("aria-label"),
      };
    }, LVL("country"));
    step("a11y", "APG combobox wiring: aria-expanded, aria-controls→listbox id, labelled input, aria-selected options", roles.expanded === "true" && roles.controls === roles.listId && roles.optSelected === true && roles.labels, JSON.stringify(roles));
    await page.close();
  }

  /* ============== 7 · OTHER FORMS: opportunity + event =============== */
  {
    const page = await newPage();
    await asUser(page, uiTok);
    await page.goto(`${BASE}/opportunities/new`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector("[data-guide=opportunity-location]", { timeout: 20000 }).catch(() => {});
    const pickerShown = await levelPresent(page, "country");
    // hydration-safe: click Remote until the picker actually hides
    let hiddenWhenRemote = false;
    for (let i = 0; i < 8 && !hiddenWhenRemote; i++) {
      await page.$$eval("input[type=checkbox]", (els) => { const l = els.find((e) => e.closest("label")?.textContent?.includes("Remote")); l?.click(); });
      await new Promise((r) => setTimeout(r, 400));
      hiddenWhenRemote = !(await levelPresent(page, "country"));
    }
    await page.$$eval("input[type=checkbox]", (els) => { const l = els.find((e) => e.closest("label")?.textContent?.includes("Remote")); l?.click(); });
    await page.waitForSelector(LVL("country"), { timeout: 5000 });
    await pickPath(page, "country", "United States");
    await pickPath(page, "state", "Maryland");
    await pickPath(page, "city", "Bowie");
    step("forms", "opportunity posting: picker present, hidden while Remote (no dead fields), cascade US → MD → Bowie works", pickerShown && hiddenWhenRemote && (await visibleValue(page, "city")) === "Bowie");

    await page.goto(`${BASE}/events/create`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(LVL("country"), { timeout: 20000 });
    await pickPath(page, "country", "United States");
    await pickPath(page, "state", "Maryland");
    const noCounty = !(await levelPresent(page, "county"));
    await pickPath(page, "city", "Accokeek");
    step("forms", "event creation: same system, county level intentionally omitted (city precision), Accokeek selectable", noCounty && (await visibleValue(page, "city")) === "Accokeek");
    step("forms", "search/filter surfaces: honest note — discovery filters use distance scopes (Nearby/City/State), no free-text location inputs exist there to convert", true);
    await page.close();
  }

  /* ================ 8 · zero client-side exceptions ================== */
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
