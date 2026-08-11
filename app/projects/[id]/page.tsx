"use client";

/* ------------------------------------------------------------------ */
/*  Project page — the complete WORKSPACE for one engagement.          */
/*  · Live status panel: progress bar, current update, estimated       */
/*    completion, time remaining — real progress_updates rows.         */
/*  · The creator posts progress updates & ETA changes and requests    */
/*    extensions HERE (the Activity feed only mirrors history).        */
/*  · The client decides extensions here (approve / decline).          */
/*  · Timeline generated from real database events — never hard-coded. */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import { EtaPicker, UpdatePreview, combineEta, fmtEta, clampPercent } from "@/components/ProgressComposer";
import { defaultPercentFor } from "@/lib/progressDefaults";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Clock,
  MessageSquare,
  Send,
  Star,
  TimerReset,
} from "lucide-react";
import Avatar from "@/components/Avatar";

interface ProgressRow {
  id: string;
  kind: string;
  status: string;
  statusLabel: string;
  percent: number | null;
  message: string;
  etaAt: string | null;
  prevEtaAt: string | null;
  attachmentUrl: string;
  mine: boolean;
  at: string;
}

interface Detail {
  id: string;
  title: string;
  brief: string;
  amount: number;
  state: string;
  aiRequirement: string;
  deadline: string | null;
  conversationId: string | null;
  myRole: "client" | "creator";
  with: { id: string; handle: string; displayName: string; avatarUrl: string | null; roleLine: string };
  extensions: { id: string; days: number; reason: string; status: string; mine: boolean; createdAt: string }[];
  payments: { id: string; amountCents: number; feeCents: number; status: string }[];
  reviews: { rating: number; body: string; mine: boolean }[];
  progress: {
    latest: { status: string; statusLabel: string; percent: number | null; message: string; at: string } | null;
    etaAt: string | null;
    updates: ProgressRow[];
  };
  timeline: { at: string; label: string; detail?: string; tone: "zinc" | "lime" | "amber" | "violet" }[];
}

const STATE_LABEL: Record<string, string> = {
  draft: "Draft",
  offer_sent: "Awaiting acceptance",
  accepted: "Payment required",
  in_progress: "In progress",
  extension_requested: "Extension requested",
  submitted: "Delivered — awaiting review",
  approved: "Approved — release pending",
  completed: "Completed",
  reviewed: "Completed · Reviewed",
  cancelled: "Cancelled",
};

const STATE_TONE: Record<string, string> = {
  draft: "border-line text-zinc-400",
  offer_sent: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  accepted: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  in_progress: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  extension_requested: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  submitted: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  approved: "border-lime-400/40 bg-lime-400/10 text-lime-300",
  completed: "border-lime-400/40 bg-lime-400/10 text-lime-300",
  reviewed: "border-lime-400/40 bg-lime-400/10 text-lime-300",
  cancelled: "border-line text-zinc-500",
};

