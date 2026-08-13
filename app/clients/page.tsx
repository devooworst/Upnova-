"use client";

/* ------------------------------------------------------------------ */
/*  Clients — PRIVATE relationship dashboard.                          */
/*                                                                     */
/*  Provider side: everyone who has booked/hired you, completed-work   */
/*  stats, Preferred Client management (add / edit benefits / remove), */
/*  loyalty history, and real early-access windows on your services.   */
/*  Client side: providers who personally added YOU, with your         */
/*  benefits.                                                          */
/*                                                                     */
/*  Nothing on this page is public. No badges, no leaderboards, no     */
/*  scores — just "this provider values this client."                  */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import AvailabilityStrip from "@/components/AvailabilityStrip";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Lock,
  Pencil,
  Star,
  UserCheck,
  UserMinus,
  X,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { useSession } from "@/lib/session";

type Benefit = { key: string; percent?: number; label?: string };

interface ClientRow {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  completedBookings: number;
  completedProjects: number;
  completedTotal: number;
  completed12mo: number;
  eligible: boolean;
  totalSpent: number;
  lastCompletedAt: string | null;
  history: { kind: string; title: string; at: string }[];
  preferred: { id: string; status: string; benefits: Benefit[]; note: string; addedAt: string; removedAt: string | null } | null;
}

interface MyPreferred {
  id: string;
  provider: { id: string; handle: string; displayName: string; avatarUrl: string | null; accountType: string };
  benefits: Benefit[];
  since: string;
  completedBookings: number;
  completedProjects: number;
  bookAgainServiceId: string | null;
  earlyWindows: { serviceId: string; title: string; until: string }[];
}

interface MyService {
  id: string;
  title: string;
  price: number;
  horizonDays: number;
  releaseMode: "rolling" | "scheduled";
  release: { releasedUntil: string | null; releaseAt: string | null; releaseUntil: string | null; eaHours: number | null } | null;
  preferredUntil: string | null;
  earlyAccess: {
    slots: number | null;
    preferredLimit: number | null;
    activeBookings: number;
    slotsLeft: number | null;
  } | null;
}

const BENEFIT_CHOICES: { key: string; label: string; hint?: string }[] = [
  { key: "priority_booking", label: "Priority booking", hint: "Give Preferred Clients priority when booking available services." },
  { key: "early_access", label: "Early access to appointments", hint: "They can book during your Preferred Early Access windows." },
  { key: "discount", label: "Preferred pricing / discount", hint: "Applied automatically and itemized on their receipt." },
  { key: "free_addon", label: "Free add-on", hint: "A menu add-on on the house." },
  { key: "upgrade", label: "Complimentary upgrade", hint: "A better package at the base price." },
  { key: "recurring_priority", label: "Recurring booking priority", hint: "Give Preferred Clients priority when scheduling repeat or recurring appointments." },
  { key: "priority_response", label: "Priority response", hint: "Their messages surface first in your inbox." },
  { key: "exclusive_windows", label: "Exclusive early-access windows", hint: "Access to windows you open only for Preferred Clients." },
  { key: "custom", label: "Custom reward", hint: "Anything you want to offer — your words." },
];

