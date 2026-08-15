"use client";

/* ------------------------------------------------------------------ */
/*  LocationPicker — Mavyn's ONE cascading location selector.          */
/*                                                                     */
/*      COUNTRY → STATE/PROVINCE → COUNTY/DISTRICT → CITY/LOCALITY     */
/*                                                                     */
/*  Rules (enforced here AND revalidated server-side):                 */
/*   • options at each level depend on the selection above it          */
/*   • changing a parent CLEARS every child below it — you can never   */
/*     end up with Virginia → Montgomery County (MD) → Bethesda        */
/*   • levels a country doesn't use are HIDDEN, not disabled: no       */
/*     state level → straight to cities; no county data → no County    */
/*     field at all                                                    */
/*   • the level labels adapt to the country (Province, Prefecture,    */
/*     Region, Governorate, …)                                         */
/*   • picking a city auto-fills its county — the fastest path wins    */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useMemo } from "react";
import GeoSelect, { GeoOption } from "@/components/GeoSelect";

export interface GeoLocationValue {
  countryCode: string;
  countryName: string;
  stateId: string;
  stateName: string;
  countyId: string;
  countyName: string;
  cityId: string;
  cityName: string;
  /** level labels for the selected country (defaults until one is picked) */
  stateLabel?: string;
  countyLabel?: string;
  /** level availability for the selected country/state */
  hasStates?: boolean;
  hasCounties?: boolean;
  stateHasCounties?: boolean;
}

export const EMPTY_GEO_LOCATION: GeoLocationValue = {
  countryCode: "",
  countryName: "",
  stateId: "",
  stateName: "",
  countyId: "",
  countyName: "",
  cityId: "",
  cityName: "",
};

