"use client";

/* ------------------------------------------------------------------ */
/*  People — the business relationship dashboard. Four tabs, four      */
/*  SEPARATE relationships, all private to this account:               */
/*                                                                     */
/*   TEAM     — explicit staff records only (you add them)             */
/*   CLIENTS  — people who booked/paid you                             */
/*   TALENT   — people you hired (projects, bookings, opportunities)   */
/*   CONTACTS — people you've talked to but not worked with yet        */
/*                                                                     */
/*  One hire never makes anyone an employee. Every card links to the   */
/*  correct profile, conversation, and records by id — nothing here    */
/*  is static.                                                         */
/* ------------------------------------------------------------------ */

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Check,
  ContactRound,
  Lock,
  MessageSquare,
  Pencil,
  Star,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { useSession } from "@/lib/session";

interface BasePerson {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  primaryRole: string;
  skills: string[];
}
interface TeamRow extends BasePerson {
  rowId: string;
  title: string;
  status: string;
  isAdmin?: boolean;
  compensation: string;
  notes: string;
  addedAt: string;
  endedAt: string | null;
  activeProjects: number;
}
interface ClientRow extends BasePerson {
  bookings: number;
  completedBookings: number;
  activeProjects: number;
  completedProjects: number;
  totalSpent: number;
  lastAt: string | null;
  preferred: number;
}
interface TalentRow extends BasePerson {
  hiredVia: string[];
  projectsWorked: number;
  currentProjects: { id: string; title: string; state: string }[];
  totalPaid: number;
  myReview: { rating: number; body: string } | null;
  hireAgainServiceId: string | null;
  onTeam: boolean;
}
interface ContactRow extends BasePerson {
  lastMessageAt: string | null;
  conversationId: string;
}
interface Payload {
  team: TeamRow[];
  clients: ClientRow[];
  talent: TalentRow[];
  contacts: ContactRow[];
}

