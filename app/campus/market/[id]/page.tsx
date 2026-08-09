"use client";

/* Campus listing page — the type decides the action: Buy (protected
   order) · Claim (FCFS) · Bid · Request to Borrow · I Can Lend Mine ·
   Make an Offer / Propose a Trade (Messages). Guests browse; verified
   campus members transact. */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, Flag, Lock, Star, BadgeCheck, Gavel, HandHeart } from "lucide-react";
import Avatar from "@/components/Avatar";
import TrustReportModal from "@/components/TrustReportModal";
import ShareSheet, { PublishedBanner } from "@/components/ShareSheet";
import { useSession } from "@/lib/session";
import { promptJoin } from "@/components/GuestGate";
import { CAMPUS_REPORT_REASONS, typeLabel, typeCta } from "@/lib/campusMarket";

interface ListingDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  price: number | null;
  condition: string;
  media: string[];
  quantity: number;
  claimed: number;
  status: string;
  campus: string;
  fulfillment: string[];
  meetSpot: string | null;
  firstCome: boolean;
  expiresAt: string | null;
  auctionEndsAt: string | null;
  reservePrice: boolean;
  bidIncrement: number;
  bids: { by: string; amount: number; at: string; mine: boolean }[];
  topBid: number | null;
  maxBorrowDays: number | null;
  allowExtensions: boolean;
  deposit: number | null;
  claimedByMe: boolean;
  member: boolean;
  seller: { id: string; handle: string; displayName: string; avatarUrl: string | null; verified: boolean; roleLine: string };
  sellerRep: { campusVerified: boolean; completedOrders: number; completedLoans: number; rating: number | null; reviewsCount: number; joined: string };
  isMine: boolean;
}

const CONDITION_LABEL: Record<string, string> = { new: "New", like_new: "Like new", good: "Good", fair: "Fair" };
const FULFILL_LABEL: Record<string, string> = { pickup: "Campus pickup", campus_delivery: "Campus delivery", shipping: "Shipping", flexible: "Flexible" };