async function getJson(url: string, signal: AbortSignal): Promise<{ items: Record<string, unknown>[] }> {
  const res = await fetch(url, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Couldn't load location options");
  return data as { items: Record<string, unknown>[] };
}

export default function LocationPicker({
  value,
  onChange,
  showCounty = true,
  compact,
}: {
  value: GeoLocationValue;
  onChange: (next: GeoLocationValue) => void;
  /** county level matters for profiles; forms that only need city precision can drop it */
  showCounty?: boolean;
  compact?: boolean;
}) {
  const stateLabel = value.stateLabel || "State / Province";
  const countyLabel = value.countyLabel || "County / District";
  const countryHasStates = value.countryCode ? value.hasStates !== false : true;
  // a saved countyId is proof enough that the county level exists — don't
  // hide a real saved value while the country metadata is still loading
  const countryHasCounties = value.countryCode ? value.hasCounties === true || !!value.countyId : false;

  /* rehydrate country metadata (labels + which levels exist) when a
     saved value arrives with ids only — e.g. loading Edit Profile */
  useEffect(() => {
    if (!value.countryCode || value.hasStates !== undefined) return;
    const ctrl = new AbortController();
    fetch(`/api/geo/countries?code=${encodeURIComponent(value.countryCode)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { items?: { name: string; stateLabel: string; countyLabel: string; hasStates: boolean; hasCounties: boolean }[] }) => {
        const c = d.items?.[0];
        if (!c) return;
        onChange({
          ...value,
          countryName: value.countryName || c.name,
          stateLabel: c.stateLabel,
          countyLabel: c.countyLabel,
          hasStates: c.hasStates,
          hasCounties: c.hasCounties,
        });
      })
      .catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.countryCode, value.hasStates]);

  /* ------------------------- option fetchers ------------------------ */
  const fetchCountries = useCallback(async (q: string, signal: AbortSignal): Promise<GeoOption[]> => {
    const data = await getJson(`/api/geo/countries?q=${encodeURIComponent(q)}`, signal);
    return data.items.map((c) => ({
      id: String(c.code),
      name: String(c.name),
      meta: { stateLabel: c.stateLabel, countyLabel: c.countyLabel, hasStates: c.hasStates, hasCounties: c.hasCounties },
    }));
  }, []);

  const fetchStates = useCallback(
    async (q: string, signal: AbortSignal): Promise<GeoOption[]> => {
      const data = await getJson(`/api/geo/states?country=${encodeURIComponent(value.countryCode)}&q=${encodeURIComponent(q)}`, signal);
      return data.items.map((s) => ({
        id: String(s.id),
        name: String(s.name),
        meta: { hasCounties: s.hasCounties },
      }));
    },
    [value.countryCode]
  );

  const fetchCounties = useCallback(
    async (q: string, signal: AbortSignal): Promise<GeoOption[]> => {
      const data = await getJson(
        `/api/geo/counties?country=${encodeURIComponent(value.countryCode)}&state=${encodeURIComponent(value.stateId)}&q=${encodeURIComponent(q)}`,
        signal
      );
      return data.items.map((k) => ({ id: String(k.id), name: String(k.name) }));
    },
    [value.countryCode, value.stateId]
  );

  const fetchCities = useCallback(
    async (q: string, signal: AbortSignal): Promise<GeoOption[]> => {
      const params = new URLSearchParams({ country: value.countryCode, q });
      if (value.stateId) params.set("state", value.stateId);
      if (value.countyId) params.set("county", value.countyId);
      const data = await getJson(`/api/geo/cities?${params}`, signal);
      return data.items.map((c) => ({
        id: String(c.id),
        name: String(c.name),
        hint: c.countyName ? String(c.countyName) : undefined,
        meta: { countyId: c.countyId, countyName: c.countyName },
      }));
    },
    [value.countryCode, value.stateId, value.countyId]
  );

  /* ------------------- cascade: parent change → children reset ------ */
  const setCountry = (o: GeoOption | null) =>
    onChange({
      ...EMPTY_GEO_LOCATION, // state, county, city all RESET
      countryCode: o ? o.id : "",
      countryName: o ? o.name : "",
      stateLabel: o ? String(o.meta?.stateLabel || "") : undefined,
      countyLabel: o ? String(o.meta?.countyLabel || "") : undefined,
      hasStates: o ? !!o.meta?.hasStates : undefined,
      hasCounties: o ? !!o.meta?.hasCounties : undefined,
    });

  const setState = (o: GeoOption | null) =>
    onChange({
      ...value,
      stateId: o ? o.id : "",
      stateName: o ? o.name : "",
      stateHasCounties: o ? !!o.meta?.hasCounties : undefined,
      countyId: "", // RESET
      countyName: "",
      cityId: "", // RESET
      cityName: "",
    });

  const setCounty = (o: GeoOption | null) =>
    onChange({
      ...value,
      countyId: o ? o.id : "",
      countyName: o ? o.name : "",
      cityId: "", // RESET
      cityName: "",
    });

  const setCity = (o: GeoOption | null) =>
    onChange({
      ...value,
      cityId: o ? o.id : "",
      cityName: o ? o.name : "",
      // a city knows its county — auto-fill it (never conflicting: the
      // list was already filtered by the selected county, if any)
      ...(o?.meta?.countyId
        ? { countyId: String(o.meta.countyId), countyName: String(o.meta.countyName || "") }
        : {}),
    });

  const countyVisible =
    showCounty &&
    !!value.countryCode &&
    countryHasCounties &&
    !!value.stateId &&
    // hidden ONLY when we know the state has no county data (never a
    // disabled dead field) — a saved county always keeps it visible
    (value.stateHasCounties !== false || !!value.countyId);

  const grid = useMemo(() => (compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2"), [compact]);

  return (
    <div className={grid} data-guide="location-picker">
      <GeoSelect
        label="Country"
        placeholder="Select your country"
        value={value.countryCode ? { id: value.countryCode, name: value.countryName } : null}
        onChange={setCountry}
        fetchOptions={fetchCountries}
        emptyText="No country matches that search."
        guide="location-country"
      />

      {value.countryCode && countryHasStates && (
        <GeoSelect
          label={stateLabel}
          placeholder={`Select a ${stateLabel.toLowerCase()}`}
          value={value.stateId ? { id: value.stateId, name: value.stateName } : null}
          onChange={setState}
          fetchOptions={fetchStates}
          emptyText={`No ${stateLabel.toLowerCase()} matches that search.`}
          guide="location-state"
        />
      )}

      {countyVisible && (
        <GeoSelect
          label={countyLabel}
          placeholder={`Select a ${countyLabel.toLowerCase().split(" / ")[0]}`}
          value={value.countyId ? { id: value.countyId, name: value.countyName } : null}
          onChange={setCounty}
          fetchOptions={fetchCounties}
          emptyText={`No ${countyLabel.toLowerCase().split(" / ")[0]} matches that search.`}
          hint="Picking a city fills this in automatically."
          guide="location-county"
        />
      )}

      {value.countryCode && (!countryHasStates || value.stateId) && (
        <GeoSelect
          label="City / Locality"
          placeholder="Select a city"
          value={value.cityId ? { id: value.cityId, name: value.cityName } : null}
          onChange={setCity}
          fetchOptions={fetchCities}
          emptyText="No city data for this area yet — your selection above is enough."
          guide="location-city"
        />
      )}
    </div>
  );
}
