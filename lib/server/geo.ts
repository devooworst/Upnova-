/* ------------------------------------------------------------------ */
/*  Geo — Mavyn's single geographic reference system.                  */
/*                                                                     */
/*  One normalized hierarchy used by every location field on the site: */
/*      country → state/province → county/district → city/locality     */
/*                                                                     */
/*  Every child row carries a verified parent id, so the SERVER can    */
/*  reject invalid combinations (Fairfax County under Maryland, a      */
/*  Prince George's city under Virginia, …) — the frontend cascade is  */
/*  convenience, this file is the enforcement.                         */
/*                                                                     */
/*  Data lives in db/geo.db, compiled by scripts/build-geo.mjs from    */
/*  GeoNames + ISO 3166 datasets (npm devDependencies). Read-only at   */
/*  runtime. Missing file → loud, actionable error.                    */
/* ------------------------------------------------------------------ */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { ApiError } from "@/lib/server/auth";

export interface GeoCountry {
  code: string;
  name: string;
  stateLabel: string;
  countyLabel: string;
  hasStates: boolean;
  hasCounties: boolean;
}
export interface GeoState { id: string; code: string; name: string; hasCounties: boolean; cityCount: number }
export interface GeoCounty { id: string; name: string; cityCount: number }
export interface GeoCity { id: string; name: string; countyId: string | null; countyName: string | null; population: number }

/** A fully validated location chain (all display strings are canonical). */
export interface ResolvedLocation {
  countryCode: string;
  countryName: string;
  stateId: string;
  stateName: string;
  /** short display for "City, ST" strings — ISO code when alphabetic, else full name */
  stateShort: string;
  countyId: string;
  countyName: string;
  cityId: string;
  cityName: string;
  lat: number | null;
  lng: number | null;
}

const GEO_PATH = process.env.GEO_DATABASE_PATH || path.join(process.cwd(), "db", "geo.db");

const globalForGeo = globalThis as unknown as { __mavynGeo?: Database.Database };

function geo(): Database.Database {
  if (globalForGeo.__mavynGeo) return globalForGeo.__mavynGeo;
  if (!fs.existsSync(GEO_PATH)) {
    throw new ApiError(
      503,
      "Location data isn't compiled on this instance yet — run `npm run geo:build` (it builds db/geo.db from the bundled datasets)."
    );
  }
  const db = new Database(GEO_PATH, { readonly: true, fileMustExist: true });
  globalForGeo.__mavynGeo = db;
  return db;
}

/** available (vs. needs `npm run geo:build`) — used by QA preflight */
export function geoReady(): boolean {
  return fs.existsSync(GEO_PATH);
}

const LIMIT = 50;
const like = (q: string) => `%${q.replace(/[%_]/g, " ").trim()}%`;
const prefix = (q: string) => `${q.replace(/[%_]/g, " ").trim()}%`;

/* ------------------------------ search ------------------------------ */

export function searchCountries(q = ""): GeoCountry[] {
  const rows = q
    ? geo()
        .prepare(
          `SELECT * FROM geo_countries WHERE name LIKE ? OR name LIKE ? OR code = ?
           ORDER BY CASE WHEN name LIKE ? THEN 0 ELSE 1 END, name LIMIT ${LIMIT}`
        )
        .all(prefix(q), like(q), q.toUpperCase(), prefix(q))
    : // no query → pinned common picks first, then alphabetical
      geo()
        .prepare(
          `SELECT * FROM geo_countries
           ORDER BY CASE code WHEN 'US' THEN 0 WHEN 'CA' THEN 1 WHEN 'GB' THEN 2 WHEN 'MX' THEN 3 ELSE 4 END, name LIMIT ${LIMIT}`
        )
        .all();
  return (rows as Record<string, unknown>[]).map(countryRow);
}

export function getCountry(code: string): GeoCountry | null {
  const r = geo().prepare("SELECT * FROM geo_countries WHERE code = ?").get(code.toUpperCase());
  return r ? countryRow(r as Record<string, unknown>) : null;
}

