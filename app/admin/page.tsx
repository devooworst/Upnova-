"use client";

/* ------------------------------------------------------------------ */
/*  Admin dashboard — user management, moderation, and marketplace     */
/*  oversight. Access is enforced server-side (role=admin); this page  */
/*  just renders what the admin APIs allow.                            */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Users, Flag, BarChart3 } from "lucide-react";

interface Overview {
  users: number;
  posts: number;
  messages: number;
  communities: number;
  campuses: number;
  services: number;
  opportunities: number;
  applications: number;
  projects: number;
  bookings: number;
  reportsOpen: number;
  grossVolumeCents: number;
  feesCents: number;
}

interface AdminUser {
  id: string;
  handle: string;
  email: string;
  displayName: string;
  role: string;
  plan: string;
  status: string;
  isSeed: boolean;
  createdAt: string;
}

interface AdminReport {
  id: string;
  targetType: string;
  targetId: string;
  category: string;
  details: string;
  status: string;
  reporter: string;
  createdAt: string;
}

type Tab = "overview" | "users" | "reports";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    const [o, u, r] = await Promise.all([
      fetch("/api/admin/overview", { cache: "no-store" }),
      fetch("/api/admin/users", { cache: "no-store" }),
      fetch("/api/admin/reports", { cache: "no-store" }),
    ]);
    if (o.status === 401 || o.status === 403) {
      setDenied(true);
      return;
    }
    setOverview((await o.json()) as Overview);
    setUsers((await u.json()).users ?? []);
    setReports((await r.json()).reports ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const moderate = async (userId: string, action: "suspend" | "activate") => {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    load();
  };

  const setReportStatus = async (reportId: string, status: string) => {
    await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, status }),
    });
    load();
  };

  if (denied)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ShieldCheck className="mx-auto h-6 w-6 text-zinc-500" />
        <p className="mt-2 text-sm font-semibold text-zinc-200">Admin only</p>
        <p className="mt-1 text-xs text-zinc-500">
          This dashboard requires an admin account.{" "}
          <Link href="/login" className="text-violet-300 hover:underline">Sign in</Link> as one.
        </p>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10">
          <ShieldCheck className="h-5 w-5 text-violet-400" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Admin</h1>
          <p className="text-sm text-zinc-400">Users, moderation, and marketplace activity.</p>
        </div>
      </div>

      <div className="mt-4 flex gap-1.5">
        {(
          [
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "users", label: "Users", icon: Users },
            { id: "reports", label: "Reports", icon: Flag },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              tab === t.id ? "border-violet-400/50 bg-violet-400/10 font-semibold text-violet-300" : "border-line text-zinc-400"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
            {t.id === "reports" && overview && overview.reportsOpen > 0 && (
              <span className="rounded-full bg-amber-400/20 px-1.5 text-[10px] font-bold text-amber-300">
                {overview.reportsOpen}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ------------------------------ overview ------------------------------ */}
      {tab === "overview" && overview && (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { l: "Users", v: overview.users },
            { l: "Posts", v: overview.posts },
            { l: "Messages", v: overview.messages },
            { l: "Communities", v: overview.communities },
            { l: "Services", v: overview.services },
            { l: "Opportunities", v: overview.opportunities },
            { l: "Applications", v: overview.applications },
            { l: "Projects", v: overview.projects },
            { l: "Bookings", v: overview.bookings },
            { l: "Open reports", v: overview.reportsOpen },
            { l: "Gross volume", v: `$${(overview.grossVolumeCents / 100).toFixed(0)}` },
            { l: "Platform fees", v: `$${(overview.feesCents / 100).toFixed(2)}` },
          ].map((m) => (
            <div key={m.l} className="card px-4 py-3">
              <p className="font-mono text-lg font-medium tracking-[0.08em] text-zinc-50">{m.v}</p>
              <p className="text-[11px] text-zinc-500">{m.l}</p>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------- users ------------------------------- */}
      {tab === "users" && (
        <div className="card mt-5 divide-y divide-line-soft">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-100">
                  {u.displayName}
                  <span className="text-xs font-normal text-zinc-500">@{u.handle} · {u.email}</span>
                  {u.role === "admin" && (
                    <span className="rounded-full border border-violet-400/40 px-2 py-0.5 text-[9px] font-bold uppercase text-violet-300">admin</span>
                  )}
                  {u.isSeed && (
                    <span className="rounded-full border border-line px-2 py-0.5 text-[9px] font-bold uppercase text-zinc-500">seed</span>
                  )}
                  {u.status === "suspended" && (
                    <span className="rounded-full border border-rose-400/40 bg-rose-400/10 px-2 py-0.5 text-[9px] font-bold uppercase text-rose-300">suspended</span>
                  )}
                </p>
                <p className="text-[11px] text-zinc-600">
                  Plan: {u.plan} · Joined {new Date(u.createdAt).toLocaleDateString()}
                </p>
              </div>
              {u.role !== "admin" &&
                (u.status === "active" ? (
                  <button onClick={() => moderate(u.id, "suspend")} className="rounded-full border border-line px-3 py-1.5 text-[11px] font-semibold text-zinc-400 transition hover:border-rose-400/40 hover:text-rose-300">
                    Suspend
                  </button>
                ) : (
                  <button onClick={() => moderate(u.id, "activate")} className="btn-lime px-3 py-1.5 text-[11px]">
                    Reactivate
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------ reports ------------------------------ */}
      {tab === "reports" && (
        <div className="mt-5 space-y-3">
          {reports.length === 0 && (
            <div className="card p-8 text-center text-sm text-zinc-500">No reports filed.</div>
          )}
          {reports.map((r) => (
            <div key={r.id} className="card p-4">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-100">
                {r.category === "emergency" && (
                  <span className="rounded-full border border-rose-400/40 bg-rose-400/10 px-2 py-0.5 text-[9px] font-bold uppercase text-rose-300">Emergency</span>
                )}
                {r.targetType} · {r.category}
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${
                  r.status === "open" ? "border-amber-400/40 text-amber-300" : "border-line text-zinc-500"
                }`}>
                  {r.status}
                </span>
              </p>
              <p className="mt-1 text-xs text-zinc-400">{r.details || "No details provided."}</p>
              <p className="mt-1 text-[10px] text-zinc-600">
                Reported by {r.reporter} · {new Date(r.createdAt).toLocaleString()} · target {r.targetId || "n/a"}
              </p>
              {r.status !== "resolved" && r.status !== "dismissed" && (
                <div className="mt-2.5 flex gap-2 border-t border-line-soft pt-2.5">
                  {r.status === "open" && (
                    <button onClick={() => setReportStatus(r.id, "reviewing")} className="rounded-full border border-violet-400/40 px-3 py-1.5 text-[11px] font-semibold text-violet-300">
                      Start review
                    </button>
                  )}
                  <button onClick={() => setReportStatus(r.id, "resolved")} className="btn-lime px-3 py-1.5 text-[11px]">
                    Resolve
                  </button>
                  <button onClick={() => setReportStatus(r.id, "dismissed")} className="rounded-full px-3 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-300">
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
