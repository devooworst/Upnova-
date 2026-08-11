"use client";

/* ------------------------------------------------------------------ */
/*  Messages — fully database-backed.                                  */
/*                                                                     */
/*  · Conversation list = MY conversations from the DB                 */
/*  · ?to=<handle> opens (or creates) the conversation with THAT user  */
/*  · ?c=<conversationId> / ?project=<projectId> deep-link precisely   */
/*  · The project panel drives the real state machine:                 */
/*      draft → offer_sent → accepted → in_progress →                  */
/*      extension_requested → submitted → approved → completed →       */
/*      reviewed                                                       */
/*  Extension requests are persistent DB rows — reload all you want,   */
/*  they never recreate themselves.                                    */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Send, ChevronLeft, Briefcase, Flag, X, Star, Check } from "lucide-react";
import Avatar from "@/components/Avatar";
import ReportModal from "@/components/ReportModal";
import PosterBadge, { posterTypeOf } from "@/components/PosterBadge";
import { useSession } from "@/lib/session";

/* ------------------------------- types ------------------------------- */

interface ConvUser {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  roleLine: string;
  accountType?: string;
  businessVerified?: boolean;
}

interface Conv {
  id: string;
  with: ConvUser | null;
  lastMessage: { body: string; createdAt: string; mine: boolean } | null;
  unread: number;
  projectId: string | null;
  projectState: string | null;
  booking: { id: string; title: string; startsAt: string; status: string; progress?: string; price: number; myRole?: string } | null;
}

interface Msg {
  id: string;
  body: string;
  kind?: "text" | "system";
  mine: boolean;
  createdAt: string;
}

interface Extension {
  id: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "denied";
  mine: boolean;
}

interface ProjectDetail {
  id: string;
  title: string;
  brief: string;
  amount: number;
  state: string;
  deadline: string | null;
  conversationId: string | null;
  myRole: "client" | "creator";
  with: ConvUser;
  extensions: Extension[];
  payments: { id: string; amountCents: number; feeCents: number; status: string }[];
  reviews: { rating: number; body: string; mine: boolean }[];
}

const STATE_LABEL: Record<string, string> = {
  draft: "Draft",
  offer_sent: "Offer sent",
  accepted: "Accepted",
  in_progress: "In progress",
  extension_requested: "Extension requested",
  submitted: "Delivered",
  approved: "Approved",
  completed: "Completed",
  reviewed: "Reviewed",
  cancelled: "Cancelled",
};

const STEPS = ["draft", "offer_sent", "accepted", "in_progress", "submitted", "approved", "completed", "reviewed"];
const stepIndex = (state: string) => (state === "extension_requested" ? 3 : STEPS.indexOf(state));

