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

export default function SessionDebugPage() {
  const { user } = useSession();
  const [checks, setChecks] = useState<Check[]>([]);
  const [server, setServer] = useState<Record<string, unknown> | null>(null);

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
    out.push({ name: "fallback token present", ok: !!getFallbackToken(), detail: getFallbackToken() ? "yes (stored client-side)" : "no" });
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
            detail: d.user ? `authenticated as @${d.user.handle}` : "unauthenticated",
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
      <p className="text-xs text-zinc-500">
        Dev-only diagnostics. Screenshot this page when reporting a login/refresh problem — it shows exactly which
        persistence layer your browser permits and what the server thinks.
      </p>

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
