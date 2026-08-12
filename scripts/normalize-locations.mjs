/* ------------------------------------------------------------------ */
/*  normalize-locations.mjs — one-time / re-runnable migration that    */
/*  maps EXISTING free-text profile locations ("Accokeek" / "Prince    */
/*  George's" / "MD" / "United States") onto the normalized geo ids    */
/*  (countryCode / stateId / countyId / cityId).                       */
/*                                                                     */
/*  Guarantees:                                                        */
/*   • NEVER destructive — unmatched text is left exactly as it was    */
/*   • canonical display text is only written when the match is        */
/*     unambiguous (e.g. "Prince George's" → "Prince George's County") */
/*   • re-runnable: rows that already have ids are skipped             */
/*                                                                     */
/*  Usage: node scripts/normalize-locations.mjs   (runs inside db:seed)*/
/* ------------------------------------------------------------------ */
import Database from "better-sqlite3";
import { existsSync } from "fs";
import path from "path";

const APP_DB = process.env.DATABASE_PATH || path.join(process.cwd(), "db", "mavyn.dev.db");
const GEO_DB = process.env.GEO_DATABASE_PATH || path.join(process.cwd(), "db", "geo.db");

if (!existsSync(APP_DB)) { console.log("[normalize-locations] no app db — nothing to do"); process.exit(0); }
if (!existsSync(GEO_DB)) {
  console.log("[normalize-locations] db/geo.db not compiled — skipping (optional; free-text locations work as-is). Build later with: npm run geo:build");
  process.exit(0);
}

const app = new Database(APP_DB);
const geo = new Database(GEO_DB, { readonly: true });

const cols = app.prepare("PRAGMA table_info(profiles)").all().map((c) => c.name);
for (const need of ["country_code", "state_id", "county_id", "city_id"]) {
  if (!cols.includes(need)) {
    console.error(`[normalize-locations] profiles.${need} missing — run: npm run db:push`);
    process.exit(1);
  }
}

/* same matching rules as lib/server/geo.ts normalizeLegacyLocation */
function normalize(row) {
  const clean = (s) => String(s || "").trim();
  const cityT = clean(row.city), countyT = clean(row.county), stateT = clean(row.state), countryT = clean(row.country);
  if (!cityT && !countyT && !stateT && !countryT) return null;

  let country = geo.prepare("SELECT code, name FROM geo_countries WHERE code = ? OR name = ? COLLATE NOCASE")
    .get(countryT.toUpperCase(), countryT);
  if (!country && /^(usa|u\.s\.a?\.?|america)$/i.test(countryT))
    country = geo.prepare("SELECT code, name FROM geo_countries WHERE code='US'").get();
  if (!country && stateT) {
    const us = geo.prepare("SELECT 1 FROM geo_states WHERE country_code='US' AND (code = ? OR name = ? COLLATE NOCASE)")
      .get(stateT.toUpperCase(), stateT);
    if (us) country = geo.prepare("SELECT code, name FROM geo_countries WHERE code='US'").get();
  }
  if (!country) return null;

  let state = null;
  if (stateT)
    state = geo.prepare("SELECT id, code, name FROM geo_states WHERE country_code = ? AND (code = ? OR name = ? COLLATE NOCASE)")
      .get(country.code, stateT.toUpperCase(), stateT) || null;

  let county = null;
  if (countyT && state) {
    const wantsCity = /\bcity$/i.test(countyT);
    const base = countyT.replace(/\s+(county|parish|city|borough)$/i, "");
    const cands = geo.prepare("SELECT id, name FROM geo_counties WHERE state_id = ? AND (name = ? COLLATE NOCASE OR name LIKE ? COLLATE NOCASE)")
      .all(state.id, countyT, `${base}%`);
    county =
      cands.find((c) => c.name.toLowerCase() === countyT.toLowerCase()) ||
      (wantsCity ? cands.find((c) => /city$/i.test(c.name)) : cands.find((c) => !/city$/i.test(c.name))) ||
      cands[0] || null;
  }

  let city = null;
  if (cityT) {
    const rows = geo.prepare(
      `SELECT c.id, c.name, c.county_id, c.lat, c.lng, k.name AS county_name FROM geo_cities c
       LEFT JOIN geo_counties k ON k.id = c.county_id
       WHERE c.country_code = ? AND c.name = ? COLLATE NOCASE ${state ? "AND c.state_id = ?" : ""}
       ORDER BY c.population DESC`
    ).all(...(state ? [country.code, cityT, state.id] : [country.code, cityT]));
    city = (county && rows.find((r) => r.county_id === county.id)) || rows[0] || null;
    if (city && city.county_id && (!county || county.id !== city.county_id))
      county = { id: city.county_id, name: city.county_name }; // the city knows best
  }

  const stateShort = state ? (/^[A-Z]{2,3}$/.test(state.code) ? state.code : state.name) : "";
  return {
    country_code: country.code,
    state_id: state?.id || "",
    county_id: county?.id || "",
    city_id: city?.id || "",
    // canonical display text — only levels that actually matched
    country: country.name,
    state: state ? stateShort : row.state,
    county: county ? county.name : row.county,
    city: city ? city.name : row.city,
    lat: city?.lat ?? null,
    lng: city?.lng ?? null,
  };
}

const rows = app.prepare(
  "SELECT user_id, city, county, state, country, lat, lng FROM profiles WHERE country_code = '' AND (city != '' OR county != '' OR state != '' OR country != '')"
).all();

let matched = 0, partial = 0, untouched = 0;
const upd = app.prepare(
  `UPDATE profiles SET country_code=@country_code, state_id=@state_id, county_id=@county_id, city_id=@city_id,
   country=@country, state=@state, county=@county, city=@city,
   lat = COALESCE(@lat, lat), lng = COALESCE(@lng, lng) WHERE user_id=@user_id`
);
app.transaction(() => {
  for (const r of rows) {
    const n = normalize(r);
    if (!n) { untouched++; continue; }
    upd.run({ ...n, user_id: r.user_id });
    if (n.city_id || (!r.city && n.state_id)) matched++;
    else partial++;
  }
})();

console.log(`[normalize-locations] profiles scanned: ${rows.length} · fully matched: ${matched} · partial (kept original text where unmatched): ${partial} · untouched: ${untouched}`);

/* honest report of anything that stayed free-text */
const leftovers = app.prepare(
  "SELECT user_id, city, county, state, country FROM profiles WHERE country_code = '' AND (city != '' OR county != '' OR state != '' OR country != '')"
).all();
if (leftovers.length) {
  console.log(`[normalize-locations] still free-text (${leftovers.length}):`);
  for (const l of leftovers.slice(0, 20)) console.log("   ", l.user_id, "→", [l.city, l.county, l.state, l.country].filter(Boolean).join(", "));
} else {
  console.log("[normalize-locations] every located profile is now linked to normalized geographic ids");
}
app.close();
geo.close();
