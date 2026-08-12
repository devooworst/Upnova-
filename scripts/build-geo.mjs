/* ------------------------------------------------------------------ */
/*  build-geo.mjs — compiles db/geo.db, Mavyn's normalized geographic  */
/*  reference database (read-only at runtime).                         */
/*                                                                     */
/*  Hierarchy:  country → state/province → county/district → city     */
/*                                                                     */
/*  Sources (npm data packages, devDependencies — NOT shipped to the   */
/*  browser; the runtime reads only the compiled SQLite file):         */
/*    • country-state-city        — worldwide countries, states (ISO   */
/*      3166-2 codes + names) and non-US cities linked to states       */
/*    • cities-1000-structured    — the raw GeoNames cities1000 dump;  */
/*      every US city carries its admin1 (state) AND admin2 (county    */
/*      FIPS) parent codes, which country-state-city lacks             */
/*    • @nickgraffis/us-counties  — USDA/Census county table: FIPS →   */
/*      name → state for all 3,221 US county-equivalents               */
/*                                                                     */
/*  Why compile instead of importing the packages at runtime:          */
/*    – ~47 MB of JS data would otherwise sit in server memory         */
/*    – search/filter endpoints need indexed, lazy queries             */
/*    – every child row must carry a verified parent id so the server  */
/*      can REJECT invalid combinations (Fairfax under Maryland, etc.) */
/*                                                                     */
/*  County coverage note (honest): full county/district data is        */
/*  currently compiled for the UNITED STATES. The schema is worldwide  */
/*  (geo_counties.country_code) — other countries plug in when their   */
/*  admin2 tables are added. Countries without county data simply      */
/*  don't show the level (per spec: never show a fake County field).   */
/*                                                                     */
/*  Usage:  npm run geo:build   (also runs automatically via db:seed)  */
/* ------------------------------------------------------------------ */
import Database from "better-sqlite3";
import { readFileSync, existsSync, rmSync } from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const OUT = path.join(process.cwd(), "db", "geo.db");

if (process.argv.includes("--if-missing") && existsSync(OUT)) {
  console.log("[geo] db/geo.db already compiled — skipping (force with: npm run geo:build)");
  process.exit(0);
}

const t0 = Date.now();
console.log("[geo] compiling", OUT);

/* ------------------------- load source data ------------------------ */
const { Country, State, City } = require("country-state-city");
const usCounties = require("@nickgraffis/us-counties");
const citiesTxt = readFileSync(
  path.join(process.cwd(), "node_modules", "cities-1000-structured", "dist", "cities1000.txt"),
  "utf8"
);

/* ---------------------- per-country level labels -------------------- */
/* What the "state" level is CALLED in each country. Default:
   "State / Province". Curated — display only, never used for joins.   */
const STATE_LABELS = {
  US: "State", AU: "State", IN: "State", BR: "State", MX: "State", DE: "State", MY: "State", NG: "State", AT: "State",
  CA: "Province", CN: "Province", ZA: "Province", NL: "Province", BE: "Province", AR: "Province", ID: "Province",
  PK: "Province", PH: "Province", VN: "Province", TH: "Province", TR: "Province", IR: "Province", CU: "Province",
  EC: "Province", KH: "Province", LA: "Province", CR: "Province", PA: "Province", DO: "Province", KR: "Province",
  JP: "Prefecture",
  FR: "Region", IT: "Region", CL: "Region", PE: "Region", GR: "Region", NZ: "Region", GH: "Region", PT: "District",
  CO: "Department", UY: "Department", PY: "Department", SV: "Department", HN: "Department", NI: "Department", GT: "Department",
  EG: "Governorate", IQ: "Governorate", JO: "Governorate", KW: "Governorate", LB: "Governorate", OM: "Governorate",
  SY: "Governorate", TN: "Governorate", YE: "Governorate", BH: "Governorate",
  IE: "County", KE: "County", NO: "County", SE: "County",
  CH: "Canton", AE: "Emirate", GB: "Region / Nation", RU: "Federal subject", UA: "Oblast",
};
const COUNTY_LABELS = { US: "County" }; // default "County / District"