function countryRow(r: Record<string, unknown>): GeoCountry {
  return {
    code: r.code as string,
    name: r.name as string,
    stateLabel: r.state_label as string,
    countyLabel: r.county_label as string,
    hasStates: !!r.has_states,
    hasCounties: !!r.has_counties,
  };
}

export function searchStates(countryCode: string, q = ""): GeoState[] {
  const country = getCountry(countryCode);
  if (!country) throw new ApiError(400, "Pick a country first — that country code isn't in the location data.");
  const rows = geo()
    .prepare(
      `SELECT id, code, name, has_counties, city_count FROM geo_states
       WHERE country_code = ? AND (name LIKE ? OR code = ?)
       ORDER BY CASE WHEN name LIKE ? THEN 0 ELSE 1 END, name LIMIT ${LIMIT}`
    )
    .all(country.code, q ? like(q) : "%", q.toUpperCase(), q ? prefix(q) : "%");
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    hasCounties: !!r.has_counties,
    cityCount: r.city_count as number,
  }));
}

export function searchCounties(countryCode: string, stateId: string, q = ""): GeoCounty[] {
  const state = stateOf(countryCode, stateId); // validates the pair
  const rows = geo()
    .prepare(
      `SELECT id, name, city_count FROM geo_counties WHERE state_id = ? AND name LIKE ?
       ORDER BY CASE WHEN name LIKE ? THEN 0 ELSE 1 END, name LIMIT ${LIMIT}`
    )
    .all(state.id, q ? like(q) : "%", q ? prefix(q) : "%");
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    cityCount: r.city_count as number,
  }));
}

export function searchCities(opts: { countryCode: string; stateId?: string; countyId?: string; q?: string }): GeoCity[] {
  const country = getCountry(opts.countryCode);
  if (!country) throw new ApiError(400, "Pick a country first — that country code isn't in the location data.");
  const q = opts.q || "";
  const where: string[] = ["c.country_code = ?"];
  const params: unknown[] = [country.code];
  if (opts.countyId) {
    const county = countyOf(opts.countyId);
    if (opts.stateId && county.state_id !== opts.stateId)
      throw new ApiError(400, `${county.name} isn't in the selected ${country.stateLabel.toLowerCase()} — pick a matching one.`);
    where.push("c.county_id = ?");
    params.push(county.id);
  } else if (opts.stateId) {
    const state = stateOf(country.code, opts.stateId);
    where.push("c.state_id = ?");
    params.push(state.id);
  }
  if (q) {
    where.push("c.name LIKE ?");
    params.push(like(q));
  }
  const rows = geo()
    .prepare(
      `SELECT c.id, c.name, c.population, c.county_id, k.name AS county_name
       FROM geo_cities c LEFT JOIN geo_counties k ON k.id = c.county_id
       WHERE ${where.join(" AND ")}
       ORDER BY ${q ? "CASE WHEN c.name LIKE ? THEN 0 ELSE 1 END," : ""} c.population DESC, c.name LIMIT ${LIMIT}`
    )
    .all(...(q ? [...params, prefix(q)] : params));
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    countyId: (r.county_id as string) || null,
    countyName: (r.county_name as string) || null,
    population: r.population as number,
  }));
}

/* --------------------------- row lookups ---------------------------- */

function stateOf(countryCode: string, stateId: string) {
  const r = geo().prepare("SELECT * FROM geo_states WHERE id = ?").get(stateId) as
    | { id: string; country_code: string; code: string; name: string; has_counties: number }
    | undefined;
  if (!r) throw new ApiError(400, "That state/province isn't in the location data — pick one from the list.");
  if (r.country_code !== countryCode.toUpperCase()) {
    const owner = getCountry(r.country_code);
    throw new ApiError(400, `${r.name} belongs to ${owner?.name || r.country_code}, not the selected country — pick a matching state.`);
  }
  return r;
}

function countyOf(countyId: string) {
  const r = geo().prepare("SELECT * FROM geo_counties WHERE id = ?").get(countyId) as
    | { id: string; country_code: string; state_id: string; name: string }
    | undefined;
  if (!r) throw new ApiError(400, "That county/district isn't in the location data — pick one from the list.");
  return r;
}

