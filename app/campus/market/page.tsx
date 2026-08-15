"use client";

/* ------------------------------------------------------------------ */
/*  Campus Marketplace — students helping students.                    */
/*  Buy it. Sell it. Give it away. Trade it. Auction it. Or just       */
/*  borrow it. FREE = you keep it · BORROW = it comes back — the UI    */
/*  never blurs that line. Verified campus members transact; guests    */
/*  browse a limited slice.                                            */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Plus, Clock, Check, RotateCcw, MessageSquare, HandHeart, ArrowLeft } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useSession } from "@/lib/session";
import { LISTING_TYPES, LOAN_CHAIN, exchangeLabel, typeLabel } from "@/lib/campusMarket";

interface Listing {
  id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  price: number | null;
  condition: string;
  media: string[];
  status: string;
  campus: string;
  auctionEndsAt: string | null;
  topBid: number | null;
  seller: { handle: string; displayName: string; avatarUrl: string | null };
  isMine: boolean;
}

interface BorrowRecord {
  onTime: number;
  late: number;
  problems: number;
  overdueNow: number;
}

interface Loan {
  id: string;
  itemTitle: string;
  message: string;
  status: string;
  phase: string;
  chainStep: number;
  overdue: boolean;
  neededAt: string | null;
  exchangeMethod: string;
  exchangeNote: string;
  dueAt: string;
  extensionUntil: string | null;
  counterUntil: string | null;
  returnedLate: boolean;
  deposit: number | null;
  conditionBefore: { note?: string; photos?: string[] };
  conditionAfter: { note?: string; photos?: string[] };
  conversationId: string | null;
  myRole: "lender" | "borrower";
  with: string;
  withRecord: BorrowRecord | null;
}

const TYPE_TONE: Record<string, string> = {
  fixed: "border-lime-400/40 bg-lime-400/10 text-lime-300",
  free: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  negotiable: "border-lime-400/30 bg-lime-400/5 text-lime-200",
  trade: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  auction: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  borrow: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  need_borrow: "border-sky-400/40 bg-sky-400/5 text-sky-200",
};

