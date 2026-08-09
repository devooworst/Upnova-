"use client";

/* ------------------------------------------------------------------ */
/*  /debug/session — DEV-ONLY self-test. Runs the entire session        */
/*  checklist in THE USER'S ACTUAL BROWSER and shows verdicts, so       */
/*  "refresh logged me out" reports become one screenshot with the      */
/*  exact cause. Renders only in demo builds.                           */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, getFallbackToken } from "@/lib/session";

type Check = { name: string; ok: boolean | null; detail: string };

/* Before/after-refresh evidence: "Snapshot & Reload" serializes the
   CURRENT state into the URL hash (immune to storage blocking), reloads
   the browser for real, and the page then renders BEFORE vs AFTER side
   by side — exactly the comparison needed to see which value disappears. */
type Snapshot = {
  at: string;
  me: string;
  meStatus: number | string;
  token: string;
  layers: string;
};

export default function SessionDebugPage() {
  const { user } = useSession();
  const [checks, setChecks] = useState<Check[]>([]);
  const [server, setServer] = useState<Record<string, unknown> | null>(null);
  const [before, setBefore] = useState<Snapshot | null>(null);
  const [now, setNow] = useState<Snapshot | null>(null);

  const takeSnapshot = async (): Promise<Snapshot> => {
    const t = getFallbackToken();
    const layers: string[] = [];
    try { window.localStorage.getItem("x"); layers.push("ls"); } catch { layers.push("ls✗"); }
    try { window.sessionStorage.getItem("x"); layers.push("ss"); } catch { layers.push("ss✗"); }
    let meStatus: number | string = "ERR";
    let me = "request failed";
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      meStatus = r.status;
      const body = await r.text();
      me = body.slice(0, 120);
    } catch {}
    return {
      at: new Date().toISOString().slice(11, 19),
      me,
      meStatus,
      token: t ? `${t.slice(0, 14)}… (${t.startsWith("demo.") ? "signed demo" : "opaque"})` : "NONE",
      layers: layers.join(" "),
    };
  };

  const snapshotAndReload = async () => {
    const snap = await takeSnapshot();
    window.location.hash = "snap=" + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(snap)))));
    window.location.reload(); // a REAL browser reload
  };

  useEffect(() => {
    // restore the BEFORE snapshot from the hash (survives any storage policy)
    try {
      const m = /snap=([^&]+)/.exec(window.location.hash);
      if (m) setBefore(JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]))))));
    } catch {}
    void takeSnapshot().then(setNow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const out: Check[] = [];

    // browser storage layers
    try { window.localStorage.setItem("__t", "1"); window.localStorage.removeItem("__t"); out.push({ name: "localStorage", ok: true, detail: "writable" }); }
    catch { out.push({ name: "localStorage", ok: false, detail: "BLOCKED by this browser/embedding" }); }
    try { window.sessionStorage.setItem("__t", "1"); window.sessionStorage.removeItem("__t"); out.push({ name: "sessionStorage", ok: true, detail: "writable" }); }
    catch { out.push({ name: "sessionStorage", ok: false, detail: "BLOCKED" }); }
    try {
      document.cookie = "__t=1; path=/; SameSite=None; Secure";
      const ok = document.cookie.includes("__t=1");
      document.cookie = "__t=; path=/; max-age=0; SameSite=None; Secure";
      out.push({ name: "JS cookies", ok, detail: ok ? "accepted" : "REFUSED (third-party blocking)" });
    } catch { out.push({ name: "JS cookies", ok: false, detail: "REFUSED" }); }
    out.push({ name: "embedded in iframe", ok: null, detail: window.top === window.self ? "no — first-party context" : "YES — third-party cookie rules apply" });
    out.push({ name: "session token (client copy)", ok: !!getFallbackToken(), detail: getFallbackToken() ? "present — ONE credential, multiple transports (not a second auth system)" : "none" });
    out.push({ name: "saved user snapshot", ok: null, detail: (() => { try { return window.localStorage.getItem("upnova-session-user") ? "present" : "absent"; } catch { return "unreadable"; } })() });

    // the server's answer — the source of truth
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json().catch(() => ({ user: null })))
      .then((d) =>
        setChecks([
          ...out,
          {
            name: "/api/auth/me (server verdict)",
            ok: !!d.user,
            detail: d.user ? `authenticated as @${d.user.handle}` : `unauthenticated — ${d.reason ?? "no reason given"}`,
          },
        ])
      )
      .catch(() => setChecks([...out, { name: "/api/auth/me", ok: false, detail: "REQUEST FAILED (network)" }]));

    fetch("/api/debug/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setServer)
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-xl space-y-4 py-8">
      <h1 className="text-xl font-bold tracking-tight text-zinc-50">Session self-test</h1>
      <p className="font-mono text-[11px] text-zinc-500">
        build <span className="text-lime-300">{process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "unknown"}</span> — if this
        doesn&apos;t match the latest commit, the preview is serving STALE CODE and no fix can reach you here.
      </p>
      <p className="text-xs text-zinc-500">
        Dev-only diagnostics. Screenshot this page when reporting a login/refresh problem — it shows exactly which
        persistence layer your browser permits and what the server thinks.
      </p>

      <div className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-zinc-100">Before / after refresh evidence</p>
            <p className="mt-0.5 text-xs text-zinc-500">Captures the current state, performs a REAL reload, then shows both side by side.</p>
          </div>
          <button onClick={() => void snapshotAndReload()} className="btn-lime shrink-0 px-4 py-2 text-xs">
            Snapshot &amp; Reload
          </button>
        </div>
        {(before || now) && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[["BEFORE refresh", before] as const, ["AFTER refresh", now] as const].map(([label, snap]) => (
              <div key={label} className="rounded-lg border border-line-soft p-3">
                <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-zinc-500">{label}</p>
                {snap ? (
                  <dl className="mt-1.5 space-y-1 font-mono text-[10px] leading-relaxed">
                    <div><dt className="inline text-zinc-600">time </dt><dd className="inline text-zinc-300">{snap.at}</dd></div>
                    <div><dt className="inline text-zinc-600">token </dt><dd className={`inline ${snap.token === "NONE" ? "text-rose-300" : "text-lime-300"}`}>{snap.token}</dd></div>
                    <div><dt className="inline text-zinc-600">storage </dt><dd className="inline text-zinc-300">{snap.layers}</dd></div>
                    <div><dt className="inline text-zinc-600">/api/auth/me </dt><dd className="inline text-zinc-300">{String(snap.meStatus)}</dd></div>
                    <div className="break-all text-zinc-400">{snap.me}</div>
                  </dl>
                ) : (
                  <p className="mt-1.5 font-mono text-[10px] text-zinc-600">{label === "BEFORE refresh" ? "press Snapshot & Reload" : "capturing…"}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card divide-y divide-line-soft">
        {checks.map((c) => (
          <div key={c.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-sm text-zinc-300">{c.name}</span>
            <span className={`font-mono text-[11px] ${c.ok === false ? "text-rose-300" : c.ok ? "text-lime-300" : "text-zinc-400"}`}>
              {c.detail}
            </span>
          </div>
        ))}
        {checks.length === 0 && <p className="px-4 py-3 font-mono text-[11px] text-zinc-500">RUNNING…</p>}
      </div>

      {server && (
        <div className="card divide-y divide-line-soft">
          {Object.entries(server).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="font-mono text-[11px] text-zinc-500">{k}</span>
              <span className="font-mono text-[11px] text-zinc-300">{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-500">
        Client state: {user === undefined ? "initializing…" : user ? `signed in as @${user.handle}` : "signed out"} ·{" "}
        <Link href="/" className="text-lime-300 underline-offset-2 hover:underline">back to UpNova</Link>
      </p>
    </div>
  );
}
