"use client";

import { useEffect, useState } from "react";
import {
  Briefcase,
  Check,
  CheckCheck,
  Clock,
  FileArchive,
  Lock,
  Star,
  X,
} from "lucide-react";
import Avatar from "./Avatar";
import Perforation from "./Perforation";
import { feeFor, totalFor, money, PLATFORM_FEE_RATE } from "@/lib/fees";
import ReportModal from "./ReportModal";
import { ShieldCheck, Flag } from "lucide-react";

/* ------------------------------------------------------------------ */
/* The UpNova money loop, as UI state:                                 */
/* hire → create project → offer → counter → agree → pay → workspace  */
/* → deliver → approve → payout → mutual reviews                       */
/* Payments are mocked; Stripe Connect slots in where pay() fires.     */
/* ------------------------------------------------------------------ */

type Stage =
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

interface Bubble {
  from: "me" | "them";
  text: string;
}

interface ProjectFlowProps {
  creatorName: string;
  creatorAvatar?: string | null;
  creatorInitials: string;
  creatorGradient: string;
  service: string;
  startingAt: number;
  openCreate: boolean;
  onCreateHandled: () => void;
}

function Milestones({ stage }: { stage: Stage }) {
  const steps: { label: string; done: boolean }[] = [
    { label: "Payment secured", done: true },
    { label: "Project in progress", done: true },
    { label: "Work submitted", done: stage === "submitted" || stage === "reviewing" || stage === "done" },
    { label: "Client approved", done: stage === "reviewing" || stage === "done" },
    { label: "Payment released", done: stage === "done" },
  ];
  return (
    <ul className="space-y-1.5">
      {steps.map((s) => (
        <li key={s.label} className="flex items-center gap-2 text-xs">
          <span
            className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
              s.done ? "border-lime-400 bg-lime-400/20" : "border-zinc-600"
            }`}
          >
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
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} stars`}
          className={onChange ? "cursor-pointer" : "cursor-default"}
        >
          <Star
            className={`h-4 w-4 ${
              n <= value ? "fill-amber-400 text-amber-400" : "text-zinc-600"
            }`}
          />
        </button>
      ))}
    </span>
  );
}