export default function CampusMarketPage() {
  const { user: me } = useSession();
  const [data, setData] = useState<{ member: boolean; campusName: string | null; listings: Listing[] } | null>(null);
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [myRecord, setMyRecord] = useState<BorrowRecord | null>(null);
  const [view, setView] = useState<"browse" | "loans">("browse");
  const [type, setType] = useState("All");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("loans")) setView("loans");
    fetch("/api/campus/market", { cache: "no-store" }).then((r) => r.json()).then(setData);
  }, []);

  const loadLoans = useCallback(async () => {
    const res = await fetch("/api/me/loans", { cache: "no-store" });
    if (!res.ok) return setLoans([]);
    const j = await res.json();
    setLoans(j.loans ?? []);
    setMyRecord(j.myRecord ?? null);
  }, []);
  useEffect(() => {
    if (view === "loans") loadLoans();
  }, [view, loadLoans]);

  const loanAct = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/loans/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    loadLoans();
  };

  const types = ["All", ...LISTING_TYPES.map((t) => t.id)];
  const filtered = (data?.listings ?? []).filter((l) => type === "All" || l.type === type);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/campus"
        className="mb-2 inline-flex items-center gap-1 px-1 font-mono text-[11px] tracking-[0.1em] text-zinc-500 transition hover:text-violet-300"
      >
        <ArrowLeft className="h-3 w-3" /> BACK TO YOUR CAMPUS
      </Link>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10">
          <GraduationCap className="h-5 w-5 text-violet-400" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Campus Marketplace</h1>
          <p className="text-sm text-zinc-400">
            {data?.member
              ? `${data.campusName} — buy, sell, give away, trade, auction, or just borrow.`
              : "Students helping students. Verify your campus to buy, claim, bid, lend, and borrow."}
          </p>
        </div>
        {data?.member && (
          <Link href="/campus/market/new" className="btn-lime shrink-0 px-4 py-1.5 text-xs sm:text-sm">
            <Plus className="h-4 w-4" /> List something
          </Link>
        )}
      </div>

      {!data?.member && data && (
        <div className="mt-6 rounded-2xl border border-violet-400/30 bg-violet-400/5 p-8 text-center">
          <p className="text-sm font-semibold text-zinc-200">The Campus Marketplace is a verified-campus space</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-zinc-500">
            Buying, selling, borrowing, and lending here is students-helping-students — it requires verified school
            affiliation. Free or Pro plan makes no difference; verification is free.
          </p>
          {me === null ? (
            <Link href="/signup?next=%2Fcampus" className="btn-lime mt-4 inline-flex px-5 py-2 text-sm">Create free account</Link>
          ) : (
            <Link href="/campus" className="btn-lime mt-4 inline-flex px-5 py-2 text-sm">Verify your campus — free</Link>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 border-b border-line-soft text-sm">
        {(["browse", "loans"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`-mb-px border-b-2 pb-2.5 transition ${view === v ? "border-white font-semibold text-zinc-50" : "border-transparent font-medium text-zinc-500 hover:text-zinc-300"}`}>
            {v === "browse" ? "Browse" : "Borrowing"}
          </button>
        ))}
      </div>

      {view === "browse" ? (
        <>
          <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto">
            {types.map((t) => (
              <button key={t} onClick={() => setType(t)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${type === t ? "border-violet-400/50 bg-violet-400/10 font-semibold text-violet-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
                {t === "All" ? "All" : typeLabel(t)}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data === null ? (
              [0, 1].map((i) => <div key={i} className="card h-44 animate-pulse" aria-hidden />)
            ) : (
              filtered.map((l) => (
                <article key={l.id} className={`card-people flex flex-col p-4 ${["completed", "expired", "reserved"].includes(l.status) ? "opacity-60" : ""}`}>
                  {l.media[0] && (
                    <Link href={`/campus/market/${l.id}`} className="relative mb-3 block aspect-[4/3] overflow-hidden rounded-xl border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.media[0]} alt={l.title} className="absolute inset-0 h-full w-full object-cover" />
                    </Link>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.15em] ${TYPE_TONE[l.type] ?? "border-line text-zinc-400"}`}>
                        {l.type === "need_borrow" ? "Needs to borrow" : typeLabel(l.type)}
                      </span>
                      <h3 className="mt-1.5 text-sm font-bold text-zinc-100">
                        <Link href={`/campus/market/${l.id}`} className="transition hover:text-violet-300">{l.title}</Link>
                      </h3>
                      <p className="font-mono text-sm font-medium tracking-[0.08em] text-lime-300">
                        {l.type === "auction"
                          ? l.topBid
                            ? `Top bid $${l.topBid}`
                            : `Starts at $${l.price}`
                          : l.type === "free"
                            ? "Free — you keep it"
                            : l.type === "borrow"
                              ? "Free to borrow — it comes back"
                              : l.type === "need_borrow"
                                ? "Looking for a lender"
                                : l.type === "trade"
                                  ? "Open to trades"
                                  : `$${l.price}${l.type === "negotiable" ? " OBO" : ""}`}
                      </p>
                    </div>
                    {["reserved", "completed"].includes(l.status) && (
                      <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[9px] font-bold uppercase text-zinc-500">
                        {l.status === "reserved" ? "Reserved" : "Done"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-zinc-400">{l.description}</p>
                  {l.type === "auction" && l.auctionEndsAt && l.status === "active" && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-300">
                      <Clock className="h-3 w-3" /> Ends {new Date(l.auctionEndsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric" })}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-2 border-t border-dashed border-line pt-3">
                    <Link href={`/creator/${l.seller.handle}`} className="flex min-w-0 flex-1 items-center gap-2">
                      <Avatar src={l.seller.avatarUrl} initials={l.seller.displayName.charAt(0)} size="xs" />
                      <span className="truncate text-xs font-semibold text-zinc-200">{l.seller.displayName}</span>
                    </Link>
                    <span className="shrink-0 text-[10px] text-zinc-600">{l.campus}</span>
                    <Link href={`/campus/market/${l.id}`} className="btn-lime shrink-0 px-3 py-1.5 text-xs">View</Link>
                  </div>
                </article>
              ))
            )}
            {data !== null && filtered.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-zinc-500">Nothing here yet — be the first.</p>
            )}
          </div>
        </>
      ) : (
        /* ------------------------------ Borrowing ------------------------------ */
        <div className="mt-4 space-y-2.5">
          {me === null ? (
            <div className="card p-8 text-center">
              <p className="text-sm font-semibold text-zinc-200">Create an account to borrow and lend</p>
              <Link href="/signup?next=%2Fcampus%2Fmarket%3Floans%3D1" className="btn-lime mt-4 inline-flex px-5 py-2 text-sm">Create free account</Link>
            </div>
          ) : loans === null ? (
            <div className="card h-24 animate-pulse" aria-hidden />
          ) : loans.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm font-semibold text-zinc-200">No loans yet</p>
              <p className="mt-1 text-xs text-zinc-500">Borrow something — or list an item as borrowable — and the whole loan is tracked here.</p>
            </div>
          ) : (
            <>
            {myRecord && (myRecord.onTime + myRecord.late + myRecord.problems > 0 || myRecord.overdueNow > 0) && (
              <p className="rounded-xl border border-line-soft bg-card-raised/40 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-500">
                Your borrowing record: <span className="text-lime-300">{myRecord.onTime} on time</span>
                {myRecord.late > 0 && <> · <span className="text-amber-300">{myRecord.late} late</span></>}
                {myRecord.problems > 0 && <> · <span className="text-rose-300">{myRecord.problems} problem</span></>}
                {myRecord.overdueNow > 0 && <> · <span className="text-rose-300">{myRecord.overdueNow} overdue now</span></>}
              </p>
            )}
            {loans.map((ln) => (
              <article key={ln.id} className={`card p-4 ${["declined", "cancelled"].includes(ln.status) ? "opacity-60" : ""} ${ln.overdue ? "border-rose-400/40" : ""}`}>
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-100">
                  {ln.itemTitle}
                  <span className="rounded-full border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300">
                    {ln.myRole === "lender" ? "Lending" : "Borrowing"}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ln.overdue ? "border-rose-400/40 text-rose-300" : ln.status === "completed" ? "border-lime-400/40 text-lime-300" : "border-amber-400/40 text-amber-300"}`}>
                    {ln.phase}
                  </span>
                  {ln.status === "completed" && ln.returnedLate && (
                    <span className="rounded-full border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300/80">Returned late</span>
                  )}
                </p>
                {/* the agreement, tracked end to end */}
                {ln.chainStep >= 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1 font-mono text-[9px] uppercase tracking-[0.06em]">
                    {LOAN_CHAIN.map((step, i) => (
                      <span key={step} className="flex items-center gap-1">
                        {i > 0 && <span className="text-zinc-700">→</span>}
                        <span className={i < ln.chainStep ? "text-zinc-500" : i === ln.chainStep ? (ln.overdue ? "font-bold text-rose-300" : "font-bold text-sky-300") : "text-zinc-700"}>
                          {i === ln.chainStep && ln.overdue ? "OVERDUE" : step}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-1.5 text-xs text-zinc-500">
                  {ln.myRole === "lender" ? "To" : "From"} {ln.with}
                  {ln.neededAt ? ` · needed ${new Date(ln.neededAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" })}` : ""}
                  {" · "}agreed return {new Date(ln.dueAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" })}
                  {` · ${exchangeLabel(ln.exchangeMethod)}`}
                  {ln.exchangeNote ? ` (${ln.exchangeNote})` : ""}
                  {ln.deposit ? ` · refundable deposit $${ln.deposit} (borrowing itself is free)` : ""}
                </p>
                {ln.withRecord && (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-500">
                    {ln.with}&apos;s borrowing record:{" "}
                    {ln.withRecord.onTime + ln.withRecord.late + ln.withRecord.problems === 0 && ln.withRecord.overdueNow === 0 ? (
                      <span className="text-zinc-400">first borrow on Mavyn</span>
                    ) : (
                      <>
                        <span className="text-lime-300">{ln.withRecord.onTime} on time</span>
                        {ln.withRecord.late > 0 && <> · <span className="text-amber-300">{ln.withRecord.late} late</span></>}
                        {ln.withRecord.problems > 0 && <> · <span className="text-rose-300">{ln.withRecord.problems} problem</span></>}
                        {ln.withRecord.overdueNow > 0 && <> · <span className="text-rose-300">{ln.withRecord.overdueNow} overdue now</span></>}
                      </>
                    )}
                  </p>
                )}
                {ln.message && <p className="mt-1.5 text-xs italic text-zinc-400">&ldquo;{ln.message}&rdquo;</p>}
                {ln.conditionBefore?.note && (
                  <p className="mt-1.5 text-[11px] text-zinc-500">Condition at handoff: {ln.conditionBefore.note}</p>
                )}
                {ln.conditionAfter?.note && (
                  <p className="mt-0.5 text-[11px] text-zinc-500">Condition at return: {ln.conditionAfter.note}</p>
                )}
                {ln.extensionUntil && (
                  <p className="mt-1.5 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-1.5 text-[11px] text-amber-300">
                    Extension requested until {new Date(ln.extensionUntil).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" })}
                  </p>
                )}
                {ln.counterUntil && (
                  <p className="mt-1.5 rounded-lg border border-sky-400/30 bg-sky-400/5 px-3 py-1.5 text-[11px] text-sky-300">
                    Owner proposed a different return: {new Date(ln.counterUntil).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" })}
                  </p>
                )}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line-soft pt-2.5">
                  {ln.myRole === "lender" && ln.status === "requested" && (
                    <>
                      <button onClick={() => loanAct(ln.id, { action: "approve" })} className="btn-lime px-3 py-1.5 text-[11px]"><Check className="h-3 w-3" /> Accept</button>
                      <button onClick={() => loanAct(ln.id, { action: "decline" })} className="btn-ghost px-3 py-1.5 text-[11px]">Decline</button>
                    </>
                  )}
                  {ln.myRole === "lender" && ln.status === "approved" && (
                    <button
                      onClick={() => {
                        const note = window.prompt("Document the item's condition at handoff (scratches, accessories included…):") ?? "";
                        loanAct(ln.id, { action: "handoff", note });
                      }}
                      className="btn-lime px-3 py-1.5 text-[11px]"
                    >
                      Handed over — document condition
                    </button>
                  )}
                  {ln.myRole === "borrower" && ln.status === "borrowed" && (
                    <>
                      <button onClick={() => loanAct(ln.id, { action: "mark_returned" })} className="btn-lime px-3 py-1.5 text-[11px]"><RotateCcw className="h-3 w-3" /> Mark returned</button>
                      {!ln.extensionUntil && !ln.counterUntil && (
                        <button
                          onClick={() => {
                            const until = window.prompt("Need more time? New return date & time (YYYY-MM-DD HH:MM):");
                            if (until) loanAct(ln.id, { action: "request_extension", until: until.replace(" ", "T") });
                          }}
                          className="btn-ghost px-3 py-1.5 text-[11px]"
                        >
                          Request extension
                        </button>
                      )}
                      {ln.counterUntil && (
                        <>
                          <button onClick={() => loanAct(ln.id, { action: "counter_decide", accept: true })} className="btn-lime px-3 py-1.5 text-[11px]">Accept new date</button>
                          <button onClick={() => loanAct(ln.id, { action: "counter_decide", accept: false })} className="btn-ghost px-3 py-1.5 text-[11px]">Decline</button>
                        </>
                      )}
                    </>
                  )}
                  {ln.myRole === "lender" && ln.extensionUntil && (
                    <>
                      <button onClick={() => loanAct(ln.id, { action: "extension_decide", approve: true })} className="btn-lime px-3 py-1.5 text-[11px]">Approve extension</button>
                      <button onClick={() => loanAct(ln.id, { action: "extension_decide", approve: false })} className="btn-ghost px-3 py-1.5 text-[11px]">Decline</button>
                    </>
                  )}
                  {ln.myRole === "lender" && ln.status === "borrowed" && !ln.counterUntil && (
                    <button
                      onClick={() => {
                        const until = window.prompt("Propose a different return date & time (YYYY-MM-DD HH:MM):");
                        if (until) loanAct(ln.id, { action: "extension_counter", until: until.replace(" ", "T") });
                      }}
                      className="btn-ghost px-3 py-1.5 text-[11px]"
                    >
                      Propose different date
                    </button>
                  )}
                  {ln.myRole === "lender" && ["return_claimed", "borrowed"].includes(ln.status) && ln.status !== "requested" && (
                    <>
                      <button
                        onClick={() => {
                          const note = window.prompt("Confirm return — condition notes (optional):") ?? "";
                          loanAct(ln.id, { action: "confirm_return", note });
                        }}
                        className="btn-lime px-3 py-1.5 text-[11px]"
                      >
                        <Check className="h-3 w-3" /> Returned in good shape
                      </button>
                      <button
                        onClick={() => {
                          const note = window.prompt("What's wrong? (damage / missing parts / missing item)");
                          if (note) loanAct(ln.id, { action: "confirm_return", problem: true, note });
                        }}
                        className="rounded-full px-3 py-1.5 text-[11px] text-zinc-500 hover:text-rose-300"
                      >
                        Report damage/missing
                      </button>
                    </>
                  )}
                  {ln.myRole === "borrower" && ["requested", "approved"].includes(ln.status) && (
                    <button onClick={() => loanAct(ln.id, { action: "cancel" })} className="rounded-full px-3 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-300">Cancel</button>
                  )}
                  {ln.conversationId && (
                    <Link href={`/messages?c=${ln.conversationId}`} className="btn-ghost ml-auto px-3 py-1.5 text-[11px]">
                      <MessageSquare className="h-3 w-3" /> Message
                    </Link>
                  )}
                </div>
              </article>
            ))}
            </>
          )}
          <p className="flex items-start gap-2 rounded-xl border border-line-soft bg-card-raised/40 px-3.5 py-2.5 text-[11px] leading-relaxed text-zinc-500">
            <HandHeart className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />
            Borrowing is free — this is students helping students, not a rental business. Condition is
            documented at handoff and at return, so both sides are protected.
          </p>
        </div>
      )}
    </div>
  );
}
