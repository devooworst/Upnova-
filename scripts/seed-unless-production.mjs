#!/usr/bin/env node
/* ------------------------------------------------------------------ */
/*  Build-time seeding dispatcher (used by vercel-build).              */
/*                                                                     */
/*  Preview / development builds  → seed the demo world (Test Center   */
/*  and full-site QA depend on it).                                    */
/*  PRODUCTION builds             → SKIP seeding, loudly and           */
/*  successfully. Demo users carry a public password and include an    */
/*  admin account; they must never be created in a production          */
/*  database. The seed script itself also refuses (defense in depth):  */
/*  this wrapper skips so the BUILD still succeeds.                    */
/* ------------------------------------------------------------------ */
import { spawnSync } from "child_process";

const env = process.env.VERCEL_ENV || "(unset — local/dev)";
const isProduction = process.env.VERCEL_ENV === "production";
const forced = process.env.MAVYN_FORCE_DEMO_IN_PRODUCTION === "1";

if (isProduction && !forced) {
  console.log(`[build] VERCEL_ENV=production → demo seeding SKIPPED (by design).`);
  console.log(`[build] Production ships with an empty user table; accounts come from real signups.`);
  process.exit(0);
}

console.log(`[build] VERCEL_ENV=${env} → seeding the demo world for QA/Test Center.`);
const r = spawnSync("npx", ["tsx", "db/seed.ts"], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