function timeAgo(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/* =============================== main =============================== */

export default function DbMessages() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useSession();

  const [convos, setConvos] = useState<Conv[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messagesById, setMessagesById] = useState<Record<string, Msg[]>>({});
  const [draft, setDraft] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const deepLinked = useRef(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const loadConvos = useCallback(async () => {
    const res = await fetch("/api/conversations", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setConvos(data.conversations ?? []);
    return data.conversations as Conv[];
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    const res = await fetch(`/api/conversations/${convId}/messages`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setMessagesById((m) => ({ ...m, [convId]: data.messages ?? [] }));
  }, []);

  const loadProject = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}`, { cache: "no-store" });
    if (!res.ok) {
      setProject(null);
      return;
    }
    const data = await res.json();
    setProject(data.project);
  }, []);

  /* initial load + deep links */
  useEffect(() => {
    if (!user) return;
    (async () => {
      const list = (await loadConvos()) ?? [];
      if (deepLinked.current) return;
      deepLinked.current = true;

      const to = params.get("to");
      const c = params.get("c");
      const proj = params.get("project");

      if (to) {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toHandle: to }),
        });
        const data = await res.json().catch(() => ({} as { error?: string }));
        if (res.ok) {
          await loadConvos();
          setActiveId(data.conversationId);
          return;
        }
        // NEVER fall back to another person's conversation. The person you
        // picked is the person you get — or an honest error, nothing else.
        setLinkError(
          `Couldn't open a conversation with @${to} — ${(data as { error?: string }).error || "this account isn't on Mavyn"}. No other conversation was opened in its place.`
        );
        if (list.length > 0) setActiveId(null);
        return;
      }
      if (c) {
        // only select the requested thread if it's actually YOURS
        if (list.some((x) => x.id === c)) {
          setActiveId(c);
        } else {
          setLinkError("That conversation link doesn't belong to your account.");
        }
        return;
      }
      if (proj) {
        const res = await fetch(`/api/projects/${proj}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.project?.conversationId) {
            setActiveId(data.project.conversationId);
            setPanelOpen(true);
            return;
          }
        }
      }
      if (list.length > 0) setActiveId(list[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* thread + project sync on selection */
  const active = convos?.find((x) => x.id === activeId) ?? null;
  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId);
    const conv = convos?.find((x) => x.id === activeId);
    if (conv?.projectId) loadProject(conv.projectId);
    else setProject(null);
    const iv = setInterval(() => loadMessages(activeId), 6000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, convos?.find((x) => x.id === activeId)?.projectId]);

  useEffect(() => {
    // scroll ONLY the message pane — scrollIntoView walks every scrollable
    // ancestor including the WINDOW, which slid the whole card (list header
    // + chat header with the Project button) underneath the fixed navbar
    const box = bottomRef.current?.parentElement;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [messagesById[activeId ?? ""]?.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !activeId) return;
    setDraft("");
    await fetch(`/api/conversations/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    loadMessages(activeId);
    loadConvos();
  };

  const refreshAll = async () => {
    await loadConvos();
    if (active?.projectId) await loadProject(active.projectId);
    if (activeId) await loadMessages(activeId);
  };

  const offPlatform = /cash\s?app|venmo|zelle|paypal\.me|wire\s?transfer/i.test(draft);
  const messages = activeId ? (messagesById[activeId] ?? null) : null;

  if (user === null)
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <p className="text-sm font-semibold text-zinc-200">Create an account to message people</p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
          Messages, bookings, and payments live in one thread — that requires knowing who you are.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/signup" className="btn-lime px-5 py-2 text-sm">Create account</Link>
          <Link href="/login" className="btn-ghost px-4 py-2 text-sm">Sign in</Link>
        </div>
      </div>
    );

  return (
    <div className="flex h-[calc(100vh-8.5rem)] overflow-hidden rounded-2xl border border-line bg-card">
      {/* ---------------------------- list ---------------------------- */}
      <aside className={`w-full shrink-0 border-r border-line sm:w-72 ${activeId ? "hidden sm:block" : ""}`}>
        <div className="border-b border-line px-4 py-3.5">
          <h2 className="text-sm font-bold text-zinc-100">Messages</h2>
        </div>
        <div className="h-full overflow-y-auto pb-16">
          {convos === null ? (
            <p className="p-4 text-xs text-zinc-500">Loading…</p>
          ) : convos.length === 0 ? (
            <p className="p-4 text-xs leading-relaxed text-zinc-500">
              No conversations yet. Open one from any profile, service, or opportunity — Message and
              Hire Me both land here.
            </p>
          ) : (
            convos.map((c) => (
              <button
                key={c.id}
                data-guide={`conversation-${c.with?.handle ?? ""}`}
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                  c.id === activeId ? "bg-card-raised" : "hover:bg-card-raised/50"
                }`}
              >
                <Avatar src={c.with?.avatarUrl} initials={c.with?.displayName.charAt(0) ?? "?"} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                    <span className="truncate">{c.with?.displayName ?? "Unknown"}</span>
                    {c.projectState && (
                      <span className="shrink-0 rounded-full border border-lime-400/40 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-lime-300">
                        {STATE_LABEL[c.projectState]}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {c.lastMessage ? `${c.lastMessage.mine ? "You: " : ""}${c.lastMessage.body}` : "New conversation"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {c.lastMessage && <span className="text-[10px] text-zinc-600">{timeAgo(c.lastMessage.createdAt)}</span>}
                  {c.unread > 0 && <span className="h-2 w-2 rounded-full bg-violet-400" />}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ---------------------------- thread ---------------------------- */}
      <section className={`flex min-w-0 flex-1 flex-col ${!activeId ? "hidden sm:flex" : ""}`}>
        {!active ? (
          linkError ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="max-w-sm rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-center">
                <p className="text-sm font-semibold text-red-300">Couldn&apos;t open that conversation</p>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{linkError}</p>
                <button onClick={() => setLinkError(null)} className="btn-ghost mt-3 px-4 py-1.5 text-xs">
                  Back to your messages
                </button>
              </div>
            </div>
          ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-zinc-500">Select a conversation.</p>
          </div>
          )
        ) : (
          <>
            {/* header */}
            <div data-guide={`chat-with-${active.with?.handle ?? ""}`} className="flex items-center gap-3 border-b border-line px-4 py-3">
              <button onClick={() => setActiveId(null)} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200 sm:hidden">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Link href={`/creator/${active.with?.handle}`}>
                <Avatar src={active.with?.avatarUrl} initials={active.with?.displayName.charAt(0) ?? "?"} size="sm" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-zinc-100">
                  <span className="truncate">{active.with?.displayName}</span>
                  {active.with?.accountType === "business" && (
                    <PosterBadge type={posterTypeOf(active.with)} />
                  )}
                </p>
                <p className="truncate text-[11px] text-zinc-500">{active.with?.roleLine || `@${active.with?.handle}`}</p>
              </div>
              <button
                data-guide="chat-project"
                onClick={() => setPanelOpen(!panelOpen)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  project
                    ? "border-lime-400/40 text-lime-300 hover:bg-lime-400/10"
                    : "border-line text-zinc-300 hover:border-zinc-600"
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                {project ? STATE_LABEL[project.state] : "Project"}
              </button>
              <button onClick={() => setReportOpen(true)} className="rounded-md p-1.5 text-zinc-500 hover:text-zinc-300" title="Report">
                <Flag className="h-4 w-4" />
              </button>
            </div>

            {/* booking context — the conversation and the booking are one
                record, linked by ids. The stage strip shows the live
                lifecycle: Requested → Accepted → Confirmed → Preparing →
                In progress → Completed. */}
            {active.booking && !["cancelled"].includes(active.booking.status) && (
              <Link
                href={`/activity?focus=booking:${active.booking.id}`}
                title="Open the full live timeline"
                className="flex items-center gap-1 overflow-x-auto border-b border-line-soft px-4 py-1.5 transition hover:bg-card-raised">
                {(() => {
                  const b = active.booking!;
                  const stages = ["Requested", "Accepted", "Confirmed", "Preparing", "In progress", "Completed"];
                  const idx =
                    b.status === "completed" ? 5
                    : b.status === "confirmed" ? (b.progress === "in_progress" ? 4 : b.progress === "preparing" ? 3 : 2)
                    : b.status === "accepted" ? 1
                    : 0;
                  return stages.map((label, i) => (
                    <span key={label} className="flex shrink-0 items-center gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide ${
                          i < idx ? "text-zinc-500" : i === idx ? (idx === 5 ? "bg-lime-400/15 text-lime-300" : "bg-violet-400/15 text-violet-300") : "text-zinc-700"
                        }`}
                      >
                        {label}
                      </span>
                      {i < stages.length - 1 && <span className="h-px w-2 bg-line" />}
                    </span>
                  ));
                })()}
              </Link>
            )}
            {active.booking && (
              <div className="flex items-center gap-2.5 border-b border-line-soft px-4 py-2">
                <span
                  className={`h-6 w-1 shrink-0 rounded-full ${
                    active.booking.status === "confirmed"
                      ? "bg-lime-400"
                      : ["pending", "accepted"].includes(active.booking.status)
                        ? "bg-amber-400"
                        : active.booking.status === "reschedule_requested"
                          ? "bg-violet-400"
                          : active.booking.status === "completed"
                            ? "bg-zinc-500"
                            : "bg-rose-400"
                  }`}
                />
                <p className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                  <span className="font-semibold text-zinc-100">{active.booking.title}</span>
                  <span className="text-zinc-500">
                    {" "}· {new Date(active.booking.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
                    {new Date(active.booking.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ·{" "}
                  </span>
                  <span className="font-medium capitalize text-zinc-300">{active.booking.status.replace("_", " ")}</span>
                </p>
                <Link href={`/activity?focus=booking:${active.booking.id}`} className="shrink-0 text-[11px] font-semibold text-lime-300 hover:underline">
                  Live timeline →
                </Link>
              </div>
            )}

            {/* project stepper strip */}
            {project && (
              <div className="flex items-center gap-1 border-b border-line-soft px-4 py-2">
                {STEPS.slice(1).map((s, i) => {
                  const idx = stepIndex(project.state);
                  const done = idx >= i + 1;
                  return (
                    <div key={s} className="flex min-w-0 flex-1 items-center gap-1">
                      <span
                        className={`h-1.5 w-full rounded-full ${
                          done ? (project.state === "extension_requested" && i + 1 === 3 ? "bg-amber-400" : "bg-lime-400") : "bg-card-raised"
                        }`}
                      />
                    </div>
                  );
                })}
                <span className="ml-2 shrink-0 font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                  {STATE_LABEL[project.state]}
                </span>
              </div>
            )}

            {/* messages */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages === null ? (
                <p className="text-xs text-zinc-500">Loading…</p>
              ) : (
                messages.map((m) =>
                  m.kind === "system" ? (
                    /* project events render inline — the thread shows the
                       transaction progressing */
                    <div key={m.id} className="flex justify-center">
                      <p className="max-w-[85%] rounded-full border border-line-soft bg-card-raised/60 px-3.5 py-1.5 text-center text-[11px] leading-relaxed text-zinc-400">
                        {m.body}
                        <span className="ml-1.5 text-[9px] text-zinc-600">{timeAgo(m.createdAt)}</span>
                      </p>
                    </div>
                  ) : (
                    <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                          m.mine ? "rounded-br-md bg-violet-400 text-zinc-950" : "rounded-bl-md bg-card-raised text-zinc-200"
                        }`}
                      >
                        {m.body}
                        <span className={`mt-0.5 block text-right text-[9px] ${m.mine ? "text-zinc-800" : "text-zinc-600"}`}>
                          {timeAgo(m.createdAt)}
                        </span>
                      </div>
                    </div>
                  )
                )
              )}
              <div ref={bottomRef} />
            </div>

            {/* the platform recognizes a deal forming — offer the next step */}
            {!project &&
              messages &&
              messages.slice(-8).some((m) => m.kind !== "system" && /\$\s?\d{2,}/.test(m.body)) && (
                <div className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-xl border border-lime-400/30 bg-lime-400/5 px-3.5 py-2">
                  <p className="text-xs text-zinc-300">
                    <span className="font-semibold text-lime-300">Talking numbers?</span> Turn this into a
                    project so the payment is protected.
                  </p>
                  <button onClick={() => setPanelOpen(true)} className="btn-lime shrink-0 px-3 py-1 text-[11px]">
                    Create project
                  </button>
                </div>
              )}

            {/* off-platform tripwire */}
            {offPlatform && (
              <div className="mx-4 mb-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-2 text-xs text-amber-300">
                Keep payments on Mavyn — off-platform payments aren&apos;t protected, and we can&apos;t help
                if something goes wrong.
              </div>
            )}

            {/* composer */}
            <div data-guide="chat-composer" className="flex items-center gap-2 border-t border-line px-4 py-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={`Message ${active.with?.displayName ?? ""}…`}
                className="min-w-0 flex-1 rounded-full border border-line bg-card-raised px-4 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
              />
              <button onClick={send} disabled={!draft.trim()} className="rounded-full bg-violet-400 p-2 text-zinc-950 transition hover:bg-violet-300 disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </section>

      {/* ---------------------------- project panel ---------------------------- */}
      {panelOpen && active && (
        <ProjectPanel
          conv={active}
          project={project}
          onClose={() => setPanelOpen(false)}
          onChanged={refreshAll}
        />
      )}

      {reportOpen && active && (
        <ReportModal
          context={`Conversation with ${active.with?.displayName ?? "user"}`}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}

/* =========================== project panel =========================== */

function ProjectPanel({
  conv,
  project,
  onClose,
  onChanged,
}: {
  conv: Conv;
  project: ProjectDetail | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [paid, setPaid] = useState(false);

  // create form
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [brief, setBrief] = useState("");
  const [deadline, setDeadline] = useState("");

  // QA GUIDED INPUTS — "Fill example data" populates the draft form with
  // safe demo values. It NEVER submits: the tester reviews and presses
  // the real Create button; the checkpoint verifies only the database.
  useEffect(() => {
    const onFill = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.form !== "project-draft") return;
      const v = d.values ?? {};
      if (typeof v.title === "string") setTitle(v.title);
      if (v.amount != null) setAmount(String(v.amount).replace(/[^0-9]/g, ""));
      if (typeof v.brief === "string") setBrief(v.brief);
      if (typeof v.deadline === "string") setDeadline(v.deadline);
    };
    window.addEventListener("mavyn:qa-fill", onFill);
    return () => window.removeEventListener("mavyn:qa-fill", onFill);
  }, []);
  const [asCreator, setAsCreator] = useState(false);
  // notes for deliver / revision / decline
  const [deliverNote, setDeliverNote] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionOpen, setRevisionOpen] = useState(false);
  // creator-side term editing (draft / offer_sent only)
  const [termsOpen, setTermsOpen] = useState(false);
  const [termAmount, setTermAmount] = useState("");
  // extension form
  const [extDays, setExtDays] = useState("2");
  const [extReason, setExtReason] = useState("");
  const [extFormOpen, setExtFormOpen] = useState(false);
  // review form
  const [rating, setRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");

  const run = async (fn: () => Promise<Response>) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return false;
    }
    await onChanged();
    return true;
  };

  const act = (action: string, extra: Record<string, unknown> = {}) => () =>
    run(() =>
      fetch(`/api/projects/${project!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
    );

  const fee = project ? Math.round(project.amount * 0.05 * 100) / 100 : 0;
  const pendingExt = project?.extensions.find((e) => e.status === "pending") ?? null;
  const myReview = project?.reviews.find((r) => r.mine) ?? null;

  return (
    <aside className="absolute inset-y-0 right-0 z-20 w-full max-w-sm overflow-y-auto border-l border-line bg-card p-5 shadow-card sm:relative sm:z-0">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Project</p>
          <h3 className="mt-1 text-sm font-bold text-zinc-100">
            {project ? project.title : `Work with ${conv.with?.displayName ?? ""}`}
          </h3>
          {project && (
            <Link href={`/projects/${project.id}`} className="mt-0.5 inline-block text-[11px] font-semibold text-violet-300 hover:underline">
              View full project →
            </Link>
          )}
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-400/5 px-3 py-2 text-xs font-medium text-rose-300">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" /> {error}
        </p>
      )}

      {/* ------------------------- no project yet ------------------------- */}
      {!project && (
        <div className="mt-4 space-y-2.5">
          <p className="text-xs leading-relaxed text-zinc-500">
            Turn this conversation into a real project — agreed terms, protected payment, clear steps.
          </p>
          <div className="flex gap-1.5 rounded-xl border border-line bg-card-raised p-1">
            <button
              onClick={() => setAsCreator(false)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
                !asCreator ? "bg-lime-400/15 text-lime-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              I&apos;m hiring {conv.with?.displayName.split(" ")[0]}
            </button>
            <button
              onClick={() => setAsCreator(true)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
                asCreator ? "bg-lime-400/15 text-lime-300" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              I&apos;m doing the work
            </button>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" className="w-full rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50" />
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Amount (creator payout)" className="w-full rounded-xl border border-line bg-card-raised py-2.5 pl-7 pr-3.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50" />
          </div>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} placeholder="Brief — what exactly needs to happen?" className="w-full resize-none rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50" />
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none focus:border-lime-400/50" />
          {amount && (
            <p className="font-mono text-[11px] tracking-[0.08em] text-zinc-500">
              {asCreator
                ? `YOUR PAYOUT $${amount} · THEY PAY $${(Number(amount) * 1.05).toFixed(2)} (5% fee)`
                : `PAYOUT $${amount} · YOU PAY $${(Number(amount) * 1.05).toFixed(2)} (5% platform fee)`}
            </p>
          )}
          <button
            disabled={busy || !title.trim() || !amount}
            onClick={() =>
              run(() =>
                fetch("/api/projects", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...(asCreator
                      ? { clientHandle: conv.with?.handle, asCreator: true }
                      : { creatorHandle: conv.with?.handle }),
                    title,
                    amount: Number(amount),
                    brief,
                    deadline: deadline || undefined,
                    conversationId: conv.id,
                  }),
                })
              )
            }
            data-guide="project-create-draft"
            className="btn-lime w-full justify-center py-2 text-sm disabled:opacity-40"
          >
            {asCreator ? "Create project — then send the offer" : "Create project draft"}
          </button>
        </div>
      )}

      {/* --------------------------- with project --------------------------- */}
      {project && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-line bg-card-raised p-3.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Creator payout</span>
              <span className="font-mono font-medium tracking-[0.08em] text-lime-300">${project.amount}</span>
            </div>
            {project.myRole === "client" && (
              <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                <span>You pay (incl. 5% fee)</span>
                <span className="font-mono tracking-[0.08em]">${(project.amount + fee).toFixed(2)}</span>
              </div>
            )}
            {project.deadline && (
              <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                <span>Deadline</span>
                <span className="font-mono tracking-[0.08em]">
                  {new Date(project.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            )}
            {project.payments.map((p) => (
              <div key={p.id} className="mt-1 flex items-center justify-between text-xs">
                <span className="text-zinc-500">Payment</span>
                <span className={`inline-flex items-center gap-1.5 font-semibold ${p.status === "released" ? "text-lime-300" : "text-amber-300"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${p.status === "released" ? "bg-lime-400" : "bg-amber-400"}`} />
                  {p.status === "held" ? "Secured" : p.status === "released" ? "Released" : p.status}
                </span>
              </div>
            ))}
          </div>

          {project.brief && <p className="text-xs leading-relaxed text-zinc-400">{project.brief}</p>}

          {/* pending extension — persistent, decided once */}
          {pendingExt && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-3.5">
              <p className="text-xs font-bold text-amber-300">
                Extension requested · +{pendingExt.days} day{pendingExt.days === 1 ? "" : "s"}
              </p>
              {pendingExt.reason && <p className="mt-1 text-xs text-zinc-400">{pendingExt.reason}</p>}
              {!pendingExt.mine && project.myRole === "client" ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button disabled={busy} onClick={() => run(() => fetch(`/api/extensions/${pendingExt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approve: true }) }))} className="btn-lime px-3.5 py-1.5 text-xs">
                    Approve Extension · +{pendingExt.days} days
                  </button>
                  <button
                    onClick={onClose}
                    title="Talk it over in the conversation — the request stays pending until you decide"
                    className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-violet-400/40 hover:text-violet-300"
                  >
                    Discuss
                  </button>
                  <button disabled={busy} onClick={() => run(() => fetch(`/api/extensions/${pendingExt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approve: false }) }))} className="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-rose-300">
                    Decline
                  </button>
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] text-zinc-500">Waiting for the client to decide.</p>
              )}
            </div>
          )}
          {project.extensions
            .filter((e) => e.status !== "pending")
            .map((e) => (
              <p key={e.id} className={`flex items-center gap-1.5 text-[11px] ${e.status === "approved" ? "text-lime-300" : "text-zinc-500"}`}>
                <Check className="h-3 w-3" /> Extension {e.status} · +{e.days} days
              </p>
            ))}

          {/* ------------------- actions by state × role ------------------- */}
          <div className="space-y-2">
            {project.state === "draft" && project.myRole === "creator" && (
              <>
                <button disabled={busy} onClick={act("send_offer")} data-guide="project-send-offer" className="btn-lime w-full justify-center py-2 text-sm">
                  Send offer · ${project.amount}
                </button>
                <TermsEditor
                  open={termsOpen}
                  setOpen={setTermsOpen}
                  amount={termAmount}
                  setAmount={setTermAmount}
                  current={project.amount}
                  busy={busy}
                  onSave={(n) => run(() => fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_terms", amount: n }) }))}
                />
              </>
            )}
            {project.state === "draft" && project.myRole === "client" && (
              <p className="text-xs text-zinc-500">
                Draft created. Waiting for {project.with.displayName} to review and send the offer.
              </p>
            )}
            {project.state === "offer_sent" && project.myRole === "client" && (
              <div className="rounded-xl border border-lime-400/30 bg-lime-400/5 p-3.5">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-lime-300">
                  Review project — confirm before you commit
                </p>
                <dl className="mt-2.5 space-y-1 text-xs">
                  <div className="flex justify-between"><dt className="text-zinc-500">Provider</dt><dd className="font-medium text-zinc-200">{project.with.displayName}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">Price</dt><dd className="font-mono font-medium tracking-[0.08em] text-lime-300">${project.amount}</dd></div>
                  {project.deadline && (
                    <div className="flex justify-between"><dt className="text-zinc-500">Delivery</dt><dd className="font-mono tracking-[0.08em] text-zinc-200">{new Date(project.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</dd></div>
                  )}
                  <div className="flex justify-between"><dt className="text-zinc-500">You pay (incl. 5% fee)</dt><dd className="font-mono tracking-[0.08em] text-zinc-200">${(project.amount + fee).toFixed(2)}</dd></div>
                </dl>
                {project.brief && <p className="mt-2 border-t border-line-soft pt-2 text-xs leading-relaxed text-zinc-400">{project.brief}</p>}
                <div className="mt-3 space-y-1.5">
                  <button disabled={busy} onClick={act("accept_offer", { expectedAmount: project.amount })} className="btn-lime w-full justify-center py-2 text-sm">
                    Accept &amp; Continue · ${project.amount}
                  </button>
                  <div className="flex gap-1.5">
                    <button
                      disabled={busy}
                      onClick={() => {
                        const note = window.prompt("What should change about this offer?") ?? "";
                        run(() => fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "decline_offer", note }) }));
                      }}
                      className="flex-1 rounded-full border border-line py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600"
                    >
                      Request Changes
                    </button>
                    <button disabled={busy} onClick={act("cancel")} className="flex-1 rounded-full border border-line py-1.5 text-xs font-medium text-zinc-500 transition hover:border-rose-400/40 hover:text-rose-300">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            {project.state === "offer_sent" && project.myRole === "creator" && (
              <>
                <p className="text-xs text-zinc-500">Offer sent — waiting for {project.with.displayName} to review and accept.</p>
                <TermsEditor
                  open={termsOpen}
                  setOpen={setTermsOpen}
                  amount={termAmount}
                  setAmount={setTermAmount}
                  current={project.amount}
                  busy={busy}
                  onSave={(n) => run(() => fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_terms", amount: n }) }))}
                />
              </>
            )}
            {project.state === "accepted" && project.myRole === "client" && (
              <button disabled={busy} onClick={() => setPayOpen(true)} className="btn-lime w-full justify-center py-2 text-sm">
                Pay ${(project.amount + fee).toFixed(2)}
              </button>
            )}
            {project.state === "accepted" && project.myRole === "creator" && (
              <p className="text-xs text-zinc-500">Accepted — waiting for the payment to be secured.</p>
            )}
            {project.state === "cancelled" && (
              <p className="rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-xs text-zinc-500">
                This project was cancelled before payment. No money moved. Start a new project any time.
              </p>
            )}
            {project.state === "in_progress" && project.myRole === "creator" && (
              <>
                <input
                  value={deliverNote}
                  onChange={(e) => setDeliverNote(e.target.value)}
                  placeholder='What are you delivering? e.g. "BrandGuide.pdf — final logo + palette"'
                  className="w-full rounded-xl border border-line bg-card-raised px-3.5 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
                />
                <button disabled={busy} onClick={act("submit", { note: deliverNote })} className="btn-lime w-full justify-center py-2 text-sm">
                  Deliver for review
                </button>
                {!extFormOpen ? (
                  <button onClick={() => setExtFormOpen(true)} className="w-full rounded-full border border-line py-2 text-xs font-medium text-zinc-400 transition hover:border-amber-400/40 hover:text-amber-300">
                    Request extension
                  </button>
                ) : (
                  <div className="rounded-xl border border-line bg-card-raised p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input value={extDays} onChange={(e) => setExtDays(e.target.value.replace(/[^0-9]/g, ""))} className="w-16 rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-zinc-100 outline-none" />
                      <span className="text-xs text-zinc-500">days</span>
                    </div>
                    <input value={extReason} onChange={(e) => setExtReason(e.target.value)} placeholder="Reason (the client sees this)" className="w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600" />
                    <div className="flex gap-2">
                      <button
                        disabled={busy || !extDays}
                        onClick={async () => {
                          const ok = await run(() =>
                            fetch(`/api/projects/${project.id}/extension`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ days: Number(extDays), reason: extReason }),
                            })
                          );
                          if (ok) setExtFormOpen(false);
                        }}
                        className="rounded-full bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-zinc-950"
                      >
                        Request
                      </button>
                      <button onClick={() => setExtFormOpen(false)} className="text-xs text-zinc-500">Cancel</button>
                    </div>
                  </div>
                )}
              </>
            )}
            {project.state === "in_progress" && project.myRole === "client" && (
              <p className="text-xs text-zinc-500">
                In progress — {project.with.displayName} is working. You&apos;ll review the delivery here.
              </p>
            )}
            {project.state === "submitted" && project.myRole === "client" && (
              <>
                <button disabled={busy} onClick={act("approve")} className="btn-lime w-full justify-center py-2 text-sm">
                  Approve delivery
                </button>
                {!revisionOpen ? (
                  <div className="flex gap-1.5">
                    <button onClick={() => setRevisionOpen(true)} className="flex-1 rounded-full border border-line py-2 text-xs font-medium text-zinc-400 hover:border-zinc-600">
                      Request Revision
                    </button>
                    <button onClick={onClose} className="flex-1 rounded-full border border-line py-2 text-xs font-medium text-zinc-400 transition hover:border-violet-400/40 hover:text-violet-300">
                      Discuss
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 rounded-xl border border-line bg-card-raised p-3">
                    <input
                      value={revisionNote}
                      onChange={(e) => setRevisionNote(e.target.value)}
                      placeholder="Tell them what needs to change…"
                      autoFocus
                      className="w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600"
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={busy}
                        onClick={async () => {
                          const ok = await run(() => fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request_changes", note: revisionNote }) }));
                          if (ok) {
                            setRevisionOpen(false);
                            setRevisionNote("");
                          }
                        }}
                        className="btn-lime px-3.5 py-1.5 text-xs"
                      >
                        Send revision request
                      </button>
                      <button onClick={() => setRevisionOpen(false)} className="text-xs text-zinc-500">Cancel</button>
                    </div>
                    <p className="text-[10px] text-zinc-600">The project stays active — payment stays secured.</p>
                  </div>
                )}
              </>
            )}
            {project.state === "submitted" && project.myRole === "creator" && (
              <p className="text-xs text-zinc-500">Delivered — waiting for {project.with.displayName} to review.</p>
            )}
            {project.state === "approved" && project.myRole === "client" && (
              <button disabled={busy} onClick={act("complete")} className="btn-lime w-full justify-center py-2 text-sm">
                Release payment · ${project.amount}
              </button>
            )}
            {project.state === "approved" && project.myRole === "creator" && (
              <p className="text-xs text-zinc-500">Approved — payment release is next.</p>
            )}

            {(project.state === "completed" || project.state === "reviewed") && (
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-lime-300">
                  <Check className="h-3.5 w-3.5" /> Completed — ${project.amount} released
                </p>
                {project.reviews.map((r, i) => (
                  <div key={i} className="rounded-xl border border-line bg-card-raised px-3 py-2 text-xs">
                    <p className="flex items-center gap-1 font-semibold text-zinc-200">
                      {r.mine ? "Your review" : `${project.with.displayName}'s review`}
                      <span className="ml-1 flex items-center gap-0.5 text-amber-300">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {r.rating.toFixed(1)}
                      </span>
                    </p>
                    {r.body && <p className="mt-1 text-zinc-400">{r.body}</p>}
                  </div>
                ))}
                {!myReview && project.state !== "reviewed" && (
                  <div data-guide="project-review" className="rounded-xl border border-line bg-card-raised p-3 space-y-2">
                    <p className="text-xs font-bold text-zinc-200">Review {project.with.displayName}</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setRating(n)}>
                          <Star className={`h-5 w-5 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-600"}`} />
                        </button>
                      ))}
                    </div>
                    <textarea value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} rows={2} placeholder="How did it go?" className="w-full resize-none rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600" />
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          fetch(`/api/projects/${project.id}/review`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ rating, body: reviewBody }),
                          })
                        )
                      }
                      className="btn-lime px-3.5 py-1.5 text-xs"
                    >
                      Post review
                    </button>
                  </div>
                )}
                {project.state === "reviewed" && (
                  <p className="text-[11px] text-zinc-500">Both sides reviewed — project closed.</p>
                )}
              </div>
            )}
          </div>

          <p className="rounded-lg border border-line-soft bg-card-raised/50 px-3 py-2.5 text-[10px] leading-relaxed text-zinc-500">
            <span className="font-bold uppercase tracking-wide text-zinc-400">Mavyn transaction</span>
            <br />
            Keep communication, agreements, and payments on Mavyn to maintain your transaction
            protections. Payment is secured when work starts and released when you approve the
            delivery. The 5% fee is paid by the buyer on top — the listed price is the creator&apos;s payout.
          </p>
        </div>
      )}

      {/* ------------------------- mock payment screen ------------------------- */}
      {payOpen && project && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => !busy && setPayOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-5" onClick={(e) => e.stopPropagation()}>
            {!paid ? (
              <>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Checkout</p>
                <h3 className="mt-1 text-sm font-bold text-zinc-100">{project.title}</h3>
                <div className="mt-4 space-y-1.5 rounded-xl border border-line bg-card-raised p-3.5 text-sm">
                  <div className="flex justify-between text-zinc-300">
                    <span>Creator payout</span>
                    <span className="font-mono tracking-[0.08em]">${project.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Platform fee (5%)</span>
                    <span className="font-mono tracking-[0.08em]">${fee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-line pt-1.5 font-semibold text-zinc-50">
                    <span>Total</span>
                    <span className="font-mono tracking-[0.08em]">${(project.amount + fee).toFixed(2)}</span>
                  </div>
                </div>
                <div className="mt-3 rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Payment method</p>
                  <p className="mt-1 font-mono text-sm tracking-[0.08em] text-zinc-300">Demo card ···· 4242</p>
                  <p className="mt-1 text-[10px] text-zinc-600">
                    Demo payment — no real money moves. In production this screen is Stripe Connect.
                  </p>
                </div>
                <button
                  disabled={busy}
                  onClick={async () => {
                    const ok = await run(() =>
                      fetch(`/api/projects/${project.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        // the amount shown IS the amount authorized — the
                        // server refuses if the terms changed underneath
                        body: JSON.stringify({ action: "start", expectedAmount: project.amount }),
                      })
                    );
                    if (ok) setPaid(true);
                    else setPayOpen(false);
                  }}
                  className="btn-lime mt-4 w-full justify-center py-2.5 text-sm disabled:opacity-40"
                >
                  {busy ? "Processing…" : `Pay $${(project.amount + fee).toFixed(2)}`}
                </button>
              </>
            ) : (
              <div className="py-2 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-lime-400/40 bg-lime-400/10">
                  <Check className="h-6 w-6 text-lime-300" />
                </span>
                <h3 className="mt-3 text-sm font-bold text-lime-300">Payment secured</h3>
                <p className="mx-auto mt-1 max-w-[240px] text-xs leading-relaxed text-zinc-400">
                  Your payment of ${(project.amount + fee).toFixed(2)} has been secured for this project.
                  ${project.amount.toFixed(2)} releases to {project.with.displayName.split(" ")[0]} when you
                  approve the delivery.
                </p>
                <button
                  onClick={() => {
                    setPayOpen(false);
                    setPaid(false);
                  }}
                  className="btn-ghost mt-4 px-5 py-2 text-xs"
                >
                  Back to project
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}


/* ----------------------------- terms editor ----------------------------- */
/* Creator-side price change BEFORE payment. Changes are announced in the
   thread and the client must re-review — nothing changes silently. */

function TermsEditor({
  open,
  setOpen,
  amount,
  setAmount,
  current,
  busy,
  onSave,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  amount: string;
  setAmount: (v: string) => void;
  current: number;
  busy: boolean;
  onSave: (n: number) => Promise<boolean>;
}) {
  if (!open)
    return (
      <button
        onClick={() => {
          setAmount(String(current));
          setOpen(true);
        }}
        className="w-full rounded-full border border-line py-2 text-xs font-medium text-zinc-400 transition hover:border-zinc-600"
      >
        Edit terms
      </button>
    );
  return (
    <div className="space-y-1.5 rounded-xl border border-line bg-card-raised p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Price $</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          className="w-24 rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-zinc-100 outline-none"
        />
        <button
          disabled={busy || !amount}
          onClick={async () => {
            const ok = await onSave(Number(amount));
            if (ok) setOpen(false);
          }}
          className="btn-lime px-3 py-1.5 text-xs"
        >
          Update
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-zinc-500">
          Cancel
        </button>
      </div>
      <p className="text-[10px] text-zinc-600">
        The change posts to the conversation and the client must review the updated terms — prices
        never change silently. Terms lock once the offer is accepted.
      </p>
    </div>
  );
}