const TABS = [
  { id: "team", label: "Team" },
  { id: "clients", label: "Clients" },
  { id: "talent", label: "Talent" },
  { id: "contacts", label: "Contacts" },
] as const;

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function PeopleInner() {
  const { user } = useSession();
  const params = useSearchParams();
  const [tab, setTab] = useState<string>(params.get("tab") && TABS.some((t) => t.id === params.get("tab")) ? params.get("tab")! : "team");
  const [data, setData] = useState<Payload | null>(null);
  const [adding, setAdding] = useState(false);
  const [editRow, setEditRow] = useState<TeamRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/business/people", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.team && setData(d))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (user) load();
  }, [!!user, load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold text-zinc-200">Sign in to see your people.</p>
        <Link href="/login" className="btn-lime mt-4 inline-flex px-5 py-2 text-xs">Sign in</Link>
      </div>
    );

  const count = (id: string) =>
    data ? (id === "team" ? data.team.filter((t) => t.status === "active").length : (data[id as keyof Payload] as unknown[]).length) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-300">business</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">People</h1>
          <p className="mt-1 flex max-w-xl items-center gap-1.5 text-xs text-zinc-500">
            <Lock className="h-3 w-3 shrink-0" /> Team, clients, talent, and contacts — kept separate on purpose, and private to you.
            One hire never makes someone an employee.
          </p>
        </div>
        <Link href="/payments" className="btn-ghost px-4 py-2 text-xs">
          <Wallet className="h-3.5 w-3.5" /> Payments
        </Link>
      </header>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5 text-xs text-zinc-300">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-zinc-500 hover:text-zinc-300"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              tab === t.id ? "border-sky-400/50 bg-sky-400/10 text-sky-300" : "border-line text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
          >
            {t.label}
            <span className="ml-1.5 font-mono text-[10px] text-zinc-500">{count(t.id) ?? "…"}</span>
          </button>
        ))}
      </div>

      {data === null ? (
        <div className="card h-40 animate-pulse" />
      ) : (
        <>
          {/* ============ TEAM ============ */}
          {tab === "team" && (
            <section className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-100"><Users className="h-4 w-4 text-sky-300" /> Team / Employees</h2>
                  <p className="mt-0.5 text-[11px] text-zinc-500">Only people you explicitly add. Compensation notes are private to you.</p>
                </div>
                <button onClick={() => setAdding(true)} className="btn-lime px-3.5 py-1.5 text-xs">
                  <UserPlus className="h-3.5 w-3.5" /> Add team member
                </button>
              </div>
              {data.team.length === 0 ? (
                <p className="mt-4 text-xs text-zinc-500">No team records yet. Add internal staff here — hired creators stay under Talent.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {data.team.map((t) => (
                    <li key={t.rowId} className={`rounded-xl border p-3.5 ${t.status === "active" ? "border-line bg-card-raised" : "border-line-soft bg-card opacity-70"}`}>
                      <div className="flex flex-wrap items-center gap-3">
                        <Link href={`/creator/${t.handle}`}><Avatar src={t.avatarUrl} initials={t.displayName.charAt(0)} size="md" /></Link>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-100">
                            <Link href={`/creator/${t.handle}`} className="hover:underline">{t.displayName}</Link>
                            <span className={`ml-2 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${t.status === "active" ? "border-lime-400/40 bg-lime-400/10 text-lime-300" : "border-line text-zinc-500"}`}>
                              {t.status}
                            </span>
                            {t.isAdmin && (
                              <span className="ml-1.5 rounded-full border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-300">
                                Admin seat
                              </span>
                            )}
                          </p>
                          <p className="font-mono text-[10px] tracking-[0.06em] text-zinc-500">
                            {t.title || "Team member"} · since {fmtShort(t.addedAt)}
                            {t.endedAt ? ` · ended ${fmtShort(t.endedAt)}` : ""}
                            {t.activeProjects ? ` · ${t.activeProjects} active project(s)` : ""}
                          </p>
                          {t.compensation && <p className="mt-0.5 text-[10px] text-zinc-600">Compensation (private): {t.compensation}</p>}
                        </div>
                        <Link href={`/messages?to=${t.handle}`} className="btn-ghost px-3 py-1.5 text-xs"><MessageSquare className="h-3 w-3" /> Message</Link>
                        <button onClick={() => setEditRow(t)} className="btn-ghost px-3 py-1.5 text-xs"><Pencil className="h-3 w-3" /> Edit</button>
                        {t.status === "active" && (
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/business/team/${t.rowId}`, { method: "DELETE" });
                              if (res.ok) { setNotice(`${t.displayName}'s team record is now inactive — the history is kept.`); load(); }
                            }}
                            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:border-rose-400/40 hover:text-rose-300"
                          >
                            <UserMinus className="mr-1 inline h-3 w-3 align-[-2px]" /> End
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ============ CLIENTS ============ */}
          {tab === "clients" && (
            <section className="card p-5">
              <h2 className="text-sm font-bold text-zinc-100">Clients</h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                People who booked or hired you. Preferred/loyal clients are managed privately in{" "}
                <Link href="/clients" className="text-lime-300 hover:underline">Preferred Clients</Link>.
              </p>
              {data.clients.length === 0 ? (
                <p className="mt-4 text-xs text-zinc-500">No clients yet — when someone books or hires you, they appear here.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {data.clients.map((c) => (
                    <li key={c.id} className="rounded-xl border border-line bg-card-raised p-3.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link href={`/creator/${c.handle}`}><Avatar src={c.avatarUrl} initials={c.displayName.charAt(0)} size="md" /></Link>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-100">
                            <Link href={`/creator/${c.handle}`} className="hover:underline">{c.displayName}</Link>
                            {c.preferred > 0 && (
                              <span className="ml-2 rounded-full border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-300">
                                Preferred · {c.preferred} benefit{c.preferred > 1 ? "s" : ""}
                              </span>
                            )}
                          </p>
                          <p className="font-mono text-[10px] tracking-[0.06em] text-zinc-500">
                            {c.completedBookings}/{c.bookings} bookings completed · {c.completedProjects} project(s) done
                            {c.activeProjects ? ` · ${c.activeProjects} active` : ""} · ${c.totalSpent} total spent
                            {c.lastAt ? ` · last ${fmtShort(c.lastAt)}` : ""}
                          </p>
                        </div>
                        <Link href={`/messages?to=${c.handle}`} className="btn-ghost px-3 py-1.5 text-xs"><MessageSquare className="h-3 w-3" /> Message</Link>
                        <Link href="/calendar" className="btn-ghost px-3 py-1.5 text-xs">Bookings</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ============ TALENT ============ */}
          {tab === "talent" && (
            <section className="card p-5">
              <h2 className="text-sm font-bold text-zinc-100">Talent</h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Creators and freelancers you&apos;ve hired — via projects, bookings, or opportunities. Hired ≠ employed.
              </p>
              {data.talent.length === 0 ? (
                <p className="mt-4 text-xs text-zinc-500">
                  Nobody hired yet — <Link href="/hiring" className="text-lime-300 hover:underline">find talent</Link> or post an opportunity.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {data.talent.map((t) => (
                    <li key={t.id} className="rounded-xl border border-line bg-card-raised p-3.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link href={`/creator/${t.handle}`}><Avatar src={t.avatarUrl} initials={t.displayName.charAt(0)} size="md" /></Link>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-100">
                            <Link href={`/creator/${t.handle}`} className="hover:underline">{t.displayName}</Link>
                            {t.onTeam && (
                              <span className="ml-2 rounded-full border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-300">
                                Also on team
                              </span>
                            )}
                            {t.myReview && (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-300">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {t.myReview.rating.toFixed(1)} your review
                              </span>
                            )}
                          </p>
                          <p className="font-mono text-[10px] tracking-[0.06em] text-zinc-500">
                            {t.primaryRole || "Creator"} · {t.projectsWorked} completed · ${t.totalPaid} paid · via {t.hiredVia.join(" + ")}
                          </p>
                          {t.skills.length > 0 && (
                            <p className="mt-1 flex flex-wrap gap-1">
                              {t.skills.slice(0, 5).map((s) => (
                                <span key={s} className="rounded-full border border-line px-2 py-0.5 text-[9px] text-zinc-400">{s}</span>
                              ))}
                            </p>
                          )}
                          {t.currentProjects.length > 0 && (
                            <p className="mt-1 text-[10px] text-violet-300">
                              Now: {t.currentProjects.map((p, i) => (
                                <Link key={p.id} href={`/projects/${p.id}`} className="hover:underline">
                                  {i > 0 ? " · " : ""}{p.title} ({p.state.replace(/_/g, " ")})
                                </Link>
                              ))}
                            </p>
                          )}
                        </div>
                        <Link href={`/messages?to=${t.handle}`} className="btn-ghost px-3 py-1.5 text-xs"><MessageSquare className="h-3 w-3" /> Message</Link>
                        {t.hireAgainServiceId && (
                          <Link href={`/services/${t.hireAgainServiceId}`} className="btn-lime px-3 py-1.5 text-xs">Hire again</Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ============ CONTACTS ============ */}
          {tab === "contacts" && (
            <section className="card p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-100"><ContactRound className="h-4 w-4 text-zinc-400" /> Contacts</h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                People you&apos;ve talked to but not formally worked with yet. They move to Clients or Talent automatically when real work happens.
              </p>
              {data.contacts.length === 0 ? (
                <p className="mt-4 text-xs text-zinc-500">No open contacts — everyone you&apos;ve talked to is already a client, talent, or team member.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {data.contacts.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
                      <Link href={`/creator/${c.handle}`}><Avatar src={c.avatarUrl} initials={c.displayName.charAt(0)} size="sm" /></Link>
                      <div className="min-w-0 flex-1">
                        <Link href={`/creator/${c.handle}`} className="text-sm font-semibold text-zinc-100 hover:underline">{c.displayName}</Link>
                        <p className="font-mono text-[10px] tracking-[0.06em] text-zinc-500">
                          {c.primaryRole || "Member"}{c.lastMessageAt ? ` · last message ${fmtShort(c.lastMessageAt)}` : ""}
                        </p>
                      </div>
                      <Link href={`/messages?c=${c.conversationId}`} className="btn-ghost px-3 py-1.5 text-xs"><MessageSquare className="h-3 w-3" /> Open thread</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {(adding || editRow) && (
        <TeamModal
          row={editRow}
          onClose={() => { setAdding(false); setEditRow(null); }}
          onSaved={(msg) => { setAdding(false); setEditRow(null); setNotice(msg); load(); }}
        />
      )}
    </div>
  );
}

/* --------------------------- team add/edit --------------------------- */

function TeamModal({ row, onClose, onSaved }: { row: TeamRow | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const [handle, setHandle] = useState(row?.handle ?? "");
  const [title, setTitle] = useState(row?.title ?? "");
  const [compensation, setCompensation] = useState(row?.compensation ?? "");
  const [status, setStatus] = useState(row?.status ?? "active");
  const [isAdmin, setIsAdmin] = useState(!!row?.isAdmin);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    const res = row
      ? await fetch(`/api/business/team/${row.rowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, compensation, status, isAdmin }),
        })
      : await fetch("/api/business/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: handle.replace(/^@/, ""), title, compensation, isAdmin }),
        });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(d.error || "Couldn't save");
    onSaved(row ? "Team record updated." : "Team member added — they were notified privately.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h3 className="text-base font-bold text-zinc-50">{row ? `Edit ${row.displayName}` : "Add team member"}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          Team membership is explicit — it&apos;s never implied by a hire. Requires a real prior interaction. Compensation stays private to you.
        </p>
        <div className="mt-3 space-y-2.5">
          {!row && (
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Handle</span>
              <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" className="input-dark mt-1 w-full py-2 text-sm" />
            </label>
          )}
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Role / title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Studio Editor" className="input-dark mt-1 w-full py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Compensation note (private)</span>
            <input value={compensation} onChange={(e) => setCompensation(e.target.value)} placeholder="e.g. contract day-rate" className="input-dark mt-1 w-full py-2 text-sm" />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs text-zinc-300">
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} className="h-3.5 w-3.5 accent-sky-400" />
            <span>
              Admin seat <span className="text-zinc-500">(capacity-tracked per plan; delegated account access is rolling out)</span>
            </span>
          </label>
          {row && (
            <div className="flex gap-1.5">
              {["active", "inactive"].map((s) => (
                <button key={s} onClick={() => setStatus(s)} className={`flex-1 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${status === s ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400"}`}>
                  {status === s && <Check className="mr-1 inline h-3 w-3 align-[-2px]" />}{s}
                </button>
              ))}
            </div>
          )}
        </div>
        {err && <p className="mt-3 text-xs font-medium text-rose-300">{err}</p>}
        <button disabled={busy} onClick={save} className="btn-lime mt-4 w-full justify-center py-2.5 text-sm">
          {row ? "Save changes" : "Add to team"}
        </button>
      </div>
    </div>
  );
}

export default function PeoplePage() {
  return (
    <Suspense fallback={<div className="card mx-auto h-64 max-w-4xl animate-pulse" />}>
      <PeopleInner />
    </Suspense>
  );
}