/* --------------------------- validation ----------------------------- */

const stateShortOf = (code: string, name: string) => (/^[A-Z]{2,3}$/.test(code) ? code : name);

/**
 * Validate a location chain END TO END and return canonical values.
 * Throws ApiError(400) with a plain-language reason on ANY mismatch —
 * this is what makes "Maryland → Fairfax County" impossible to save,
 * no matter what the client sends.
 *
 * Rules:
 *  – empty countryCode → the whole location is cleared (all-empty result)
 *  – state must belong to the country
 *  – county must belong to the state (only exists where we have data)
 *  – city must belong to the country/state, and to the county when both given
 *  – picking a city auto-fills its county when the county was omitted
 */
export function resolveLocation(input: {
  countryCode?: string | null;
  stateId?: string | null;
  countyId?: string | null;
  cityId?: string | null;
}): ResolvedLocation {
  const empty: ResolvedLocation = {
    countryCode: "", countryName: "", stateId: "", stateName: "", stateShort: "",
    countyId: "", countyName: "", cityId: "", cityName: "", lat: null, lng: null,
  };
  const countryCode = String(input.countryCode || "").trim().toUpperCase();
  if (!countryCode) return empty; // explicit clear

  const country = getCountry(countryCode);
  if (!country) throw new ApiError(400, "That country isn't in the location data — pick one from the list.");

  const out: ResolvedLocation = { ...empty, countryCode: country.code, countryName: country.name };

  let state: ReturnType<typeof stateOf> | null = null;
  if (input.stateId) {
    state = stateOf(country.code, String(input.stateId));
    out.stateId = state.id;
    out.stateName = state.name;
    out.stateShort = stateShortOf(state.code, state.name);
  }

  let county: ReturnType<typeof countyOf> | null = null;
  if (input.countyId) {
    county = countyOf(String(input.countyId));
    if (!state) throw new ApiError(400, `Pick a ${country.stateLabel.toLowerCase()} before picking a ${country.countyLabel.toLowerCase()}.`);
    if (county.state_id !== state.id) {
      const realState = geo().prepare("SELECT name FROM geo_states WHERE id = ?").get(county.state_id) as { name: string } | undefined;
      throw new ApiError(400, `${county.name} is in ${realState?.name || "another state"}, not ${state.name} — that combination can't be saved.`);
    }
    out.countyId = county.id;
    out.countyName = county.name;
  }

  if (input.cityId) {
    const city = geo().prepare("SELECT * FROM geo_cities WHERE id = ?").get(String(input.cityId)) as
      | { id: string; country_code: string; state_id: string | null; county_id: string | null; name: string; lat: number | null; lng: number | null }
      | undefined;
    if (!city) throw new ApiError(400, "That city isn't in the location data — pick one from the list.");
    if (city.country_code !== country.code)
      throw new ApiError(400, `${city.name} isn't in ${country.name} — that combination can't be saved.`);
    if (state && city.state_id && city.state_id !== state.id) {
      const realState = geo().prepare("SELECT name FROM geo_states WHERE id = ?").get(city.state_id) as { name: string } | undefined;
      throw new ApiError(400, `${city.name} is in ${realState?.name || "another state"}, not ${state.name} — that combination can't be saved.`);
    }
    if (county && city.county_id && city.county_id !== county.id) {
      const realCounty = geo().prepare("SELECT name FROM geo_counties WHERE id = ?").get(city.county_id) as { name: string } | undefined;
      throw new ApiError(400, `${city.name} is in ${realCounty?.name || "a different county"}, not ${county.name} — that combination can't be saved.`);
    }
    // a chosen city fills in the levels above it when they were omitted
    if (!state && city.state_id) {
      const s = geo().prepare("SELECT * FROM geo_states WHERE id = ?").get(city.state_id) as
        | { id: string; code: string; name: string }
        | undefined;
      if (s) {
        out.stateId = s.id;
        out.stateName = s.name;
        out.stateShort = stateShortOf(s.code, s.name);
      }
    }
    if (!county && city.county_id) {
      const k = geo().prepare("SELECT id, name FROM geo_counties WHERE id = ?").get(city.county_id) as
        | { id: string; name: string }
        | undefined;
      if (k) {
        out.countyId = k.id;
        out.countyName = k.name;
      }
    }
    out.cityId = city.id;
    out.cityName = city.name;
    out.lat = city.lat;
    out.lng = city.lng;
  }

  return out;
}

