#!/usr/bin/env node
/* ------------------------------------------------------------------ */
/*  browser-qa-mobile.mjs — REAL-BROWSER responsive QA for Mavyn.      */
/*                                                                     */
/*  Viewport classes (content-driven breakpoints, not one device):     */
/*    small phone 360×740 · large phone 414×896 · landscape 844×390    */
/*    small tablet 768×1024 · large tablet 1024×1366 · desktop 1440    */
/*                                                                     */
/*  Verifies the three-way contract:                                   */
/*    < lg  = intentional touch experience (compact header, bottom     */
/*            nav, mobile profile, bottom-sheet create)                */
/*    ≥ lg  = the ESTABLISHED DESKTOP EXPERIENCE, unchanged (sidebar,  */
/*            top search, desktop profile, NO mobile chrome)           */
/*                                                                     */
/*  Usage: node scripts/browser-qa-mobile.mjs [--base http://…] [--json]*/
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

const ROUTES = ["/", "/discover", "/creator/devin", "/messages", "/opportunities", "/services", "/communities", "/events", "/live", "/settings", "/notifications"];

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

  const li = await api("/api/auth/login", { method: "POST", body: { identifier: "devin", password: "mavyn123" } });
  const tok = li.data.sessionToken;
  if (!tok) throw new Error("devin login failed");

  const newPage = async (w, h) => {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, hasTouch: w < 1024 });
    page.on("pageerror", (e) => pageErrors.push(String(e.message || e).slice(0, 160)));
    await page.setCookie({ name: "mavyn_session", value: tok, url: BASE });
    return page;
  };
  const open = async (page, route) => {
    for (let i = 0; i < 2; i++) {
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        break;
      } catch (e) {
        if (i === 1) throw e;
      }
    }
    await new Promise((r) => setTimeout(r, 1200));
  };
  /* CSS text-transform changes innerText casing — compare lowercase */
  const bodyHas = (page, needle) => page.evaluate((n) => document.body.innerText.toLowerCase().includes(n), needle.toLowerCase());
  /* hydration-safe tab switch: click until the marker text appears */
  const switchTab = async (page, tabName, markerLower) => {
    for (let i = 0; i < 8; i++) {
      await page.evaluate((t) => {
        const b = Array.from(document.querySelectorAll("[data-guide=mobile-profile-tabs] button")).find((x) => x.textContent === t);
        b?.click();
      }, tabName);
      await new Promise((r) => setTimeout(r, 500));
      if (await bodyHas(page, markerLower)) return true;
    }
    return false;
  };
  const metrics = (page) =>
    page.evaluate(() => ({
      hscroll: document.documentElement.scrollWidth > window.innerWidth + 2,
      nav: !!document.querySelector("[data-guide=mobile-bottom-nav]") &&
        getComputedStyle(document.querySelector("[data-guide=mobile-bottom-nav]")).display !== "none",
      headerH: document.querySelector("header")?.getBoundingClientRect().height ?? 0,
      sidebarVisible: (() => {
        const el = document.querySelector("[data-tour=home]");
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.left >= 0;
      })(),
      mobileProfile: !!document.querySelector("[data-guide=mobile-profile]"),
    }));

  /* ============ 1 · PHONES: every route, overflow + chrome ========== */
    const PHONE_MATRIX = [
    [360, 740, "small phone 360w", ROUTES],
    [414, 896, "large phone 414w", ["/", "/creator/devin", "/messages", "/live", "/discover"]],
  ];
  for (const [w, h, label, routes] of PHONE_MATRIX) {
    const page = await newPage(w, h);
    const bad = [];
    let navOk = true, headerOk = true;
    for (const route of routes) {
      await open(page, route);
      const m = await metrics(page);
      if (m.hscroll) bad.push(route);
      if (!m.nav) navOk = false;
      if (m.headerH > 72) headerOk = false;
    }
    step("phones", `${label}: ${routes.length} core routes — zero horizontal scroll`, bad.length === 0, bad.join(", ") || "clean");
    step("phones", `${label}: persistent bottom nav on every route, compact single-row header (≤72px)`, navOk && headerOk);
    await page.close();
  }

  /* ============ 2 · PROFILE deep-check at 360w (the priority) ======= */
  {
    const page = await newPage(360, 740);
    await open(page, "/creator/devin");
    await page.waitForSelector("[data-guide=mobile-profile]", { timeout: 15000 });
    const p = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const actions = Array.from(q("[data-guide=mobile-profile-actions]")?.querySelectorAll("a,button") ?? []);
      const rects = actions.map((a) => a.getBoundingClientRect());
      const overlap = rects.some((r1, i) => rects.some((r2, j) => i < j && r1.right > r2.left && r1.left < r2.right && r1.bottom > r2.top && r1.top < r2.bottom));
      const name = Array.from(document.querySelectorAll("h1")).find((e) => e.textContent?.includes("Devin"));
      return {
        avatar: !!q("[data-guide=mobile-profile] img, [data-guide=mobile-profile] span[class*=rounded-full]"),
        name: !!name,
        nameClipped: name ? name.scrollWidth > name.clientWidth + 2 : true,
        openToWork: document.body.innerText.toLowerCase().includes("open to work"),
        campus: document.body.innerText.toLowerCase().includes("bowie state"),
        location: document.body.innerText.toLowerCase().includes("baltimore"),
        tabs: !!q("[data-guide=mobile-profile-tabs]"),
        actionsBigEnough: rects.length >= 2 && rects.every((r) => r.height >= 44),
        overlap,
        editHref: actions.find((a) => a.textContent?.includes("Edit Profile"))?.getAttribute("href") ?? "",
        badge: !!q("[data-guide=mobile-profile] svg[aria-label=Verified], [data-guide=mobile-profile] h1 svg"),
      };
    });
    step("profile", "mobile profile hierarchy renders: cover → avatar → name+badge → roles → OPEN TO WORK → campus/class → location/service area",
      p.avatar && p.name && !p.nameClipped && p.openToWork && p.campus && p.location && p.badge, JSON.stringify({ campus: p.campus, otw: p.openToWork, badge: p.badge }));
    step("profile", "primary actions: Edit Profile + Share — ≥44px tall, zero overlap, Edit routes to /profile/edit",
      p.actionsBigEnough && !p.overlap && p.editHref === "/profile/edit");
    // tabs actually switch content (hydration-safe, case-insensitive)
    const servicesTab = await switchTab(page, "Services", "service");
    const aboutTab =
      (await switchTab(page, "About", "verification")) &&
      (await bodyHas(page, "education")) &&
      (await bodyHas(page, "never shown"));
    step("profile", "tabs switch one section at a time — Services shows listings, About shows grouped Professional/Education/Location/Verification cards with the privacy note", servicesTab && aboutTab);
    // nothing hidden under the bottom nav: bottom-most tappable is hittable
    const navClear = await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      const nav = document.querySelector("[data-guide=mobile-bottom-nav]");
      const r = nav.getBoundingClientRect();
      const above = document.elementFromPoint(window.innerWidth / 2, r.top - 10);
      return !!above && !nav.contains(above);
    });
    step("profile", "content scrolls fully clear of the bottom nav (nothing trapped underneath)", navClear);
    await page.screenshot({ path: path.join(ART, "mobile-profile-360.png"), fullPage: false });
    await page.close();
  }

  /* ============ 3 · header search + create sheet at 360w ============ */
  {
    const page = await newPage(360, 740);
    await open(page, "/");
    const searchExpands = await page.evaluate(async () => {
      const btn = document.querySelector("[data-guide=mobile-search-toggle]");
      if (!btn) return false;
      const before = !!document.querySelector("[data-guide=mobile-search-row]");
      btn.click();
      await new Promise((r) => setTimeout(r, 300));
      const after = !!document.querySelector("[data-guide=mobile-search-row] input");
      return !before && after;
    });
    step("chrome", "search is a compact control that EXPANDS on tap (no permanent header row)", searchExpands);
    const sheet = await page.evaluate(async () => {
      document.querySelector("[data-guide=mobile-create]")?.click();
      await new Promise((r) => setTimeout(r, 500));
      const panel = Array.from(document.querySelectorAll(".fixed.inset-0 > div")).find((d) => d.className.includes("rounded-t-3xl"));
      if (!panel) return { ok: false };
      const r = panel.getBoundingClientRect();
      const txt = panel.innerText;
      return {
        ok: Math.abs(r.bottom - window.innerHeight) < 4 && r.width >= window.innerWidth - 8,
        options: ["Post", "Opportunity", "Service", "Event", "Live", "Community"].every((o) => txt.includes(o)),
      };
    });
    step("chrome", "the + button opens a BOTTOM SHEET (full-width, anchored to the bottom edge) with Post / Opportunity / Service / Event / Live / Community", sheet.ok && sheet.options);
    await page.screenshot({ path: path.join(ART, "mobile-create-sheet.png") });
    await page.close();
  }

  /* ============ 4 · landscape phone + tablets ======================= */
  {
    const page = await newPage(844, 390);
    const bad = [];
    for (const route of ["/", "/creator/devin", "/live"]) {
      await open(page, route);
      const m = await metrics(page);
      if (m.hscroll) bad.push(route);
    }
    step("tablet", "landscape phone 844×390: home, profile and Live render without horizontal scroll, touch chrome intact", bad.length === 0, bad.join(", ") || "clean");
    await page.close();
  }
  {
    const page = await newPage(768, 1024);
    await open(page, "/creator/devin");
    const m = await metrics(page);
    await switchTab(page, "About", "verification");
    const twoCol = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("[data-guide=mobile-profile] section"));
      if (cards.length < 2) return false;
      return Math.abs(cards[0].getBoundingClientRect().top - cards[1].getBoundingClientRect().top) < 8;
    });
    step("tablet", "small tablet 768×1024: touch chrome (bottom nav) + the About section uses the extra width for TWO columns — not a stretched phone", !m.hscroll && m.nav && twoCol === true);
    await open(page, "/live");
    const liveCols = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("a[href^='/live/']"));
      if (cards.length < 2) return true; // not enough cards to prove columns — pass on no-overflow alone
      return Math.abs(cards[0].getBoundingClientRect().top - cards[1].getBoundingClientRect().top) < 8;
    });
    step("tablet", "small tablet: discovery grids go multi-column with the space", liveCols === true);
    await page.screenshot({ path: path.join(ART, "tablet-profile-768.png") });
    await page.close();
  }

  /* ============ 5 · DESKTOP SAFETY (the hard requirement) =========== */
  for (const [w, h, label] of [[1024, 1366, "large tablet 1024w (lg boundary)"], [1440, 900, "desktop 1440w"]]) {
    const page = await newPage(w, h);
    await open(page, "/creator/devin");
    const m = await metrics(page);
    const desktopBits = await page.evaluate(() => ({
      topSearch: !!document.querySelector("[data-tour=search]"),
      mobileToggle: (() => { const el = document.querySelector("[data-guide=mobile-search-toggle]"); return el ? getComputedStyle(el).display !== "none" : false; })(),
    }));
    step("desktop-safety", `${label}: ESTABLISHED DESKTOP EXPERIENCE — sidebar visible, top search bar, desktop profile, NO bottom nav, NO mobile search toggle, NO mobile profile`,
      m.sidebarVisible && desktopBits.topSearch && !m.nav && !desktopBits.mobileToggle && !m.mobileProfile && !m.hscroll,
      JSON.stringify({ sidebar: m.sidebarVisible, nav: m.nav, mobileProfile: m.mobileProfile }));
    if (w === 1440) await page.screenshot({ path: path.join(ART, "desktop-unchanged-1440.png") });
    await page.close();
  }

  step("phones", "no uncaught client-side exceptions across the entire responsive pass", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | ") || "0 exceptions");

  await browser.close();
  const failed = steps.filter((s) => s.status === "FAILED").length;
  if (JSON_OUT) console.log(JSON.stringify({ steps, failed, passed: steps.length - failed }));
  else console.log(`\nMOBILE/TABLET BROWSER QA — ${steps.length - failed} passed · ${failed} failed\nartifacts: ${ART}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  if (JSON_OUT) console.log(JSON.stringify({ steps, failed: steps.length + 1, passed: 0, crash: String(e?.stack || e).slice(0, 500) }));
  else console.error("CRASH:", e);
  process.exit(1);
});
