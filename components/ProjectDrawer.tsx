"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  FileArchive,
  Flag,
  Lock,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import Avatar from "./Avatar";
import Perforation from "./Perforation";
import ReportModal from "./ReportModal";
import { feeFor, totalFor, money, PLATFORM_FEE_RATE } from "@/lib/fees";

/* ------------------------------------------------------------------ */
/* One reusable project lifecycle for EVERY creator — no special Ava   */
/* workflow, no special demo workflow. The drawer is fully driven by   */
/* its props (participant + service + lifted state); mounting it with  */
/* key={conversationId} gives each conversation its own project.       */
/*                                                                     */
/* draft → offer → accepted → payment secured → in progress →          */
/* extension requested/approved (stateful, idempotent) → delivered →   */
/* approved → payment released → review → experience.                  */
/* ------------------------------------------------------------------ */

export type ProjectStage =
  | "extension"
  | "idle"
  | "form"
  | "review"
  | "offered"
  | "countered"
  | "agreed"
  | "checkout"
  | "paid"
  | "submitted"
  | "reviewing"
  | "done";

export type ExtensionState = "none" | "requested" | "approved";

interface ProjectDrawerProps {
  creatorName: string;
  creatorAvatar?: string | null;
  creatorInitials: string;
  creatorGradient: string;
  service: string;
  startingAt: number;
  open: boolean;
  stage: ProjectStage;
  setStage: (s: ProjectStage) => void;
  extension: ExtensionState;
  setExtension: (e: ExtensionState) => void;
  onClose: () => void;
  /** appends a real message to this conversation */
  onMessage: (from: "me" | "them", text: string) => void;
  /** keeps the status bar's amount in sync */
  onAmount: (n: number) => void;
  /** Discuss: close the drawer and focus the conversation on the extension */
  onDiscuss: () => void;
}