const PROGRESS_OPTIONS = [
  ["not_started", "Not started"],
  ["preparing", "Preparing"],
  ["in_progress", "In progress"],
  ["waiting_on_client", "Waiting on client"],
  ["revision", "Revision"],
  ["finalizing", "Finalizing"],
  ["ready_for_review", "Ready for review"],
  ["completed", "Completed"],
] as const;

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtFull = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
  " · " +
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function remaining(iso: string): string | null {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return null;
  const d = ms / 86400_000;
  if (d >= 1.5) return `~${Math.round(d)} days`;
  if (d >= 0.75) return "~1 day";
  const h = ms / 3600_000;
  if (h >= 1) return `~${Math.round(h)} hours`;
  return "under an hour";
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // composer state (creator)
  const [showComposer, setShowComposer] = useState(false);
  const [pStatus, setPStatus] = useState<string>("in_progress");
  const [pPercent, setPPercent] = useState<string>("");
  const [pMessage, setPMessage] = useState("");
  const [pEta, setPEta] = useState("");
  const [pEtaTime, setPEtaTime] = useState("17:00");
  const [pAttach, setPAttach] = useState("");
  // ETA form
  const [showEta, setShowEta] = useState(false);
  const [etaDate, setEtaDate] = useState("");
  const [etaTime, setEtaTime] = useState("17:00");
  const [etaReason, setEtaReason] = useState("");
  // extension form
  const [showExt, setShowExt] = useState(false);
  const [extDays, setExtDays] = useState<number | "custom">(2);
  const [extCustom, setExtCustom] = useState("");
  const [extReason, setExtReason] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Project not available");
      return;
    }
    setProject(d.project);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const call = async (path: string, body: unknown, method = "POST") => {
    setBusy(true);
    setNotice(null);
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setNotice(d.error || "That didn't go through — try again.");
      return false;
    }
    await load();
    return true;
  };

  if (error)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold text-zinc-200">{error}</p>
        <p className="mt-1 text-xs text-zinc-500">Only the client and the creator can see a project.</p>
        <Link href="/calendar" className="btn-ghost mt-4 inline-flex px-4 py-1.5 text-xs">Back to Bookings</Link>
      </div>
    );

  if (!project) return <div className="card mx-auto h-64 max-w-2xl animate-pulse" aria-hidden />;

  const fee = Math.round(project.amount * 5) / 100;
  const payment = project.payments[0];
  const latest = project.progress.latest;
  const eta = project.progress.etaAt;
  const isCreator = project.myRole === "creator";
  const working = ["in_progress", "extension_requested", "submitted", "approved"].includes(project.state);
  const pendingExt = project.extensions.find((e) => e.status === "pending");
  const percent =
    latest?.percent ??
    (["completed", "reviewed", "approved"].includes(project.state) ? 100 : project.state === "submitted" ? 90 : null);

  const dot: Record<string, string> = {
    zinc: "bg-zinc-500",
    lime: "bg-lime-400",
    amber: "bg-amber-400",
    violet: "bg-violet-400",
  };

  /* primary next step per state per role — the server is the authority,
     these buttons only surface what it will accept */
  const nextStep = (() => {
    const s = project.state;
    if (isCreator) {
      if (s === "draft") return { action: "send_offer", label: `Send offer — $${project.amount}` };
      if (s === "in_progress") return { action: "submit", label: "Submit work for review" };
      return null;
    }
    if (s === "offer_sent") return { action: "accept_offer", label: `Accept offer — $${project.amount}` };
    if (s === "accepted") return { action: "start", label: `Pay $${(project.amount + fee).toFixed(2)} to start (TEST PAYMENT)` };
    if (s === "submitted") return { action: "approve", label: "Approve the delivery" };
    if (s === "approved") return { action: "complete", label: `Release $${project.amount} — complete project` };
    return null;
  })();

  const postUpdate = async () => {
    const ok = await call(`/api/projects/${project.id}/progress`, {
      kind: "update",
      status: pStatus,
      percent: pPercent === "" ? null : Number(pPercent),
      message: pMessage,
      etaAt: combineEta(pEta, pEtaTime),
      attachmentUrl: pAttach,
    });
    if (ok) {
      setShowComposer(false);
      setPMessage("");
      setPPercent("");
      setPEta("");
      setPEtaTime("17:00");
      setPAttach("");
    }
  };

  const postEta = async () => {
    if (!etaDate) return setNotice("Pick the new estimated completion date");
    const ok = await call(`/api/projects/${project.id}/progress`, {
      kind: "eta",
      etaAt: combineEta(etaDate, etaTime),
      reason: etaReason,
    });
    if (ok) {
      setShowEta(false);
      setEtaDate("");
      setEtaTime("17:00");
      setEtaReason("");
    }
  };

  const requestExt = async () => {
    const days = extDays === "custom" ? Number(extCustom) : extDays;
    if (!Number.isInteger(days) || days < 1 || days > 30) return setNotice("Extension must be 1–30 days");
    if (!extReason.trim()) return setNotice("A reason is required — the client sees why you need more time");
    const ok = await call(`/api/projects/${project.id}/extension`, { days, reason: extReason });
    if (ok) {
      setShowExt(false);
      setExtReason("");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/calendar" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Bookings
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{project.title}</h1>
          <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${STATE_TONE[project.state]}`}>
            {STATE_LABEL[project.state]}
          </span>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-xs text-amber-200">{notice}</div>
      )}

      {/* ---------------- LIVE PROGRESS PANEL ---------------- */}
      {(working || ["completed", "reviewed"].includes(project.state)) && (
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-100">Project progress</h2>
            {latest && <span className="font-mono text-[10px] tracking-[0.08em] text-zinc-500">updated {ago(latest.at)}</span>}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full rounded-full bg-lime-400 transition-all duration-500"
                style={{ width: `${percent ?? 0}%` }}
              />
            </div>
            <span className="font-mono text-sm font-bold tracking-[0.08em] text-lime-300">
              {percent != null ? `${percent}%` : "—"}
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Current status</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">
                {latest ? `${latest.statusLabel}${latest.percent != null ? ` — ${latest.percent}% complete` : ""}` : STATE_LABEL[project.state]}
              </p>
              {latest?.message && <p className="mt-1 text-xs leading-relaxed text-zinc-400">&ldquo;{latest.message}&rdquo;</p>}
            </div>
            <div className="rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Estimated completion</p>
              {eta ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-zinc-100">{fmtEta(eta)}</p>
                  {remaining(eta) && !["completed", "reviewed"].includes(project.state) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
                      <Clock className="h-3 w-3" /> {remaining(eta)} remaining
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-sm text-zinc-500">Not set</p>
              )}
            </div>
          </div>

          {/* creator controls — the workspace, not the Activity mirror */}
          {isCreator && ["in_progress", "extension_requested", "submitted"].includes(project.state) && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-dashed border-line pt-4">
              <button data-guide="project-progress" onClick={() => { setShowComposer((v) => !v); setShowEta(false); setShowExt(false); }} className="btn-lime px-4 py-1.5 text-xs">
                <Send className="h-3.5 w-3.5" /> Post progress update
              </button>
              <button data-guide="project-eta" onClick={() => { setShowEta((v) => !v); setShowComposer(false); setShowExt(false); }} className="btn-ghost px-4 py-1.5 text-xs">
                <CalendarClock className="h-3.5 w-3.5" /> Update ETA
              </button>
              {project.state === "in_progress" && !pendingExt && (
                <button data-guide="project-extension" onClick={() => { setShowExt((v) => !v); setShowComposer(false); setShowEta(false); }} className="btn-ghost px-4 py-1.5 text-xs">
                  <TimerReset className="h-3.5 w-3.5" /> Request extension
                </button>
              )}
            </div>
          )}

          {/* progress composer */}
          {isCreator && showComposer && (
            <div className="mt-3 space-y-2.5 rounded-xl border border-line bg-card-raised p-3.5">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Current status</span>
                  <select
                    value={pStatus}
                    onChange={(e) => {
                      setPStatus(e.target.value);
                      // the status suggests its typical percent — adjust freely after
                      const d = defaultPercentFor(e.target.value);
                      if (d != null) setPPercent(String(d));
                    }}
                    className="input-dark mt-1 w-full py-1.5 text-xs"
                  >
                    {PROGRESS_OPTIONS.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Progress %</span>
                  <input
                    type="number" min={0} max={100} step={1} inputMode="numeric" value={pPercent}
                    onChange={(e) => setPPercent(clampPercent(e.target.value))}
                    placeholder="% complete (0–100)"
                    className="input-dark mt-1 w-full py-1.5 text-xs"
                    aria-label="Percent complete, 0 to 100"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">What are you currently working on?</span>
                <textarea
                  value={pMessage} onChange={(e) => setPMessage(e.target.value)} rows={2}
                  placeholder="Working on the vocal arrangement and cleaning up the second verse."
                  className="input-dark mt-1 w-full resize-none py-1.5 text-xs"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <EtaPicker date={pEta} time={pEtaTime} onDate={setPEta} onTime={setPEtaTime} />
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Attachment link (optional)</span>
                  <input
                    value={pAttach} onChange={(e) => setPAttach(e.target.value)}
                    placeholder="Link to a preview, file, or mix"
                    className="input-dark mt-1 w-full py-1.5 text-xs"
                  />
                </label>
              </div>
              <UpdatePreview
                statusLabel={(PROGRESS_OPTIONS.find(([v]) => v === pStatus)?.[1] as string) ?? undefined}
                percent={pPercent}
                message={pMessage}
                etaIso={combineEta(pEta, pEtaTime)}
              />
              <button disabled={busy} onClick={postUpdate} className="btn-lime w-full justify-center py-2 text-xs">
                Post update — {project.with.displayName} sees it immediately
              </button>
            </div>
          )}

          {/* ETA change */}
          {isCreator && showEta && (
            <div className="mt-3 space-y-2.5 rounded-xl border border-line bg-card-raised p-3.5">
              <p className="text-xs text-zinc-400">
                {eta ? <>Current estimate: <span className="font-semibold text-zinc-200">{fmtEta(eta)}</span>. </> : null}
                The change is recorded on the timeline and {project.with.displayName} is notified — deadlines never move silently.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">New estimated completion — date &amp; time</span>
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    <input type="date" value={etaDate} onChange={(e) => setEtaDate(e.target.value)} className="input-dark py-1.5 text-xs" aria-label="New estimated completion date" />
                    <input type="time" value={etaTime} onChange={(e) => setEtaTime(e.target.value)} className="input-dark py-1.5 text-xs" aria-label="New estimated completion time" />
                  </div>
                </div>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Reason</span>
                  <input
                    value={etaReason} onChange={(e) => setEtaReason(e.target.value)}
                    placeholder="Additional revisions are taking longer than expected."
                    className="input-dark mt-1 w-full py-1.5 text-xs"
                  />
                </label>
              </div>
              <button disabled={busy} onClick={postEta} className="btn-lime w-full justify-center py-2 text-xs">
                Update estimated completion
              </button>
            </div>
          )}

          {/* extension request */}
          {isCreator && showExt && (
            <div className="mt-3 space-y-2.5 rounded-xl border border-line bg-card-raised p-3.5">
              <p className="text-xs text-zinc-400">
                {project.deadline ? (
                  <>Current deadline: <span className="font-semibold text-zinc-200">{fmt(project.deadline)}</span>. </>
                ) : null}
                {project.with.displayName} must approve — if declined, the original deadline stands.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3].map((d) => (
                  <button
                    key={d}
                    onClick={() => setExtDays(d)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${extDays === d ? "border-lime-400/60 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:text-zinc-200"}`}
                  >
                    +{d} day{d > 1 ? "s" : ""}
                  </button>
                ))}
                <button
                  onClick={() => setExtDays("custom")}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${extDays === "custom" ? "border-lime-400/60 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:text-zinc-200"}`}
                >
                  Custom
                </button>
                {extDays === "custom" && (
                  <input
                    type="number" min={1} max={30} value={extCustom}
                    onChange={(e) => setExtCustom(e.target.value)}
                    placeholder="days"
                    className="input-dark w-20 py-1 text-xs"
                  />
                )}
              </div>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">I need additional time because…</span>
                <textarea
                  value={extReason} onChange={(e) => setExtReason(e.target.value)} rows={2} required
                  placeholder="Waiting for the final vocal files and need additional mixing time."
                  className="input-dark mt-1 w-full resize-none py-1.5 text-xs"
                />
              </label>
              <button disabled={busy} onClick={requestExt} className="btn-lime w-full justify-center py-2 text-xs">
                Send extension request
              </button>
            </div>
          )}
        </section>
      )}

      {/* ---------------- PENDING EXTENSION (client decides) ---------------- */}
      {pendingExt && (
        <section className="rounded-2xl border border-amber-400/40 bg-amber-400/5 p-5">
          <h2 className="text-sm font-bold text-amber-200">Extension request</h2>
          <p className="mt-1.5 text-sm text-zinc-200">
            {pendingExt.mine ? "You" : project.with.displayName} requested{" "}
            <span className="font-bold">{pendingExt.days} additional day{pendingExt.days > 1 ? "s" : ""}</span>.
          </p>
          {pendingExt.reason && <p className="mt-1 text-xs leading-relaxed text-zinc-400">&ldquo;{pendingExt.reason}&rdquo;</p>}
          {project.deadline && (
            <p className="mt-2 font-mono text-[11px] tracking-[0.08em] text-zinc-500">
              {fmt(project.deadline)} → {fmt(new Date(Date.parse(project.deadline) + pendingExt.days * 86400_000).toISOString())}
            </p>
          )}
          {!pendingExt.mine && project.myRole === "client" ? (
            <div data-guide="project-ext-decide" className="mt-3 flex gap-2">
              <button
                disabled={busy}
                onClick={() => call(`/api/extensions/${pendingExt.id}`, { approve: true }, "PATCH")}
                className="btn-lime flex-1 justify-center py-2 text-xs"
              >
                <Check className="h-3.5 w-3.5" /> Approve extension
              </button>
              <button
                disabled={busy}
                onClick={() => call(`/api/extensions/${pendingExt.id}`, { approve: false }, "PATCH")}
                className="btn-ghost flex-1 justify-center py-2 text-xs"
              >
                Decline — keep the deadline
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">Waiting for {project.with.displayName} to decide. The original deadline stands until then.</p>
          )}
        </section>
      )}

      {/* ---------------- next step ---------------- */}
      {nextStep && (
        <button
          disabled={busy}
          onClick={() => call(`/api/projects/${project.id}`, { action: nextStep.action, expectedAmount: project.amount }, "PATCH")}
          data-guide="project-primary"
          className="btn-lime w-full justify-center py-2.5 text-sm"
        >
          {nextStep.label}
        </button>
      )}

      {/* parties + terms — a receipt, money-card DNA */}
      <div className="card-money p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {project.myRole === "client" ? "Provider" : "Client"}
            </p>
            <Link href={`/creator/${project.with.handle}`} className="mt-2 flex items-center gap-2.5">
              <Avatar src={project.with.avatarUrl} initials={project.with.displayName.charAt(0)} size="md" />
              <span>
                <span className="block text-sm font-semibold text-zinc-100">{project.with.displayName}</span>
                <span className="block text-xs text-zinc-500">{project.with.roleLine}</span>
              </span>
            </Link>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Creator payout</span>
              <span className="font-mono font-medium tracking-[0.08em] text-lime-300">${project.amount}</span>
            </div>
            {project.myRole === "client" && (
              <div className="flex justify-between text-xs text-zinc-500">
                <span>You pay (incl. 5% fee)</span>
                <span className="font-mono tracking-[0.08em]">${(project.amount + fee).toFixed(2)}</span>
              </div>
            )}
            {project.deadline && (
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Deadline</span>
                <span className="font-mono tracking-[0.08em]">{fmt(project.deadline)}</span>
              </div>
            )}
            {eta && eta !== project.deadline && (
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Est. completion</span>
                <span className="font-mono tracking-[0.08em]">{fmtEta(eta)}</span>
              </div>
            )}
            {payment && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Payment</span>
                <span className={`inline-flex items-center gap-1.5 font-semibold ${payment.status === "released" ? "text-lime-300" : "text-amber-300"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${payment.status === "released" ? "bg-lime-400" : "bg-amber-400"}`} />
                  {payment.status === "held" ? "Secured" : payment.status === "released" ? "Released" : payment.status}
                </span>
              </div>
            )}
          </div>
        </div>

        {project.brief && (
          <div className="mt-4 border-t border-dashed border-line pt-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Brief</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{project.brief}</p>
          </div>
        )}

        <div className="mt-4 flex gap-2 border-t border-dashed border-line pt-4">
          {project.conversationId && (
            <Link href={`/messages?c=${project.conversationId}`} className="btn-lime px-4 py-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" /> Message {project.with.displayName.split(" ")[0]}
            </Link>
          )}
          <Link href={`/creator/${project.with.handle}`} className="btn-ghost px-4 py-1.5 text-xs">
            View profile
          </Link>
        </div>
      </div>

      {/* transaction safety banner — every project carries it */}
      <div className="rounded-xl border border-line-soft bg-card px-4 py-2.5">
        <p className="text-[11px] leading-relaxed text-zinc-500">
          <span className="font-bold uppercase tracking-wide text-zinc-400">Mavyn transaction</span> ·
          Keep communication, agreements, and payments on Mavyn to maintain your transaction
          protections. Transactions completed outside Mavyn may not be protected by Mavyn&apos;s
          dispute or payment systems.
        </p>
      </div>

      {/* reviews */}
      {project.reviews.length > 0 && (
        <section className="card p-5">
          <h2 className="text-sm font-bold text-zinc-100">Reviews</h2>
          <div className="mt-3 space-y-2.5">
            {project.reviews.map((r, i) => (
              <div key={i} className="rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                  {r.mine ? "Your review" : `${project.with.displayName}'s review`}
                  <span className="flex items-center gap-0.5 text-amber-300">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {r.rating.toFixed(1)}
                  </span>
                </p>
                {r.body && <p className="mt-1 text-xs leading-relaxed text-zinc-400">{r.body}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- TIMELINE — generated from real records ---------------- */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100">Project timeline</h2>
        <p className="mt-0.5 text-[11px] text-zinc-500">Every entry is a real database event — nothing here is decorative.</p>
        <ol className="mt-4 space-y-3 border-l border-line pl-4">
          {project.timeline.map((a, i) => (
            <li key={i} className="relative">
              <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card ${dot[a.tone ?? "zinc"]}`} />
              <p className="text-sm text-zinc-200">{a.label}</p>
              {a.detail && <p className="mt-0.5 text-xs text-zinc-500">&ldquo;{a.detail}&rdquo;</p>}
              <p className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-zinc-600">{fmtFull(a.at)}</p>
            </li>
          ))}
          <li className="relative">
            <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card ${["completed", "reviewed"].includes(project.state) ? "bg-lime-400" : "bg-violet-400"}`} />
            <p className="text-sm font-semibold text-zinc-100">Current status: {STATE_LABEL[project.state]}</p>
          </li>
        </ol>
      </section>
    </div>
  );
}