/* ------------------------- text normalization ----------------------- */

/**
 * Best-effort mapping of LEGACY free-text location values
 * ("Accokeek" / "Prince George's" / "MD" / "United States") onto the
 * normalized hierarchy. Used by the migration script and the seed —
 * never destructive: unmatched text is left exactly as it was.
 */
export function normalizeLegacyLocation(text: {
  city?: string;
  county?: string;
  state?: string;
  country?: string;
}): ResolvedLocation | null {
  const g = geo();
  const clean = (s?: string) => String(s || "").trim();
  const cityT = clean(text.city);
  const countyT = clean(text.county);
  const stateT = clean(text.state);
  const countryT = clean(text.country);
  if (!cityT && !countyT && !stateT && !countryT) return null;

  // country: name/code match; default to US when the state looks American
  let country: { code: string } | undefined = g
    .prepare("SELECT code FROM geo_countries WHERE code = ? OR name = ? COLLATE NOCASE")
    .get(countryT.toUpperCase(), countryT) as { code: string } | undefined;
  if (!country && /^(usa|u\.s\.a?\.?|america)$/i.test(countryT)) country = { code: "US" };
  if (!country && stateT) {
    const us = g
      .prepare("SELECT id FROM geo_states WHERE country_code='US' AND (code = ? OR name = ? COLLATE NOCASE)")
      .get(stateT.toUpperCase(), stateT);
    if (us) country = { code: "US" };
  }
  if (!country) return null;

  let stateId: string | null = null;
  if (stateT) {
    const s = g
      .prepare("SELECT id FROM geo_states WHERE country_code = ? AND (code = ? OR name = ? COLLATE NOCASE)")
      .get(country.code, stateT.toUpperCase(), stateT) as { id: string } | undefined;
    stateId = s?.id || null;
  }

  let countyId: string | null = null;
  if (countyT && stateId) {
    const wantsCity = /\bcity$/i.test(countyT);
    const base = countyT.replace(/\s+(county|parish|city|borough)$/i, "");
    const cands = g
      .prepare("SELECT id, name FROM geo_counties WHERE state_id = ? AND (name = ? COLLATE NOCASE OR name LIKE ? COLLATE NOCASE)")
      .all(stateId, countyT, `${base}%`) as { id: string; name: string }[];
    const pick =
      cands.find((c) => c.name.toLowerCase() === countyT.toLowerCase()) ||
      (wantsCity ? cands.find((c) => /city$/i.test(c.name)) : cands.find((c) => !/city$/i.test(c.name))) ||
      cands[0];
    countyId = pick?.id || null;
  }

  let cityId: string | null = null;
  if (cityT) {
    const rows = g
      .prepare(
        `SELECT id, county_id FROM geo_cities WHERE country_code = ? AND name = ? COLLATE NOCASE
         ${stateId ? "AND state_id = ?" : ""} ORDER BY population DESC`
      )
      .all(...([country.code, cityT, ...(stateId ? [stateId] : [])] as unknown[])) as { id: string; county_id: string | null }[];
    const pick = (countyId && rows.find((r) => r.county_id === countyId)) || rows[0];
    cityId = pick?.id || null;
    if (pick && countyId && pick.county_id && pick.county_id !== countyId) countyId = pick.county_id; // the city knows best
  }

  try {
    return resolveLocation({ countryCode: country.code, stateId, countyId, cityId });
  } catch {
    // partial text that doesn't chain (e.g. county without state) — try coarser
    try {
      return resolveLocation({ countryCode: country.code, stateId, cityId });
    } catch {
      try {
        return resolveLocation({ countryCode: country.code, stateId });
      } catch {
        return null;
      }
    }
  }
}