function Milestones({ stage, extension }: { stage: ProjectStage; extension: ExtensionState }) {
  const steps = [
    { label: "Payment secured", done: true },
    ...(extension === "approved" ? [{ label: "Extension approved (+2 days)", done: true }] : []),
    { label: "Project in progress", done: true },
    { label: "Work submitted", done: ["submitted", "reviewing", "done"].includes(stage) },
    { label: "Client approved", done: ["reviewing", "done"].includes(stage) },
    { label: "Payment released", done: stage === "done" },
  ];
  return (
    <ul className="space-y-1.5">
      {steps.map((s) => (
        <li key={s.label} className="flex items-center gap-2 text-xs">
          <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${s.done ? "border-lime-400 bg-lime-400/20" : "border-zinc-600"}`}>
            {s.done && <Check className="h-2.5 w-2.5 text-lime-400" />}
          </span>
          <span className={s.done ? "text-zinc-200" : "text-zinc-500"}>{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} aria-label={`${n} stars`} className={onChange ? "cursor-pointer" : "cursor-default"}>
          <Star className={`h-4 w-4 ${n <= value ? "fill-amber-400 text-amber-400" : "text-zinc-600"}`} />
        </button>
      ))}
    </span>
  );
}

export default function ProjectDrawer({
  creatorName,
  creatorAvatar,
  creatorInitials,
  creatorGradient,
  service,
  startingAt,
  open,
  stage,
  setStage,
  extension,
  setExtension,
  onClose,
  onMessage,
  onAmount,
  onDiscuss,
}: ProjectDrawerProps) {
  /* prefilled from the service — don't make the buyer retype what UpNova knows */
  const [title, setTitle] = useState(service);
  const [date, setDate] = useState("September 15, 2026");
  const [location, setLocation] = useState("Baltimore, MD");
  const [scope, setScope] = useState(
    `${service} delivered through UpNova — scope, files, and approval all recorded on the project.`
  );
  const [budget, setBudget] = useState(startingAt);
  const [myStars, setMyStars] = useState(0);
  const [myReview, setMyReview] = useState("Great work, clear communication, delivered as agreed.");
  const [aiPolicy, setAiPolicy] = useState("Not allowed");
  const [reportOpen, setReportOpen] = useState(false);
  const deliveryScheduled = useRef(false);

  const counter = budget + 50;
  const firstName = creatorName.split(" ")[0];

  /* the other side responds — in the conversation, where humans talk */
  useEffect(() => {
    if (stage === "offered") {
      const t = setTimeout(() => {
        onMessage(
          "them",
          `Just saw the project offer! The scope is a bit bigger than my base rate — I'd need $${counter} to do it right. Sending a counter.`
        );
        onAmount(counter);
        setStage("countered");
      }, 2000);
      return () => clearTimeout(t);
    }
    if (stage === "paid" && extension === "none") {
      const t = setTimeout(() => {
        onMessage("them", "Payment came through 🙌 Starting on schedule.");
        const t2 = setTimeout(() => {
          onMessage("them", "Heads up — one dependency is arriving a day late on my end. Can I get 2 extra days? Requesting an extension now so it's official.");
          setExtension("requested");
          setStage("extension");
        }, 2400);
        return () => clearTimeout(t2);
      }, 1200);
      return () => clearTimeout(t);
    }
    if (stage === "paid" && extension === "approved" && !deliveryScheduled.current) {
      deliveryScheduled.current = true; // one request → one decision → one result
      const t = setTimeout(() => {
        onMessage("them", "Delivery is in — final files attached. Thanks for the trust 🙏");
        setStage("submitted");
      }, 2600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, extension]);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:bg-transparent" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md transform flex-col border-l border-line bg-card shadow-card transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">
            {stage === "form" && "Create Project"}
            {stage === "review" && "Review Project"}
            {(stage === "offered" || stage === "countered") && "Project Offer"}
            {(stage === "agreed" || stage === "checkout") && "Payment"}
            {(stage === "paid" || stage === "submitted" || stage === "extension") && "Project"}
            {(stage === "reviewing" || stage === "done") && "Project Complete"}
            {stage === "idle" && "Project"}
          </h2>
          <div className="flex items-center gap-1">
            {["paid", "submitted", "reviewing", "done", "extension"].includes(stage) && (
              <button onClick={() => setReportOpen(true)} className="icon-btn h-8 w-8" title="Report / Get Help" aria-label="Report or get help">
                <Flag className="h-4 w-4" />
              </button>
            )}
            <button onClick={onClose} className="icon-btn h-8 w-8" aria-label="Close panel">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* who you're hiring */}
          <div className="flex items-center gap-3">
            <Avatar src={creatorAvatar} initials={creatorInitials} gradient={creatorGradient} size="md" className="ring-1 ring-line" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-100">{creatorName}</p>
              <p className="text-xs text-zinc-500">{service} · starting at ${startingAt}</p>
            </div>
            {["paid", "submitted", "reviewing", "done", "extension"].includes(stage) && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-lime-300">
                <ShieldCheck className="h-3 w-3" /> Protected
              </span>
            )}
          </div>

          {/* ---------------- form (prefilled from the service) ---------------- */}
          {(stage === "idle" || stage === "form") && (
            <div className="mt-5 space-y-3.5">
              <div>
                <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Project</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-dark mt-1.5" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Deadline</label>
                  <input value={date} onChange={(e) => setDate(e.target.value)} className="input-dark mt-1.5" />
                </div>
                <div className="flex-1">
                  <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Location</label>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} className="input-dark mt-1.5" />
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Project details / deliverables</label>
                <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={3} className="input-dark mt-1.5 resize-none" />
              </div>
              <div>
                <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                  Agreed price · {firstName}&apos;s {service} starts at ${startingAt}
                </label>
                <div className="relative mt-1.5 max-w-[9rem]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
                  <input value={budget || ""} onChange={(e) => setBudget(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} inputMode="numeric" className="input-dark pl-7 tabular-nums" />
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">AI-generated work</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {([["Not allowed", "bg-red-400"], ["Allowed with disclosure", "bg-amber-400"], ["Allowed", "bg-lime-400"]] as [string, string][]).map(([o, c]) => (
                    <button key={o} type="button" onClick={() => setAiPolicy(o)} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${aiPolicy === o ? "border-zinc-400 bg-white/10 text-zinc-100" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${c}`} /> {o}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-lime-400/25 bg-lime-400/5 p-3 text-xs leading-relaxed text-zinc-400">
                <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-lime-400" />
                <span className="font-semibold text-lime-300">Payment protection.</span> Payment is
                held by the processor until the work is completed and approved.
              </div>
              <button onClick={() => setStage("review")} className="btn-lime w-full rounded-md py-2.5 text-sm">
                Review Project
              </button>
            </div>
          )}

          {/* ---------------- review ---------------- */}
          {stage === "review" && (
            <div className="mt-5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-lime-400">{service}</p>
              <h3 className="mt-1 text-lg font-bold tracking-tight text-zinc-50">{title}</h3>
              <p className="mt-1 text-xs text-zinc-500">{date} · {location}</p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">what you&apos;ll receive</span>
                <br />
                {scope}
              </p>
              <p className="mt-3 rounded-md border border-line bg-card-raised px-3 py-2 text-xs text-zinc-300">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">ai policy · </span>
                {aiPolicy}
              </p>
              <Perforation className="mt-4" />
              <div className="mt-3.5 space-y-1.5 text-sm">
                <p className="flex justify-between text-zinc-400"><span>Project</span><span className="font-bold tabular-nums text-zinc-100">{money(budget)}</span></p>
                <p className="flex justify-between text-xs text-zinc-500"><span>UpNova service fee ({PLATFORM_FEE_RATE * 100}%)</span><span className="tabular-nums">{money(feeFor(budget))}</span></p>
                <p className="flex justify-between border-t border-line-soft pt-2 text-zinc-300"><span className="text-xs">Total</span><span className="text-lg font-extrabold tracking-tight tabular-nums text-lime-400">{money(totalFor(budget))}</span></p>
              </div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setStage("form")} className="btn-ghost flex-1 py-2 text-xs">Back</button>
                <button
                  onClick={() => {
                    onMessage("me", `Sent you a project offer — ${title}, ${money(budget)}, ${date}.`);
                    onAmount(budget);
                    setStage("offered");
                  }}
                  className="btn-lime flex-1 rounded-md py-2 text-xs"
                >
                  Send Project Offer
                </button>
              </div>
            </div>
          )}

          {/* ---------------- offered / countered ---------------- */}
          {(stage === "offered" || stage === "countered") && (
            <div className="mt-5">
              <div className="card-money p-4">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-lime-400">{title}</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <p className="text-xs text-zinc-500">{date}</p>
                  <div className="text-right">
                    <p className={`text-xl font-extrabold tracking-tight tabular-nums ${stage === "countered" ? "text-zinc-500 line-through" : "text-lime-400"}`}>
                      ${budget}
                    </p>
                    {stage === "countered" && (
                      <p className="text-xl font-extrabold tracking-tight tabular-nums text-lime-400">${counter}</p>
                    )}
                  </div>
                </div>
              </div>
              {stage === "offered" ? (
                <p className="mt-4 text-center text-xs text-zinc-500">
                  Offer sent. {firstName} can accept, decline, or counter — and message you right
                  here in the conversation.
                </p>
              ) : (
                <>
                  <p className="mt-4 rounded-md border border-amber-400/30 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-300">
                    {firstName} sent a counter offer: <span className="font-bold tabular-nums">${counter}</span>
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => {
                        onMessage("me", `Deal — $${counter} works. Accepting now.`);
                        setStage("agreed");
                      }}
                      className="btn-lime flex-1 rounded-md py-2 text-xs"
                    >
                      Accept ${counter}
                    </button>
                    <button className="btn-ghost flex-1 py-2 text-xs">Counter</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---------------- agreed → pay ---------------- */}
          {stage === "agreed" && (
            <div className="mt-5">
              <p className="flex items-center gap-2 rounded-md border border-lime-400/30 bg-lime-400/5 p-3 text-sm font-semibold text-lime-300">
                <Check className="h-4 w-4" /> Project accepted — payment required to start
              </p>
              <div className="mt-4 space-y-1.5 text-sm">
                <p className="flex justify-between text-zinc-400"><span>Agreed price</span><span className="font-bold tabular-nums text-zinc-100">${counter}</span></p>
                <p className="flex justify-between text-xs text-zinc-500"><span>UpNova service fee ({PLATFORM_FEE_RATE * 100}%)</span><span className="tabular-nums">{money(feeFor(counter))}</span></p>
                <p className="flex justify-between border-t border-line-soft pt-2 text-zinc-300"><span className="text-xs">Total</span><span className="text-lg font-extrabold tracking-tight tabular-nums text-lime-400">{money(totalFor(counter))}</span></p>
              </div>
              <button onClick={() => setStage("checkout")} className="btn-lime mt-4 w-full rounded-md py-2.5 text-sm">
                Pay {money(totalFor(counter))}
              </button>
              <p className="mt-2.5 flex items-center justify-center gap-1.5 font-mono text-[10px] font-medium text-zinc-500">
                <Lock className="h-3 w-3" /> UpNova Payment Protection — held until completed &amp; approved
              </p>
            </div>
          )}

          {/* ---------------- checkout ---------------- */}
          {stage === "checkout" && (
            <div className="mt-5">
              <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">UpNova</p>
              <Perforation className="mt-3" />
              <div className="mt-4 space-y-1.5 text-sm">
                <p className="flex justify-between text-zinc-400"><span>{title}</span><span className="font-bold tabular-nums text-zinc-100">${counter}.00</span></p>
                <p className="flex justify-between text-xs text-zinc-500"><span>UpNova service fee</span><span className="tabular-nums">{money(feeFor(counter))}</span></p>
              </div>
              <div className="mt-4 flex items-center gap-2.5 rounded-md border border-line bg-card-raised px-3 py-2.5 text-sm text-zinc-200">
                <span className="font-mono font-medium">•••• 4242</span>
                <span className="ml-auto text-lg font-extrabold tracking-tight tabular-nums text-lime-400">{money(totalFor(counter))}</span>
              </div>
              <button
                onClick={() => {
                  onMessage("me", "Payment sent through UpNova. Locked in 🔒");
                  setStage("paid");
                }}
                className="btn-lime mt-4 w-full rounded-md py-2.5 text-sm"
              >
                Pay &amp; Start Project
              </button>
              <p className="mt-2.5 rounded-md border border-lime-400/25 bg-lime-400/5 p-2.5 text-center text-[10px] leading-relaxed text-zinc-400">
                <ShieldCheck className="mr-1 inline h-3 w-3 text-lime-400" />
                You&apos;re paying through UpNova. Payment and agreement are recorded — keep
                communication and payment on the platform.
              </p>
            </div>
          )}

          {/* ---------------- extension request — one request, one decision ---------------- */}
          {stage === "extension" && extension === "requested" && (
            <div className="mt-5">
              <div className="rounded-md border border-amber-400/30 bg-amber-400/5 p-3.5">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-400">
<span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />extension requested
                </p>
                <p className="mt-1.5 text-sm text-zinc-200">
                  {firstName} asked for <span className="font-bold">+2 days</span> on{" "}
                  <span className="font-semibold">{title}</span>.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Approving officially moves the deadline. No penalty to {firstName}&apos;s record —
                  this is exactly the communication UpNova rewards.
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    setExtension("approved");
                    onMessage("me", "Extension approved — new deadline works. Thanks for flagging it early 🙏");
                    setStage("paid");
                  }}
                  className="flex-1 rounded-md bg-amber-400 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-300"
                >
                  Approve Extension
                </button>
                <button onClick={onDiscuss} className="btn-ghost flex-1 py-2 text-xs">
                  Discuss
                </button>
              </div>
            </div>
          )}

          {/* ---------------- workspace ---------------- */}
          {["paid", "submitted", "reviewing", "done"].includes(stage) && (
            <div className="mt-5">
              <div className="flex items-baseline justify-between">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-lime-400">{title}</p>
                <p className="text-lg font-extrabold tracking-tight tabular-nums text-lime-400">${counter}</p>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{date} · {location}</p>

              {/* extension result — shown once, never re-asked */}
              {extension === "approved" && (
                <p className="mt-2.5 rounded-md border border-line bg-card-raised px-3 py-2 text-[11px] text-zinc-400">
                  ✓ <span className="font-semibold text-zinc-200">Extension approved</span> · +2
                  days · approved by you
                </p>
              )}

              <div className="mt-4"><Milestones stage={stage} extension={extension} /></div>

              {["submitted", "reviewing", "done"].includes(stage) && (
                <div className="mt-4 rounded-md border border-line bg-card-raised p-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
                    <FileArchive className="h-4 w-4 text-lime-400" />
                    final-delivery.zip
                    <span className="font-mono text-[10px] font-medium text-zinc-500">files attached</span>
                  </p>
                </div>
              )}

              {stage === "submitted" && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setStage("reviewing")} className="btn-lime flex-1 rounded-md py-2 text-xs">
                    <CheckCheck className="mr-1 inline h-3.5 w-3.5" /> Approve &amp; release payment
                  </button>
                  <button className="btn-ghost flex-1 py-2 text-xs">Request revision</button>
                </div>
              )}

              {stage === "paid" && (
                <p className="mt-4 text-center text-xs text-zinc-500">
                  Waiting on {firstName}&apos;s delivery.
                </p>
              )}

              {["reviewing", "done"].includes(stage) && (
                <>
                  <Perforation className="mt-4" />
                  <div className="mt-3 space-y-1 text-xs">
                    <p className="flex justify-between text-zinc-400"><span>{firstName}&apos;s payout</span><span className="font-bold tabular-nums text-lime-400">${counter}</span></p>
                    <p className="flex justify-between text-zinc-500"><span>UpNova service fee (paid by you)</span><span className="font-medium tabular-nums">{money(feeFor(counter))}</span></p>
                    <p className="flex justify-between text-zinc-500"><span>Payout status</span><span className={stage === "done" ? "font-semibold text-lime-400" : "text-amber-400"}>{stage === "done" ? "Released" : "Releasing…"}</span></p>
                  </div>
                </>
              )}

              {stage === "reviewing" && (
                <div className="mt-4 border-t border-line-soft pt-4">
                  <p className="text-sm font-bold tracking-tight text-zinc-100">Rate {firstName}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    Verified UpNova Project review · communication, quality, reliability,
                    professionalism, met deadline
                  </p>
                  <div className="mt-2"><Stars value={myStars} onChange={setMyStars} /></div>
                  <textarea value={myReview} onChange={(e) => setMyReview(e.target.value)} rows={2} className="input-dark mt-2.5 resize-none text-xs" />
                  <button
                    onClick={() => setStage("done")}
                    disabled={myStars === 0}
                    className={`mt-2.5 w-full rounded-full py-2 text-xs font-bold transition ${myStars === 0 ? "cursor-not-allowed bg-card-raised text-zinc-600" : "bg-violet-400 text-zinc-950 hover:bg-violet-300 hover:shadow-glow-violet"}`}
                  >
                    Submit review
                  </button>
                </div>
              )}

              {stage === "done" && (
                <div className="mt-4 border-t border-line-soft pt-4 text-xs text-zinc-400">
                  <p className="flex items-center justify-between"><span>You rated {firstName}</span><Stars value={myStars || 5} /></p>
                  <p className="mt-2 flex items-center justify-between"><span>{firstName} rated you</span><Stars value={5} /></p>
                  <p className="mt-2 italic text-zinc-500">&ldquo;Clear brief, quick decisions, paid on time.&rdquo;</p>
                  <p className="mt-3 border-t border-line-soft pt-2.5 text-center font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                    ✓ completed · added to {firstName}&apos;s experience · counts on both profiles
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {reportOpen && (
        <ReportModal context={`Project · ${title} · ${creatorName}`} onClose={() => setReportOpen(false)} />
      )}
    </>
  );
}