export default function ProjectFlow({
  creatorName,
  creatorAvatar,
  creatorInitials,
  creatorGradient,
  service,
  startingAt,
  openCreate,
  onCreateHandled,
}: ProjectFlowProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [desc, setDesc] = useState(
    "Full photo coverage of the Creator Meetup, plus an edited gallery of 40+ shots."
  );
  const [deadline, setDeadline] = useState("Aug 22");
  const [custom, setCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState(startingAt);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [myStars, setMyStars] = useState(0);
  const [myReview, setMyReview] = useState("Fantastic eye. The gallery was better than the brief.");

  const offer = custom ? customAmount : startingAt;
  const counter = offer + 50;
  const firstName = creatorName.split(" ")[0];

  const say = (from: Bubble["from"], text: string) =>
    setBubbles((b) => [...b, { from, text }]);

  /* header "Create Project" button opens the form */
  useEffect(() => {
    if (openCreate) {
      setStage((s) => (s === "idle" ? "form" : s));
      onCreateHandled();
    }
  }, [openCreate, onCreateHandled]);

  /* the other side responds on a human-ish delay */
  useEffect(() => {
    if (stage === "offered") {
      const t = setTimeout(() => {
        say(
          "them",
          `I can do it for $${counter} — the meetup runs long, so that covers the extra hours and a second card of edits.`
        );
        setStage("countered");
      }, 1800);
      return () => clearTimeout(t);
    }
    if (stage === "paid") {
      const t = setTimeout(() => {
        say("them", "Here's the final gallery — 52 edited shots. Thanks for the trust 🙏");
        setStage("submitted");
      }, 2600);
      return () => clearTimeout(t);
    }
    if (stage === "reviewing") {
      const t = setTimeout(() => setStage("done"), 1600);
      return () => clearTimeout(t);
    }
  }, [stage, counter]);

  const price = stage === "offered" || stage === "review" || stage === "form" ? offer : counter;

  return (
    <>
      {/* flow-generated chat bubbles */}
      {bubbles.map((m, i) => (
        <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              m.from === "me"
                ? "rounded-br-md bg-zinc-100 text-zinc-950"
                : "rounded-bl-md border border-line bg-card-raised text-zinc-200"
            }`}
          >
            {m.text}
            <span className={`mt-1 block text-[10px] ${m.from === "me" ? "text-zinc-800/70" : "text-zinc-500"}`}>
              now
            </span>
          </div>
        </div>
      ))}

      {/* ---------------- hire strip (idle) ---------------- */}
      {stage === "idle" && (
        <div className="card-money mx-auto w-full max-w-sm p-4 text-center">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-lime-400">
            potential job detected
          </p>
          <p className="mt-1.5 text-sm text-zinc-300">
            You want to hire <span className="font-semibold text-zinc-100">{creatorName}</span> for{" "}
            <span className="font-semibold text-zinc-100">{service}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Starting price <span className="text-sm font-bold tracking-tight text-lime-400">${startingAt}</span>
          </p>
          <button onClick={() => setStage("form")} className="btn-lime mt-3 w-full rounded-md py-2 text-xs">
            <Briefcase className="h-3.5 w-3.5" /> Create Project
          </button>
        </div>
      )}

      {/* ---------------- offer card (awaiting / countered / agreed…) ---------------- */}
      {(stage === "offered" || stage === "countered" || stage === "agreed") && (
        <div className="card-money mx-auto w-full max-w-sm overflow-hidden">
          <div className="p-4">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-lime-400">
              {service} project
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Avatar src={creatorAvatar} initials={creatorInitials} gradient={creatorGradient} size="sm" className="ring-1 ring-line" />
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{creatorName}</p>
                  <p className="text-xs text-zinc-500">Due {deadline}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-xl font-extrabold tracking-tight tabular-nums ${stage === "offered" ? "text-lime-400" : "text-zinc-500 line-through"}`}>
                  ${offer}
                </p>
                {stage !== "offered" && (
                  <p className="text-xl font-extrabold tracking-tight tabular-nums text-lime-400">${counter}</p>
                )}
              </div>
            </div>
            <Perforation className="mt-3.5" />
            <p className="mt-3 flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-400">
              <Clock className="h-3 w-3" />
              {stage === "offered" && `awaiting ${firstName}'s response…`}
              {stage === "countered" && `${firstName} sent a counter offer`}
              {stage === "agreed" && "agreed — payment required to start"}
            </p>
            {stage === "countered" && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    say("me", `Deal — $${counter} works. Sending it through now.`);
                    setStage("agreed");
                  }}
                  className="flex-1 rounded-md bg-lime-400 py-2 text-xs font-bold text-zinc-950 transition hover:bg-lime-300 hover:shadow-glow"
                >
                  Accept ${counter}
                </button>
                <button className="rounded-md border border-line px-3 py-2 text-xs font-medium text-zinc-400 transition hover:border-zinc-600">
                  Counter
                </button>
              </div>
            )}
            {stage === "agreed" && (
              <button
                onClick={() => setStage("checkout")}
                className="mt-3 w-full rounded-md bg-lime-400 py-2 text-xs font-bold text-zinc-950 transition hover:bg-lime-300 hover:shadow-glow"
              >
                Pay {money(totalFor(counter))}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ---------------- project workspace ---------------- */}
      {(stage === "paid" || stage === "submitted" || stage === "reviewing" || stage === "done") && (
        <div className="card-money mx-auto w-full max-w-sm overflow-hidden">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-lime-400">
                  {stage === "done" ? "project complete ✓" : `${service} · in progress`}
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-100">
                  {creatorName} <span className="font-normal text-zinc-500">×</span> You
                </p>
                <p className="mt-1.5 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-lime-300">
                    <ShieldCheck className="h-3 w-3" /> UpNova Protected
                  </span>
                  <button
                    onClick={() => setReportOpen(true)}
                    className="inline-flex items-center gap-1 font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500 transition hover:text-red-300"
                  >
                    <Flag className="h-3 w-3" /> get help
                  </button>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-extrabold tracking-tight tabular-nums text-lime-400">${counter}</p>
                <p className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                  due {deadline}
                </p>
              </div>
            </div>

            <div className="mt-3.5">
              <Milestones stage={stage} />
            </div>

            {/* delivery */}
            {(stage === "submitted" || stage === "reviewing" || stage === "done") && (
              <div className="mt-3.5 rounded-md border border-line bg-card-raised p-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
                  <FileArchive className="h-4 w-4 text-lime-400" />
                  meetup-gallery.zip
                  <span className="font-mono text-[10px] font-medium text-zinc-500">52 files · 1.2 GB</span>
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  &ldquo;Here&apos;s the final gallery — 52 edited shots.&rdquo;
                </p>
              </div>
            )}

            {stage === "submitted" && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setStage("reviewing")}
                  className="flex-1 rounded-md bg-lime-400 py-2 text-xs font-bold text-zinc-950 transition hover:bg-lime-300 hover:shadow-glow"
                >
                  <CheckCheck className="mr-1 inline h-3.5 w-3.5" />
                  Approve work
                </button>
                <button className="rounded-md border border-line px-3 py-2 text-xs font-medium text-zinc-400 transition hover:border-zinc-600">
                  Request revision
                </button>
              </div>
            )}

            {(stage === "reviewing" || stage === "done") && (
              <>
                <Perforation className="mt-4" />
                <div className="mt-3 space-y-1 text-xs">
                  <p className="flex justify-between text-zinc-400">
                    <span>{firstName}&apos;s payout</span>
                    <span className="font-bold tabular-nums text-lime-400">${counter}</span>
                  </p>
                  <p className="flex justify-between text-zinc-500">
                    <span>UpNova service fee (paid by client)</span>
                    <span className="font-medium tabular-nums">{money(feeFor(counter))}</span>
                  </p>
                  <p className="flex justify-between text-zinc-500">
                    <span>Payout status</span>
                    <span className={stage === "done" ? "font-semibold text-lime-400" : "text-amber-400"}>
                      {stage === "done" ? "Released" : "Releasing…"}
                    </span>
                  </p>
                </div>
              </>
            )}

            {stage === "paid" && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setDetailsOpen(!detailsOpen)}
                  className="flex-1 rounded-md border border-line py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-600"
                >
                  Project details
                </button>
                <button
                  disabled
                  className="flex-1 cursor-not-allowed rounded-md border border-line py-2 text-xs font-medium text-zinc-600"
                  title={`${firstName} submits work from their side`}
                >
                  Awaiting delivery
                </button>
              </div>
            )}
            {detailsOpen && stage === "paid" && (
              <div className="mt-3 space-y-1.5 rounded-md border border-line bg-card-raised p-3 text-xs text-zinc-400">
                <p><span className="text-zinc-500">Scope:</span> {desc}</p>
                <p><span className="text-zinc-500">Deadline:</span> {deadline}</p>
                <p><span className="text-zinc-500">Payment:</span> {money(totalFor(counter))} held by the payment processor until you approve</p>
                <p><span className="text-zinc-500">Agreement:</span> offer + counter accepted in this thread</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- mutual reviews ---------------- */}
      {stage === "reviewing" && (
        <div className="card-people mx-auto w-full max-w-sm p-4">
          <p className="text-sm font-bold tracking-tight text-zinc-100">Rate {firstName}</p>
          <div className="mt-2"><Stars value={myStars} onChange={setMyStars} /></div>
          <textarea
            value={myReview}
            onChange={(e) => setMyReview(e.target.value)}
            rows={2}
            className="input-dark mt-2.5 resize-none text-xs"
          />
          <button
            onClick={() => setStage("done")}
            disabled={myStars === 0}
            className={`mt-2.5 w-full rounded-full py-2 text-xs font-bold transition ${
              myStars === 0
                ? "cursor-not-allowed bg-card-raised text-zinc-600"
                : "bg-violet-400 text-zinc-950 hover:bg-violet-300 hover:shadow-glow-violet"
            }`}
          >
            Submit review
          </button>
        </div>
      )}

      {stage === "done" && (
        <div className="card-people mx-auto w-full max-w-sm p-4">
          <p className="flex items-center justify-between text-xs text-zinc-400">
            <span>You rated {firstName}</span>
            <Stars value={myStars || 5} />
          </p>
          <p className="mt-2 flex items-center justify-between text-xs text-zinc-400">
            <span>{firstName} rated you</span>
            <Stars value={5} />
          </p>
          <p className="mt-2 text-xs italic text-zinc-500">
            &ldquo;Clear brief, quick decisions, paid on time.&rdquo;
          </p>
          <p className="mt-3 border-t border-line-soft pt-2.5 text-center font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
            this project now counts on both profiles
          </p>
        </div>
      )}

      {reportOpen && (
        <ReportModal context={`Project · ${service} · ${creatorName}`} onClose={() => setReportOpen(false)} />
      )}

      {/* ================= modals ================= */}

      {/* create project form */}
      {(stage === "form" || stage === "review") && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setStage("idle")}>
          <div className="card-money w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            {stage === "form" ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Create Project</h2>
                  <button onClick={() => setStage("idle")} className="icon-btn h-8 w-8" aria-label="Close">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 space-y-3.5 text-sm">
                  <div>
                    <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Who you&apos;re hiring</label>
                    <div className="mt-1.5 flex items-center gap-2.5 rounded-md border border-line bg-card-raised px-3 py-2">
                      <Avatar src={creatorAvatar} initials={creatorInitials} gradient={creatorGradient} size="xs" />
                      <span className="font-semibold text-zinc-100">{creatorName}</span>
                      <span className="ml-auto text-xs text-zinc-500">{service}</span>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="pf-desc" className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Describe what you need</label>
                    <textarea id="pf-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} className="input-dark mt-1.5 resize-none" />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label htmlFor="pf-deadline" className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Deadline</label>
                      <input id="pf-deadline" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="input-dark mt-1.5" />
                    </div>
                    <div className="flex-1">
                      <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Payment</label>
                      <div className="mt-1.5 space-y-1.5">
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                          <input type="radio" checked={!custom} onChange={() => setCustom(false)} className="accent-lime-400" />
                          ${startingAt} fixed price
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                          <input type="radio" checked={custom} onChange={() => setCustom(true)} className="accent-lime-400" />
                          Custom
                          {custom && (
                            <input
                              type="number"
                              value={customAmount}
                              onChange={(e) => setCustomAmount(Number(e.target.value) || 0)}
                              className="w-20 rounded-md border border-line bg-card-raised px-2 py-1 text-xs text-zinc-100"
                            />
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setStage("idle")} className="btn-ghost px-4 py-2 text-xs">Cancel</button>
                  <button onClick={() => setStage("review")} className="btn-lime rounded-md px-5 py-2 text-xs">Continue</button>
                </div>
              </>
            ) : (
              <>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-lime-400">project summary</p>
                <h2 className="mt-1.5 text-[15px] font-bold tracking-tight text-zinc-50">{service}</h2>
                <p className="text-xs text-zinc-500">{creatorName}</p>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">{desc}</p>
                <p className="mt-2 text-xs text-zinc-500">Deadline: <span className="text-zinc-300">{deadline}</span></p>
                <Perforation className="mt-4" />
                <div className="mt-3.5 space-y-1.5 text-sm">
                  <p className="flex justify-between text-zinc-400"><span>Project total</span><span className="font-bold tabular-nums text-zinc-100">${offer}</span></p>
                  <p className="flex justify-between text-zinc-500 text-xs"><span>UpNova service fee ({PLATFORM_FEE_RATE * 100}%)</span><span className="font-medium tabular-nums">{money(feeFor(offer))}</span></p>
                  <p className="flex justify-between border-t border-line-soft pt-2 text-zinc-300"><span className="text-xs">You&apos;ll pay</span><span className="text-lg font-extrabold tracking-tight tabular-nums text-lime-400">{money(totalFor(offer))}</span></p>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button onClick={() => setStage("form")} className="btn-ghost px-4 py-2 text-xs">Back</button>
                  <button
                    onClick={() => {
                      say("me", `Sent you a project offer — ${service.toLowerCase()}, $${offer}, due ${deadline}.`);
                      setStage("offered");
                    }}
                    className="btn-lime rounded-md px-5 py-2 text-xs"
                  >
                    Send Offer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* checkout */}
      {stage === "checkout" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setStage("agreed")}>
          <div className="card-money w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-center font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">UpNova</p>
            <Perforation className="mt-3" />
            <div className="mt-4">
              <p className="text-[15px] font-bold tracking-tight text-zinc-50">{service}</p>
              <p className="text-xs text-zinc-500">{creatorName}</p>
            </div>
            <div className="mt-4 space-y-1.5 text-sm">
              <p className="flex justify-between text-zinc-400"><span>Creator price</span><span className="font-bold tabular-nums text-zinc-100">${counter}.00</span></p>
              <p className="flex justify-between text-xs text-zinc-500"><span>UpNova service fee ({PLATFORM_FEE_RATE * 100}%)</span><span className="tabular-nums">{money(feeFor(counter))}</span></p>
            </div>
            <div className="mt-4">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Payment method</p>
              <div className="mt-1.5 flex items-center gap-2.5 rounded-md border border-line bg-card-raised px-3 py-2.5 text-sm text-zinc-200">
                💳 <span className="font-mono font-medium">•••• 4242</span>
                <span className="ml-auto text-lg font-extrabold tracking-tight tabular-nums text-lime-400">{money(totalFor(counter))}</span>
              </div>
            </div>
            <button
              onClick={() => {
                say("me", "Payment sent. Locked in 🔒");
                setStage("paid");
              }}
              className="btn-lime mt-4 w-full rounded-md py-2.5 text-sm"
            >
              Pay &amp; Start Project
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center font-mono text-[10px] font-medium text-zinc-500">
              <Lock className="h-3 w-3" />
              held by the payment processor until you approve the work
            </p>
            <p className="mt-2 rounded-md border border-lime-400/25 bg-lime-400/5 p-2.5 text-center text-[10px] leading-relaxed text-zinc-400">
              <ShieldCheck className="mr-1 inline h-3 w-3 text-lime-400" />
              <span className="font-semibold text-lime-300">You&apos;re paying through UpNova.</span>{" "}
              Your payment and project agreement are recorded. Keep communication and payment on
              the platform to maintain transaction protections.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