/* ----------------------------- schema ------------------------------ */
if (existsSync(OUT)) rmSync(OUT);
const db = new Database(OUT);
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE geo_countries (
  code TEXT PRIMARY KEY,            -- ISO 3166-1 alpha-2
  name TEXT NOT NULL,
  state_label TEXT NOT NULL,        -- what the state level is called here
  county_label TEXT NOT NULL,       -- what the county level is called here
  has_states INTEGER NOT NULL,      -- 0 → the state level is skipped entirely
  has_counties INTEGER NOT NULL     -- 0 → the county level is never shown
);
CREATE TABLE geo_states (
  id TEXT PRIMARY KEY,              -- "<COUNTRY>-<ISOCODE>", e.g. "US-MD"
  country_code TEXT NOT NULL REFERENCES geo_countries(code),
  code TEXT NOT NULL,               -- ISO 3166-2 suffix, e.g. "MD"
  name TEXT NOT NULL,
  has_counties INTEGER NOT NULL,
  city_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE geo_counties (
  id TEXT PRIMARY KEY,              -- "US-24033" (country + FIPS)
  country_code TEXT NOT NULL REFERENCES geo_countries(code),
  state_id TEXT NOT NULL REFERENCES geo_states(id),
  name TEXT NOT NULL,               -- display name, e.g. "Prince George's County"
  city_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE geo_cities (
  id TEXT PRIMARY KEY,              -- "g<geonameid>" (US) or "c<n>" (world)
  country_code TEXT NOT NULL REFERENCES geo_countries(code),
  state_id TEXT REFERENCES geo_states(id),      -- null → country has no states
  county_id TEXT REFERENCES geo_counties(id),   -- null → no county data
  name TEXT NOT NULL,
  population INTEGER NOT NULL DEFAULT 0,
  lat REAL, lng REAL
);
CREATE INDEX idx_states_country ON geo_states(country_code, name);
CREATE INDEX idx_counties_state ON geo_counties(state_id, name);
CREATE INDEX idx_cities_state   ON geo_cities(state_id, name);
CREATE INDEX idx_cities_county  ON geo_cities(county_id, name);
CREATE INDEX idx_cities_country ON geo_cities(country_code, name);
`);

const insCountry = db.prepare("INSERT INTO geo_countries VALUES (?,?,?,?,?,?)");
const insState = db.prepare("INSERT INTO geo_states VALUES (?,?,?,?,?,0)");
const insCounty = db.prepare("INSERT INTO geo_counties VALUES (?,?,?,?,0)");
const insCity = db.prepare("INSERT OR IGNORE INTO geo_cities VALUES (?,?,?,?,?,?,?,?)");

/* --------------------------- 1 · countries -------------------------- */
const countries = Country.getAllCountries();
db.transaction(() => {
  for (const c of countries) {
    const hasStates = State.getStatesOfCountry(c.isoCode).length > 0 ? 1 : 0;
    insCountry.run(
      c.isoCode,
      c.name,
      STATE_LABELS[c.isoCode] || "State / Province",
      COUNTY_LABELS[c.isoCode] || "County / District",
      hasStates,
      c.isoCode === "US" ? 1 : 0
    );
  }
})();
console.log("[geo] countries:", countries.length);

/* ---------------------------- 2 · states ---------------------------- */
let stateCount = 0;
db.transaction(() => {
  for (const c of countries) {
    for (const s of State.getStatesOfCountry(c.isoCode)) {
      insState.run(`${c.isoCode}-${s.isoCode}`, c.isoCode, s.isoCode, s.name, 0);
      stateCount++;
    }
  }
})();
console.log("[geo] states:", stateCount);

/* ------------------------- 3 · US counties -------------------------- */
/* Display-name rules (matches how people actually say them):
   – Louisiana        → "<name> Parish"
   – DC               → name as-is ("District of Columbia")
   – Alaska           → name as-is (boroughs/census areas)
   – independent city → "<name> City" (county FIPS suffix ≥ 510 —
     Baltimore City 24510, all Virginia independent cities, St. Louis
     29510 …) unless the name already ends in "City" (Carson City)
   – everything else  → "<name> County"                                */
function countyDisplayName(name, stateCode, fips) {
  if (stateCode === "DC" || stateCode === "AK") return name;
  if (stateCode === "LA") return `${name} Parish`;
  if (/city$/i.test(name)) return name;
  if (Number(fips.slice(2)) >= 510) return `${name} City`;
  return `${name} County`;
}

const countyRows = usCounties.countiesdata; // array of [fips, {n,s,c}]
let countyCount = 0;
const skippedCounties = [];
db.transaction(() => {
  for (const [fips, v] of countyRows) {
    const stateId = `US-${v.s}`;
    const stateExists = db.prepare("SELECT 1 FROM geo_states WHERE id=?").get(stateId);
    if (!stateExists) { skippedCounties.push(`${fips}/${v.s}`); continue; }
    insCounty.run(`US-${fips}`, "US", stateId, countyDisplayName(v.n, v.s, fips));
    countyCount++;
  }
})();
console.log("[geo] US counties:", countyCount, skippedCounties.length ? `(skipped ${skippedCounties.length}: ${skippedCounties.slice(0, 5).join(",")}…)` : "");

/* -------------------- 4 · US cities (GeoNames) ---------------------- */
/* cities1000 columns: 0 id · 1 name · 4 lat · 5 lng · 7 featureCode ·
   8 country · 10 admin1 · 11 admin2(county FIPS suffix) · 14 population */
const STATE_FIPS = {}; // postal → 2-digit state FIPS prefix, from the county table
for (const [fips, v] of countyRows) if (!STATE_FIPS[v.s]) STATE_FIPS[v.s] = fips.slice(0, 2);

let usCityCount = 0, usCityNoCounty = 0;
db.transaction(() => {
  for (const line of citiesTxt.split("\n")) {
    const col = line.split("\t");
    if (col[8] !== "US" || !col[1]) continue;
    if (col[7] === "PPLQ" || col[7] === "PPLW") continue; // abandoned/destroyed places
    const stateCode = col[10];
    const stateId = stateCode ? `US-${stateCode}` : null;
    if (stateId && !db.prepare("SELECT 1 FROM geo_states WHERE id=?").get(stateId)) continue;
    let countyId = null;
    if (col[11] && STATE_FIPS[stateCode]) {
      const cand = `US-${STATE_FIPS[stateCode]}${col[11]}`;
      if (db.prepare("SELECT 1 FROM geo_counties WHERE id=?").get(cand)) countyId = cand;
      else usCityNoCounty++;
    } else usCityNoCounty++;
    insCity.run(`g${col[0]}`, "US", stateId, countyId, col[1], Number(col[14]) || 0, Number(col[4]) || null, Number(col[5]) || null);
    usCityCount++;
  }
})();
console.log("[geo] US cities:", usCityCount, `(no county link: ${usCityNoCounty})`);

/* ------------------- 5 · world cities (non-US) ---------------------- */
let worldCityCount = 0;
db.transaction(() => {
  for (const c of countries) {
    if (c.isoCode === "US") continue;
    let n = 0;
    for (const city of City.getCitiesOfCountry(c.isoCode) || []) {
      const stateId = city.stateCode ? `${c.isoCode}-${city.stateCode}` : null;
      if (stateId && !db.prepare("SELECT 1 FROM geo_states WHERE id=?").get(stateId)) continue;
      insCity.run(
        `c${c.isoCode}${city.stateCode || ""}${n++}`,
        c.isoCode,
        stateId,
        null,
        city.name,
        0,
        Number(city.latitude) || null,
        Number(city.longitude) || null
      );
      worldCityCount++;
    }
  }
})();
console.log("[geo] world cities:", worldCityCount);

/* --------- 5b · stateless countries: cities from GeoNames ----------- */
/* country-state-city has no city rows for territories without states
   (Aruba, Guam, Cayman Islands…). GeoNames covers them — attach their
   cities directly to the country so the UI can skip the state level.  */
let statelessCityCount = 0;
db.transaction(() => {
  const stateless = db.prepare("SELECT code FROM geo_countries WHERE has_states = 0").all().map((r) => r.code);
  const set = new Set(stateless);
  for (const line of citiesTxt.split("\n")) {
    const col = line.split("\t");
    if (!col[1] || !set.has(col[8])) continue;
    if (col[7] === "PPLQ" || col[7] === "PPLW") continue;
    insCity.run(`g${col[0]}`, col[8], null, null, col[1], Number(col[14]) || 0, Number(col[4]) || null, Number(col[5]) || null);
    statelessCityCount++;
  }
})();
console.log("[geo] stateless-country cities (GeoNames):", statelessCityCount);

/* -------------------------- 6 · rollups ----------------------------- */
db.exec(`
UPDATE geo_counties SET city_count = (SELECT COUNT(*) FROM geo_cities WHERE county_id = geo_counties.id);
UPDATE geo_states SET
  city_count   = (SELECT COUNT(*) FROM geo_cities   WHERE state_id = geo_states.id),
  has_counties = CASE WHEN EXISTS (SELECT 1 FROM geo_counties WHERE state_id = geo_states.id) THEN 1 ELSE 0 END;
UPDATE geo_countries SET has_counties = CASE WHEN EXISTS (SELECT 1 FROM geo_counties WHERE country_code = geo_countries.code) THEN 1 ELSE 0 END;
`);

/* ------------------------- 7 · self-checks -------------------------- */
const md = db.prepare("SELECT name FROM geo_counties WHERE state_id='US-MD' ORDER BY name").all().map((r) => r.name);
const pg = db.prepare("SELECT COUNT(*) n FROM geo_cities WHERE county_id='US-24033'").get().n;
const accokeek = db.prepare("SELECT * FROM geo_cities WHERE name='Accokeek' AND state_id='US-MD'").get();
const fairfax = db.prepare("SELECT state_id FROM geo_counties WHERE id='US-51059'").get();
console.log("[geo] MD counties (" + md.length + "):", md.join(", "));
console.log("[geo] PG County cities:", pg, "| Accokeek:", JSON.stringify(accokeek));
console.log("[geo] Fairfax County lives in:", fairfax?.state_id);
if (md.length !== 24) throw new Error("expected 24 MD county-equivalents");
if (!md.includes("Prince George's County") || !md.includes("Baltimore City") || !md.includes("Baltimore County"))
  throw new Error("MD county display names wrong");
if (!accokeek || accokeek.county_id !== "US-24033") throw new Error("Accokeek must link to Prince George's County");
if (fairfax?.state_id !== "US-VA") throw new Error("Fairfax must live in Virginia");

db.exec("VACUUM");
db.close();
console.log(`[geo] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