const benefitLabel = (b: Benefit) =>
  b.key === "discount"
    ? `${b.percent}% preferred pricing`
    : b.key === "custom"
      ? b.label || "Custom reward"
      : BENEFIT_CHOICES.find((c) => c.key === b.key)?.label ?? b.key;

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function ClientsPage() {
  const { user } = useSession();
  const [data, setData] = useState<{ clients: ClientRow[]; preferredCount: number; services: MyService[] } | null>(null);
  const [mine, setMine] = useState<MyPreferred[] | null>(null);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      fetch("/api/clients", { cache: "no-store" }),
      fetch("/api/me/preferred", { cache: "no-store" }),
    ]);
    if (a.ok) setData(await a.json());
    if (b.ok) setMine((await b.json()).preferred);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!user)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold text-zinc-200">Sign in to see your client relationships.</p>
        <Link href="/login" className="btn-lime mt-4 inline-flex px-5 py-2 text-xs">Sign in</Link>
      </div>
    );

  const preferred = (data?.clients ?? []).filter((c) => c.preferred?.status === "active");
  const others = (data?.clients ?? []).filter((c) => c.preferred?.status !== "active");

  const remove = async (c: ClientRow) => {
    if (!c.preferred) return;
    const res = await fetch(`/api/preferred-clients/${c.preferred.id}`, { method: "DELETE" });
    if (res.ok) {
      setNotice(`${c.displayName} was removed. They were notified privately — the relationship history is kept.`);
      load();
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Clients</h1>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
          <Lock className="h-3 w-3" /> Private to you. Nothing here appears on anyone&apos;s public profile, in search, or to other providers.
        </p>
      </header>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-line bg-card px-4 py-2.5 text-xs text-zinc-300">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-zinc-500 hover:text-zinc-300"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ================= MY BENEFITS (client side) ================= */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
          <Star className="h-4 w-4 text-rose-300" /> Where you&apos;re a Preferred Client
        </h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Providers who personally added you. This is between you and them — it never shows publicly.
        </p>
        {mine === null ? (
          <div className="mt-3 h-16 animate-pulse rounded-xl bg-card-raised" />
        ) : mine.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">
            No provider has added you yet. Preferred status usually follows repeat completed bookings with the same provider.
          </p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {mine.map((m) => (
              <div key={m.id} className="rounded-xl border border-rose-400/25 bg-rose-400/5 p-3.5">
                <div className="flex items-center gap-3">
                  <Link href={`/creator/${m.provider.handle}`}>
                    <Avatar src={m.provider.avatarUrl} initials={m.provider.displayName.charAt(0)} size="md" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-100">{m.provider.displayName}</p>
                    <p className="text-[11px] text-zinc-500">
                      Preferred Client since {fmt(m.since)} · {m.completedBookings + m.completedProjects} completed together
                    </p>
                  </div>
                  {m.bookAgainServiceId && (
                    <Link href={`/services/${m.bookAgainServiceId}`} className="btn-lime shrink-0 px-3.5 py-1.5 text-xs">
                      Book again
                    </Link>
                  )}
                </div>
                <ul className="mt-2.5 space-y-1">
                  {m.benefits.map((b) => (
                    <li key={b.key} className="flex items-center gap-1.5 text-xs text-zinc-300">
                      <Check className="h-3 w-3 text-rose-300" /> {benefitLabel(b)}
                    </li>
                  ))}
                </ul>
                {m.earlyWindows.map((w) => (
                  <Link
                    key={w.serviceId}
                    href={`/services/${w.serviceId}`}
                    className="mt-2 flex items-center gap-1.5 rounded-lg border border-lime-400/30 bg-lime-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-lime-300"
                  >
                    <Clock className="h-3 w-3" />
                    {w.title} is open to Preferred Clients before everyone else — until {fmtShort(w.until)},{" "}
                    {new Date(w.until).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ================= PREFERRED CLIENTS (provider side) ================= */}
      <section className="card p-5" data-tut="clients-preferred">
        <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
          <UserCheck className="h-4 w-4 text-lime-300" /> Preferred Clients ({preferred.length})
        </h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
          Clients you&apos;ve intentionally selected for loyalty benefits. Only you can see this list.{" "}
          <span className="text-zinc-400">Preferred status is a relationship — it never grants unlimited bookings.
          Preferred Early Access (below) is a separate, temporary access mechanism, and your availability is always the hard limit.</span>
        </p>
        {preferred.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">
            No Preferred Clients yet. When someone completes 3 bookings with you inside 12 months they become eligible below —
            or add a loyal client early if you want to.
          </p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {preferred.map((c) => (
              <div key={c.id} className="rounded-xl border border-line bg-card-raised p-3.5">
                <div className="flex items-center gap-3">
                  <Avatar src={c.avatarUrl} initials={c.displayName.charAt(0)} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-100">{c.displayName}</p>
                    <p className="font-mono text-[10px] tracking-[0.06em] text-zinc-500">
                      {c.completedTotal} completed · ${c.totalSpent} total
                      {c.lastCompletedAt ? ` · last ${fmtShort(c.lastCompletedAt)}` : ""} · preferred since {c.preferred ? fmtShort(c.preferred.addedAt) : ""}
                    </p>
                  </div>
                  <button onClick={() => setEditing(c)} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    onClick={() => remove(c)}
                    className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-zinc-500 transition hover:border-rose-400/40 hover:text-rose-300"
                  >
                    <UserMinus className="mr-1 inline h-3 w-3 align-[-2px]" /> Remove
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(c.preferred?.benefits ?? []).map((b) => (
                    <span key={b.key} className="rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-lime-300">
                      {benefitLabel(b)}
                    </span>
                  ))}
                </div>
                <HistoryToggle c={c} expanded={expanded} setExpanded={setExpanded} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ================= EARLY ACCESS WINDOWS ================= */}
      {(data?.services?.length ?? 0) > 0 && (
        <section className="card p-5" data-tut="clients-early-access">
          <h2 className="text-sm font-bold text-zinc-100">Preferred Early Access</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
            Give your Preferred Clients first access to newly released appointments before everyone else.
            <span className="text-zinc-300"> Three separate dials: your <span className="font-semibold">booking horizon</span> says
            how far ahead anyone can book · <span className="font-semibold">early access</span> says who gets access first ·
            <span className="font-semibold"> availability/capacity</span> says how many can actually book.</span>{" "}
            Preferred Clients can never book beyond your available slots or outside your horizon; when the window ends, any
            remaining availability opens to everyone automatically, and cancellations free their slot.
          </p>
          <div className="mt-3 space-y-2">
            {data!.services.map((s) => (
              <EarlyAccessRow key={s.id} s={s} onChanged={load} />
            ))}
          </div>
        </section>
      )}

      {/* ================= ALL CLIENTS ================= */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100" data-tut="clients-all">All clients ({data?.clients.length ?? 0})</h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Your private customer history — everyone who has booked or hired you, with completed engagements, spending, and
          last booking. Eligibility for Preferred: 3 completed engagements within 12 months — adding them stays your call.
        </p>
        {data === null ? (
          <div className="mt-3 h-16 animate-pulse rounded-xl bg-card-raised" />
        ) : others.length === 0 && preferred.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No client history yet — completed bookings and projects appear here.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {others.map((c) => (
              <div key={c.id} className="rounded-xl border border-line bg-card-raised p-3.5">
                <div className="flex items-center gap-3">
                  <Avatar src={c.avatarUrl} initials={c.displayName.charAt(0)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-100">
                      {c.displayName}
                      {c.eligible && (
                        <span className="ml-2 rounded-full border border-rose-400/40 bg-rose-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-300">
                          Eligible
                        </span>
                      )}
                      {c.preferred?.status === "removed" && (
                        <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                          Formerly preferred
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-[10px] tracking-[0.06em] text-zinc-500">
                      {c.completedTotal} completed ({c.completed12mo} in 12 mo) · ${c.totalSpent} total
                      {c.lastCompletedAt ? ` · last ${fmtShort(c.lastCompletedAt)}` : ""}
                    </p>
                  </div>
                  <button onClick={() => setEditing(c)} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">
                    <UserCheck className="h-3.5 w-3.5" /> Add to Preferred
                  </button>
                </div>
                <HistoryToggle c={c} expanded={expanded} setExpanded={setExpanded} />
              </div>
            ))}
          </div>
        )}
      </section>

      {editing && (
        <BenefitsModal
          client={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------- loyalty history ------------------------- */

function HistoryToggle({
  c,
  expanded,
  setExpanded,
}: {
  c: ClientRow;
  expanded: string | null;
  setExpanded: (v: string | null) => void;
}) {
  if (c.history.length === 0 && !c.preferred) return null;
  const open = expanded === c.id;
  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(open ? null : c.id)}
        className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-300"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} Loyalty history
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-line bg-black/20 px-3 py-2.5">
          <ul className="space-y-1">
            {c.history.map((h, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <Check className="h-3 w-3 text-lime-400" /> {fmtShort(h.at)} — {h.title} · completed
              </li>
            ))}
            {c.history.length === 0 && <li className="text-[11px] text-zinc-500">No completed engagements yet.</li>}
          </ul>
          {c.preferred && (
            <p className="mt-2 border-t border-dashed border-line pt-2 text-[11px] text-zinc-500">
              Preferred Client: added {fmt(c.preferred.addedAt)}
              {c.preferred.removedAt ? ` · removed ${fmt(c.preferred.removedAt)}` : ""}
              {c.preferred.status === "active" && (c.preferred.benefits.length > 0)
                ? ` · ${c.preferred.benefits.map(benefitLabel).join(", ")}`
                : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------- benefits modal ------------------------- */

function BenefitsModal({ client, onClose, onSaved }: { client: ClientRow; onClose: () => void; onSaved: () => void }) {
  const existing = client.preferred?.status === "active" ? client.preferred.benefits : [];
  const [selected, setSelected] = useState<Record<string, boolean>>(
    Object.fromEntries(existing.map((b) => [b.key, true]))
  );
  const [discount, setDiscount] = useState(String(existing.find((b) => b.key === "discount")?.percent ?? 10));
  const [customLabel, setCustomLabel] = useState(existing.find((b) => b.key === "custom")?.label ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isEdit = client.preferred?.status === "active";

  const save = async () => {
    const benefits: Benefit[] = Object.keys(selected)
      .filter((k) => selected[k])
      .map((key) =>
        key === "discount"
          ? { key, percent: Number(discount) }
          : key === "custom"
            ? { key, label: customLabel }
            : { key }
      );
    if (benefits.length === 0) return setErr("Choose at least one benefit");
    setBusy(true);
    setErr(null);
    const res = isEdit
      ? await fetch(`/api/preferred-clients/${client.preferred!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ benefits }),
        })
      : await fetch("/api/preferred-clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: client.id, benefits }),
        });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(d.error || "Couldn't save");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-zinc-50">
              {isEdit ? "Edit benefits" : "Add to Preferred Clients"}
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {client.displayName} · {client.completedTotal} completed with you
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200"><X className="h-4 w-4" /></button>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
          Choose what YOU want to offer — none of it is mandatory. {client.displayName.split(" ")[0]} is notified privately;
          nothing appears on any public profile.
        </p>

        <div className="mt-3 space-y-1.5">
          {BENEFIT_CHOICES.map((b) => (
            <label key={b.key} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition ${selected[b.key] ? "border-lime-400/40 bg-lime-400/5 text-zinc-100" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
              <input
                type="checkbox"
                checked={!!selected[b.key]}
                onChange={(e) => setSelected({ ...selected, [b.key]: e.target.checked })}
                className="h-3.5 w-3.5 accent-lime-400"
              />
              <span className="flex-1">
                {b.label}
                {b.hint && <span className="block text-[10px] text-zinc-600">{b.hint}</span>}
              </span>
              {b.key === "discount" && selected.discount && (
                <span className="flex items-center gap-1 font-mono text-xs">
                  <input
                    type="number" min={1} max={50} value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="input-dark w-16 py-1 text-xs"
                  />
                  %
                </span>
              )}
            </label>
          ))}
          {selected.custom && (
            <input
              value={customLabel} onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Describe the custom reward (e.g. free 30-min consult)"
              className="input-dark w-full py-2 text-xs"
            />
          )}
        </div>

        {err && <p className="mt-3 text-xs font-medium text-rose-300">{err}</p>}
        <button disabled={busy} onClick={save} className="btn-lime mt-4 w-full justify-center py-2.5 text-sm">
          {isEdit ? "Save benefits" : `Add ${client.displayName.split(" ")[0]} as a Preferred Client`}
        </button>
      </div>
    </div>
  );
}

/* ------------------------- early access row ------------------------- */
/* Setup flow: service → available slots → preferred-access duration →
   optional preferred booking limit → public opening time (shown live). */

function EarlyAccessRow({ s, onChanged }: { s: MyService; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hours, setHours] = useState(24);
  const [customHours, setCustomHours] = useState(false);
  const [slots, setSlots] = useState("");
  const [prefLimit, setPrefLimit] = useState("");
  const [showCal, setShowCal] = useState(false);

  const start = async () => {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/services/${s.id}/early-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hours,
        slots: slots.trim() === "" ? null : Number(slots),
        preferredLimit: prefLimit.trim() === "" ? null : Number(prefLimit),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(d.error || "Couldn't start Preferred Early Access");
    onChanged();
  };
  const end = async (full = false) => {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/services/${s.id}/early-access${full ? "?full=1" : ""}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setErr("Couldn't update Preferred Early Access");
    onChanged();
  };

  const opensAt = s.preferredUntil
    ? `${fmtShort(s.preferredUntil)}, ${new Date(s.preferredUntil).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : null;

  return (
    <div className="rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-100">
            {s.title}
            <span className="ml-2 font-mono text-[9px] font-normal uppercase tracking-wide text-zinc-500" title={s.releaseMode === "scheduled" ? "Scheduled releases — you open availability on specific dates. Nothing beyond a release is bookable until it opens." : "Rolling availability — customers can always book up to this many days ahead; the window moves forward every day."} data-tut="clients-horizon">
              {s.releaseMode === "scheduled" ? "scheduled releases" : `rolling · ${s.horizonDays}d ahead`}
            </span>
          </p>
          {s.preferredUntil ? (
            <p className="text-[11px] font-semibold text-lime-300">
              Preferred Early Access until {opensAt} — remaining slots open to everyone then
              {s.earlyAccess?.slots != null && (
                <span className="text-zinc-400"> · {s.earlyAccess.slotsLeft} of {s.earlyAccess.slots} slots left</span>
              )}
              {s.earlyAccess?.preferredLimit != null && (
                <span className="text-zinc-400"> · {s.earlyAccess.preferredLimit} per client</span>
              )}
            </p>
          ) : s.earlyAccess?.slots != null ? (
            <p className="text-[11px] text-zinc-400">
              Open to everyone · {s.earlyAccess.slotsLeft} of {s.earlyAccess.slots} slots left
            </p>
          ) : (
            <p className="text-[11px] text-zinc-500">Open to everyone</p>
          )}
        </div>
        {s.preferredUntil ? (
          <button disabled={busy} onClick={() => end(false)} className="btn-ghost shrink-0 px-3 py-1.5 text-xs" title="End early access now — remaining slots open to the public immediately (the slot cap stays)">
            Open to everyone now
          </button>
        ) : s.earlyAccess?.slots != null ? (
          <button disabled={busy} onClick={() => end(true)} className="btn-ghost shrink-0 px-3 py-1.5 text-xs" title="Remove the slot cap — normal availability rules only">
            Remove slot cap
          </button>
        ) : null}
      </div>

      {!s.preferredUntil && (
        <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-line-soft pt-2">
          <label className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">
            Slots
            <input
              value={slots}
              onChange={(e) => setSlots(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="any"
              className="input-dark mt-1 w-16 px-2 py-1.5 text-xs"
              title="Total bookable slots for this drop (optional). Applies to EVERYONE — Preferred Clients can never book beyond it."
            />
          </label>
          <label className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">
            Early access
            <select value={customHours ? 0 : hours} onChange={(e) => { const v = Number(e.target.value); if (v === 0) setCustomHours(true); else { setCustomHours(false); setHours(v); } }} className="input-dark mt-1 px-2 py-1.5 text-xs" title="How long Preferred Clients book before the public. Public booking opens automatically when this ends.">
              {[6, 12, 24, 48, 72].map((h) => <option key={h} value={h}>{h}h</option>)}
              <option value={0}>Custom…</option>
            </select>
            {customHours && (
              <input
                value={hours}
                onChange={(e) => setHours(Math.max(1, Math.min(168, Number(e.target.value.replace(/[^0-9]/g, "")) || 1)))}
                className="input-dark ml-1 mt-1 w-14 px-2 py-1.5 text-xs"
                title="Custom duration in hours (1–168)"
              />
            )}
          </label>
          <label className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">
            Per-client limit
            <input
              value={prefLimit}
              onChange={(e) => setPrefLimit(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="no limit"
              className="input-dark mt-1 w-16 px-2 py-1.5 text-xs"
              title="Control how many appointments each Preferred Client can claim during an early-access period. Empty = no limit (capacity still applies)."
            />
          </label>
          <button disabled={busy} onClick={start} className="btn-ghost px-3 py-1.5 text-xs">
            <Clock className="h-3 w-3" /> Start early access
          </button>
          <p className="w-full text-[10px] leading-relaxed text-zinc-600">
            Preferred Clients book first for {hours}h{slots.trim() ? ` · ${slots} total slots (capacity binds everyone)` : ""}
            {prefLimit.trim() ? ` · max ${prefLimit} per Preferred Client` : ""} · public booking opens automatically when the window ends ·
            bookings stay inside your {s.horizonDays}-day horizon.
          </p>
        </div>
      )}
      {s.releaseMode === "scheduled" && <ReleaseScheduler s={s} onChanged={onChanged} />}
      {/* the provider sees the SAME honest calendar customers see —
          unreleased periods shaded, one truth for both sides */}
      <button onClick={() => setShowCal(!showCal)} className="mt-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-300">
        {showCal ? "Hide" : "Show"} booking calendar (what customers see)
      </button>
      {showCal && <div className="mt-2"><AvailabilityStrip serviceId={s.id} /></div>}
      {err && <p className="mt-1.5 text-[11px] font-medium text-amber-300">{err}</p>}
    </div>
  );
}

/* --------------------- scheduled release control ---------------------
   "September bookings open August 25 at 9 AM" — pick when the release
   opens, which dates it covers, and (optionally) how long Preferred
   Clients book first. Capacity still binds everyone. */
function ReleaseScheduler({ s, onChanged }: { s: MyService; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openAt, setOpenAt] = useState("");
  const [covers, setCovers] = useState("");
  const [ea, setEa] = useState("");
  const [slots, setSlots] = useState("");
  const [perClient, setPerClient] = useState("");

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const schedule = async () => {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/services/${s.id}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // empty "opens at" = open this availability RIGHT NOW (manual release)
        releaseAt: openAt || new Date().toISOString(),
        coversUntil: covers ? `${covers}T23:59:59` : "",
        earlyAccessHours: ea.trim() === "" ? null : Number(ea),
        slots: slots.trim() === "" ? null : Number(slots),
        perClientLimit: perClient.trim() === "" ? null : Number(perClient),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(d.error || "Couldn't schedule the release");
    onChanged();
  };
  const cancel = async () => {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/services/${s.id}/release`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setErr("Couldn't cancel the release");
    onChanged();
  };

  const pending = s.release?.releaseAt && s.release.releaseUntil;
  return (
    <div className="mt-2 border-t border-line-soft pt-2" data-tut="clients-release">
      {s.release?.releasedUntil && (
        <p className="text-[10px] text-zinc-500">Released so far: dates through {fmt(s.release.releasedUntil)}.</p>
      )}
      {pending ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-[11px] font-semibold text-sky-300">
            Next release: opens {fmt(s.release!.releaseAt!)} · covers dates through {fmt(s.release!.releaseUntil!)}
            {s.release!.eaHours ? ` · Preferred Clients first for ${s.release!.eaHours}h` : " · opens to everyone at once"}
          </p>
          <button disabled={busy} onClick={cancel} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">Cancel release</button>
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">
            Opens at
            <input type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)} className="input-dark mt-1 px-2 py-1.5 text-xs" title="The moment this release opens for booking — leave empty to open the availability right now" />
          </label>
          <label className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">
            Covers dates through
            <input type="date" value={covers} onChange={(e) => setCovers(e.target.value)} className="input-dark mt-1 px-2 py-1.5 text-xs" title="Appointments up to this date become bookable when the release opens" />
          </label>
          <label className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">
            Preferred first (h)
            <input value={ea} onChange={(e) => setEa(e.target.value.replace(/[^0-9]/g, ""))} placeholder="off" className="input-dark mt-1 w-14 px-2 py-1.5 text-xs" title="Optional: how many hours Preferred Clients book before everyone else" />
          </label>
          <label className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">
            Slots
            <input value={slots} onChange={(e) => setSlots(e.target.value.replace(/[^0-9]/g, ""))} placeholder="any" className="input-dark mt-1 w-14 px-2 py-1.5 text-xs" title="Optional capacity cap — binds everyone, Preferred Clients included" />
          </label>
          <label className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">
            Per client
            <input value={perClient} onChange={(e) => setPerClient(e.target.value.replace(/[^0-9]/g, ""))} placeholder="no limit" className="input-dark mt-1 w-14 px-2 py-1.5 text-xs" title="Optional: max bookings per Preferred Client during early access" />
          </label>
          <button disabled={busy || !covers} onClick={schedule} className="btn-ghost px-3 py-1.5 text-xs">
            {openAt ? "Schedule release" : "Open this availability now"}
          </button>
          <p className="w-full text-[10px] leading-relaxed text-zinc-600">
            Nothing beyond your released dates is bookable until this opens{ea.trim() ? ` — then Preferred Clients book first for ${ea}h, everyone after` : " — then it opens to everyone at once"}. Capacity always binds everyone.
          </p>
        </div>
      )}
      {err && <p className="mt-1.5 text-[11px] font-medium text-amber-300">{err}</p>}
    </div>
  );
}