export default function CampusListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useSession();
  const [l, setL] = useState<ListingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [borrowUntil, setBorrowUntil] = useState("");
  const [borrowMsg, setBorrowMsg] = useState("");
  const [reporting, setReporting] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/campus/market/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) setError(d.error || "Not found");
        else setL(d.listing);
      })
      .catch(() => setError("Network error"));
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (body: Record<string, unknown>, onOk?: (d: Record<string, unknown>) => void) => {
    if (!l) return;
    if (me === null) return promptJoin("buy", `/campus/market/${l.id}`);
    setBusy(true);
    setNotice(null);
    const res = await fetch(`/api/campus/market/${l.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setNotice(d.error || "Could not do that");
    onOk?.(d);
    load();
  };

  if (error)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold text-zinc-200">{error}</p>
        <Link href="/campus/market" className="btn-ghost mt-4 inline-flex px-4 py-1.5 text-xs">Back to the marketplace</Link>
      </div>
    );
  if (!l) return <div className="card mx-auto h-64 max-w-2xl animate-pulse" aria-hidden />;

  const done = ["completed", "expired", "archived"].includes(l.status) || (l.status === "reserved" && !l.claimedByMe);
  const minBid = l.topBid ? l.topBid + l.bidIncrement : l.price ?? 1;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/campus/market" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="h-3.5 w-3.5" /> Campus Marketplace
      </Link>

      <PublishedBanner path={`/campus/market/${l.id}`} title={`${l.title} — ${typeLabel(l.type)} on the ${l.campus} marketplace`} />

      <article className="card-people p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {l.type === "need_borrow" ? "Needs to borrow" : typeLabel(l.type)} · {l.campus}
              {l.condition && ` · ${CONDITION_LABEL[l.condition]}`}
              {l.status !== "active" && <span className="ml-2 text-amber-300">· {l.status}</span>}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">{l.title}</h1>
            <p className="mt-0.5 font-mono text-lg font-medium tracking-[0.08em] text-lime-300">
              {l.type === "auction"
                ? l.topBid ? `Top bid $${l.topBid}` : `Starting at $${l.price}`
                : l.type === "free" ? "Free — you keep it"
                : l.type === "borrow" ? "Free to borrow — it comes back"
                : l.type === "need_borrow" ? "Looking for a lender"
                : l.type === "trade" ? "Open to trades"
                : `$${l.price}${l.type === "negotiable" ? " OBO" : ""}`}
            </p>
          </div>
          <ShareSheet path={`/campus/market/${l.id}`} title={`${l.title} — ${l.campus} marketplace`} compact />
        </div>

        {l.media.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {l.media.map((m, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={m} alt={`${l.title} ${i + 1}`} className="h-40 w-40 shrink-0 rounded-xl border border-line object-cover" />
            ))}
          </div>
        )}

        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-300">{l.description}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
          {l.fulfillment.map((f) => <span key={f}>{FULFILL_LABEL[f] ?? f}</span>)}
          {l.meetSpot ? <span>Meet: {l.meetSpot}</span> : !l.member && <span className="text-zinc-600">Meeting spot visible to verified campus members</span>}
          {l.type === "free" && l.firstCome && <span className="text-violet-300">First come, first served</span>}
          {l.quantity > 1 && <span>{l.quantity - l.claimed} of {l.quantity} left</span>}
          {l.expiresAt && <span>Listed until {new Date(l.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
        </p>

        {/* the FREE vs BORROW line, always explicit */}
        {["free", "borrow"].includes(l.type) && (
          <p className={`mt-3 rounded-xl border px-3.5 py-2 text-xs ${l.type === "free" ? "border-violet-400/30 bg-violet-400/5 text-violet-200" : "border-sky-400/30 bg-sky-400/5 text-sky-200"}`}>
            {l.type === "free"
              ? "FREE: whoever claims it keeps it."
              : `BORROW: it stays ${l.seller.displayName.split(" ")[0]}'s property and must come back${l.maxBorrowDays ? ` within ${l.maxBorrowDays} day${l.maxBorrowDays > 1 ? "s" : ""}` : ""}. Borrowing is free${l.deposit ? `; a refundable $${l.deposit} deposit protects the item` : ""}.`}
          </p>
        )}

        {/* ------------------------- action block ------------------------- */}
        <div className="mt-5 border-t border-dashed border-line pt-4">
          {notice && <p className="mb-2 text-xs font-medium text-rose-300">{notice}</p>}
          {l.isMine ? (
            <div className="flex gap-2">
              {l.status === "reserved" && (
                <button onClick={() => act({ action: "complete" })} className="btn-lime px-4 py-2 text-xs">Mark completed</button>
              )}
              {l.status === "active" && (
                <button onClick={() => act({ action: "archive" })} className="btn-ghost px-4 py-2 text-xs">Archive listing</button>
              )}
              <span className="self-center text-xs text-zinc-500">Your listing.</span>
            </div>
          ) : done ? (
            <p className="rounded-xl border border-line px-4 py-2.5 text-center text-sm text-zinc-500">
              {l.status === "reserved" ? "Reserved — someone got here first." : "No longer available — kept as history."}
            </p>
          ) : !l.member && me !== null ? (
            <p className="rounded-xl border border-violet-400/30 bg-violet-400/5 px-4 py-2.5 text-center text-xs text-zinc-300">
              <Link href="/campus" className="font-semibold text-violet-300 underline-offset-2 hover:underline">Verify your campus</Link> to {typeCta(l.type).toLowerCase()}.
            </p>
          ) : (
            <>
              {l.type === "fixed" && (
                <button onClick={() => act({ action: "buy" }, (d) => router.push("/orders"))} disabled={busy} className="btn-lime w-full justify-center py-2.5 text-sm disabled:opacity-40">
                  Buy — ${l.price} through protected orders
                </button>
              )}
              {l.type === "free" && (
                l.claimedByMe ? (
                  <p className="rounded-xl border border-lime-400/40 bg-lime-400/5 px-4 py-2.5 text-center text-sm text-lime-300">
                    Reserved for you — arrange pickup in Messages.
                  </p>
                ) : (
                  <button onClick={() => act({ action: "claim" }, (d) => router.push(`/messages?c=${d.conversationId}`))} disabled={busy} className="btn-lime w-full justify-center py-2.5 text-sm disabled:opacity-40">
                    Claim Item — first come, first served
                  </button>
                )
              )}
              {["negotiable", "trade"].includes(l.type) && (
                <button onClick={() => act({ action: "message" }, (d) => router.push(`/messages?c=${d.conversationId}`))} disabled={busy} className="btn-lime w-full justify-center py-2.5 text-sm disabled:opacity-40">
                  {typeCta(l.type)} — in Messages
                </button>
              )}
              {l.type === "auction" && (
                <div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-32">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
                      <input value={bidAmount} onChange={(e) => setBidAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder={String(minBid)} className="w-full rounded-xl border border-line bg-card-raised py-2.5 pl-7 pr-3 text-sm text-zinc-100 outline-none focus:border-amber-400/50" />
                    </div>
                    <button onClick={() => act({ action: "bid", amount: Number(bidAmount) })} disabled={busy || !bidAmount} className="btn-lime flex-1 justify-center py-2.5 text-sm disabled:opacity-40">
                      <Gavel className="h-4 w-4" /> Place bid (min ${minBid})
                    </button>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <Clock className="h-3 w-3 text-amber-300" />
                    {l.auctionEndsAt ? `Ends ${new Date(l.auctionEndsAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" })}` : ""}
                    {l.reservePrice ? " · reserve price set" : ""} · winner pays within 48h via protected orders
                  </p>
                  {l.bids.length > 0 && (
                    <ul className="mt-2 space-y-0.5 rounded-xl border border-line-soft bg-card-raised/50 px-3.5 py-2 text-[11px] text-zinc-400">
                      {l.bids.map((b, i) => (
                        <li key={i} className="flex justify-between">
                          <span>{b.by}{b.mine ? " (you)" : ""}</span>
                          <span className="font-mono tracking-[0.05em] text-zinc-300">${b.amount}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {l.type === "borrow" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    Return by
                    <input type="datetime-local" value={borrowUntil} onChange={(e) => setBorrowUntil(e.target.value)} className="rounded-lg border border-line bg-card-raised px-2.5 py-2 text-xs text-zinc-100 outline-none focus:border-sky-400/50" />
                  </div>
                  <input value={borrowMsg} onChange={(e) => setBorrowMsg(e.target.value)} placeholder={`Why do you need it? (optional, helps ${l.seller.displayName.split(" ")[0]} say yes)`} maxLength={300} className="w-full rounded-xl border border-line bg-card-raised px-3.5 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-400/50" />
                  <button
                    onClick={() => borrowUntil ? act({ action: "borrow", until: new Date(borrowUntil).toISOString(), message: borrowMsg }, () => setNotice(null)) : setNotice("Pick when you'll return it")}
                    disabled={busy}
                    className="btn-lime w-full justify-center py-2.5 text-sm disabled:opacity-40"
                  >
                    <HandHeart className="h-4 w-4" /> Request to Borrow — free
                  </button>
                  <p className="text-center text-[11px] text-zinc-500">The owner approves, condition gets documented at handoff and at return.</p>
                </div>
              )}
              {l.type === "need_borrow" && (
                <button onClick={() => act({ action: "offer_lend" }, (d) => router.push(`/messages?c=${d.conversationId}`))} disabled={busy} className="btn-lime w-full justify-center py-2.5 text-sm disabled:opacity-40">
                  <HandHeart className="h-4 w-4" /> I Can Lend Mine
                </button>
              )}
              {me === null && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
                  <Lock className="h-3 w-3" /> Create an account + verify your campus to participate.
                </p>
              )}
            </>
          )}
        </div>

        {/* --------------------- seller reputation --------------------- */}
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card-raised/50 p-3.5">
          <Link href={`/creator/${l.seller.handle}`}>
            <Avatar src={l.seller.avatarUrl} initials={l.seller.displayName.charAt(0)} size="md" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/creator/${l.seller.handle}`} className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-zinc-100 hover:text-violet-300">
              {l.seller.displayName}
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-violet-300">
                <BadgeCheck className="h-3 w-3" /> Campus Verified
              </span>
            </Link>
            <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-500">
              {l.sellerRep.completedOrders} completed transaction{l.sellerRep.completedOrders === 1 ? "" : "s"}
              {l.sellerRep.completedLoans > 0 && <span>· {l.sellerRep.completedLoans} loan{l.sellerRep.completedLoans === 1 ? "" : "s"} completed</span>}
              {l.sellerRep.rating != null && (
                <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {l.sellerRep.rating.toFixed(1)}</span>
              )}
              <span>· joined {new Date(l.sellerRep.joined).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
            </p>
          </div>
          {me && !l.isMine && (
            <button onClick={() => setReporting(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-zinc-500 transition hover:text-rose-300">
              <Flag className="h-3.5 w-3.5" /> Report
            </button>
          )}
        </div>
      </article>

      {reporting && (
        <TrustReportModal
          targetType="campus_listing"
          targetId={l.id}
          targetLabel={`campus listing "${l.title}"`}
          reasons={CAMPUS_REPORT_REASONS}
          onClose={() => setReporting(false)}
        />
      )}
    </div>
  );
}
