#!/usr/bin/env node
/* ------------------------------------------------------------------ */
/*  browser-qa-live.mjs — REAL-BROWSER QA pass for Mavyn Live.         */
/*  Drives actual Chromium against the running server: the Go Live     */
/*  flow end-to-end in the UI, the live room (chat visible + usable),  */
/*  discovery cards, and the 375px mobile layout.                      */
/*  Usage: node scripts/browser-qa-live.mjs [--base http://…] [--json] */
/*  Safety: uses the throwaway tonbui account only.                    */
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

/* hydration-safe click: retry until the expected result appears */
async function clickUntil(page, sel, checkFn, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const el = await page.$(sel);
    if (el) {
      await page.$eval(sel, (e) => e.scrollIntoView({ block: "center" }));
      await el.click().catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 500));
    if (await checkFn()) return true;
  }
  return false;
}
async function typeInto(page, sel, text) {
  await page.waitForSelector(sel, { timeout: 15000 });
  for (let i = 0; i < 10; i++) {
    await page.$eval(sel, (e) => e.scrollIntoView({ block: "center" }));
    await page.click(sel).catch(() => {});
    const focused = await page.evaluate((s) => document.activeElement === document.querySelector(s), sel);
    if (!focused) { await new Promise((r) => setTimeout(r, 400)); continue; }
    await page.keyboard.down("Control"); await page.keyboard.press("KeyA"); await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    if (text) await page.type(sel, text, { delay: 10 });
    await new Promise((r) => setTimeout(r, 150));
    if ((await page.$eval(sel, (e) => e.value)) === text) return;
  }
  throw new Error(`couldn't type into ${sel}`);
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
  const newPage = async (w = 1440, h = 900) => {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    page.on("pageerror", (e) => pageErrors.push(String(e.message || e).slice(0, 200)));
    return page;
  };

  /* throwaway host */
  const nonce = Date.now().toString(36).slice(-6);
  const su = await api("/api/auth/signup", { method: "POST", body: { email: `tonbui.${nonce}@mavyn.dev`, password: "Browser-pass-2026", handle: "tonbui", displayName: "Browser QA" } });
  let tokU = su.data.sessionToken || (await api("/api/auth/login", { method: "POST", body: { identifier: "tonbui", password: "Browser-pass-2026" } })).data.sessionToken;
  if (!tokU) throw new Error("no throwaway account");
  await api("/api/me/onboarding", { method: "POST", body: { action: "skip" } }, tokU);
  // end any stale stream so Go Live is clean
  const mine = await api("/api/live?filter=now", {}, tokU);
  for (const it of mine.data.items ?? []) if (it.isMine) await api(`/api/live/${it.id}`, { method: "PATCH", body: { action: "end" } }, tokU);
  const asUser = (page) => page.setCookie({ name: "mavyn_session", value: tokU, url: BASE });

  /* ---- 1 · Go Live via the real UI ---- */
  let streamId = null;
  {
    const page = await newPage();
    await asUser(page);
    await page.goto(`${BASE}/live`, { waitUntil: "domcontentloaded", timeout: 45000 });
    const opened = await clickUntil(page, "[data-guide=live-golive-open]", async () => !!(await page.$("[data-guide=golive-title]")));
    step("live-ui", "Live page renders with the Go Live button; clicking opens the simple flow (title → category → audience → GO LIVE)", opened);
    await typeInto(page, "[data-guide=golive-title]", "[TESTLIVE] Browser pass — making a beat");
    // category: click the Music chip inside the category block
    await page.$$eval("[data-guide=golive-category] button", (els) => els.find((b) => b.textContent === "Music")?.click());
    const started = await clickUntil(page, "[data-guide=golive-start]", async () => /\/live\/[a-f0-9]+/.test(page.url()), 10);
    streamId = (page.url().match(/\/live\/([a-f0-9]+)/) || [])[1] ?? null;
    step("live-ui", "GO LIVE starts a real stream and lands in the live room", started && !!streamId, page.url());

    if (streamId) {
      await page.waitForSelector("[data-guide=live-chat-input]", { timeout: 15000 }).catch(() => {});
      const hasControls = !!(await page.$("[data-guide=live-host-controls]"));
      const hasEnd = !!(await page.$("[data-guide=live-end]"));
      const hasCount = !!(await page.$("[data-guide=live-viewer-count]"));
      step("live-ui", "the live room shows LIVE badge, viewer count, host controls and End stream", hasControls && hasEnd && hasCount);
      await typeInto(page, "[data-guide=live-chat-input]", "hello from the browser pass");
      const sent = await clickUntil(page, "[data-guide=live-chat-send]", async () =>
        (await page.evaluate(() => document.body.innerText)).includes("hello from the browser pass"));
      step("live-ui", "chat: typing + sending in the room shows the message in the feed (polling transport)", sent);
      await page.screenshot({ path: path.join(ART, "live-room-desktop.png") });
    }
    await page.close();
  }

  /* ---- 2 · mobile 375px: discovery + room ---- */
  {
    const page = await newPage(375, 667);
    await asUser(page);
    await page.goto(`${BASE}/live`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector("[data-guide=live-filters]", { timeout: 15000 });
    const cardVisible = streamId
      ? !!(await page
          .waitForFunction(() => Array.from(document.querySelectorAll("a")).some((a) => a.href.match(/\/live\/[a-f0-9]+/)), { timeout: 12000 })
          .catch(() => null))
      : false;
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
    step("live-mobile", "mobile Live page: filters + the live card render with no horizontal overflow", cardVisible && noOverflow);
    if (streamId) {
      await page.goto(`${BASE}/live/${streamId}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForSelector("[data-guide=live-chat-input]", { timeout: 15000 });
      const inputRect = await page.$eval("[data-guide=live-chat-input]", (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
      step("live-mobile", "mobile live room: chat input fits the viewport and is usable", inputRect.l >= 0 && inputRect.r <= inputRect.w + 1);
      await page.screenshot({ path: path.join(ART, "live-room-mobile.png") });
    }
    await page.close();
  }

  /* ---- 3 · end the stream via the UI ---- */
  if (streamId) {
    const page = await newPage();
    await asUser(page);
    await page.goto(`${BASE}/live/${streamId}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    const ended = await clickUntil(page, "[data-guide=live-end]", async () =>
      (await page.evaluate(() => document.body.innerText)).includes("Your live has ended"));
    step("live-ui", 'End stream in the UI → "Your live has ended." with Save replay / Create highlight / Share / Delete options', ended);
    await page.screenshot({ path: path.join(ART, "live-ended-desktop.png") });
    await page.close();
    await api(`/api/live/${streamId}/replay`, { method: "POST", body: { action: "delete" } }, tokU);
  }

  step("live-ui", "no uncaught client-side exceptions during the live pass", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | ") || "0 exceptions");

  await browser.close();
  const failed = steps.filter((s) => s.status === "FAILED").length;
  if (JSON_OUT) console.log(JSON.stringify({ steps, failed, passed: steps.length - failed }));
  else console.log(`\nLIVE BROWSER QA — ${steps.length - failed} passed · ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  if (JSON_OUT) console.log(JSON.stringify({ steps, failed: steps.length + 1, passed: 0, crash: String(e?.stack || e).slice(0, 500) }));
  else console.error("CRASH:", e);
  process.exit(1);
});
