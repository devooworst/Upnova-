"use client";

/* ------------------------------------------------------------------ */
/*  Product page — the shareable unit for "buy this".                  */
/*  Guests see everything (photos, price, variants, seller's VERIFIED  */
/*  history); the account ask happens at Buy. Mavyn checkout secures  */
/*  funds until delivery; external listings say exactly where the      */
/*  purchase actually happens.                                         */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { PaymentDirection } from "@/components/PaymentDirection";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Tag, Star, Lock, Link2, Check, ExternalLink, BadgeCheck, ShieldCheck } from "lucide-react";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useSession } from "@/lib/session";
import { promptJoin } from "@/components/GuestGate";
import { PublishedBanner } from "@/components/ShareSheet";
import { FULFILLMENT_LABEL, type ProductFulfillment, type VariantGroup } from "@/lib/products";

interface ProductDetail {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  available: number;
  sold: number;
  soldOut: boolean;
  archived: boolean;
  variants: VariantGroup[];
  fulfillment: ProductFulfillment[];
  media: string[];
  external: boolean;
  externalUrl: string | null;
  returnPolicyLines?: string[];
  protection?: { tier: string; protectionHours: number; sellerEvidenceRequired: boolean };
  seller: { id: string; handle: string; displayName: string; avatarUrl: string | null; verified: boolean; roleLine: string; locationLabel?: string | null };
  sellerStats: { completedOrders: number; rating: number | null; reviewsCount: number; identityVerified: boolean; businessVerified: boolean; joined: string };
  otherListings: { id: string; title: string; price: number }[];
  isMine: boolean;
}

const CONDITION_LABEL: Record<string, string> = { new: "New", like_new: "Like new", used: "Used" };

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useSession();
  const [p, setP] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // buy flow
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [fulfillment, setFulfillment] = useState<ProductFulfillment | null>(null);
  const [step, setStep] = useState<"browse" | "pay" | "done">("browse");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/products/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) setError(d.error || "Not found");
        else {
          setP(d.product);
          setFulfillment(d.product.fulfillment[0] ?? null);
        }
      })
      .catch(() => setError("Network error"));
  }, [id]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const subtotal = p ? p.price : 0;
  const fee = Math.round(subtotal * 5) / 100;
  const total = subtotal + fee;

  const buy = async () => {
    if (!p) return;
    if (me === null) return promptJoin("buy", `/shop/${p.id}`);
    for (const g of p.variants) if (!picks[g.name]) return setBuyError(`Pick a ${g.name}`);
    setBusy(true);
    setBuyError(null);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: p.id, qty: 1, variants: picks, fulfillment }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setBuyError(d.error || "Could not place the order");
    setOrderId(d.id);
    setStep("pay");
  };

  const pay = async () => {
    if (!orderId) return;
    setBusy(true);
    setBuyError(null);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pay", expectedTotal: +total.toFixed(2) }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setBuyError(d.error || "Payment failed");
    setStep("done");
  };

  if (error)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold text-zinc-200">{error}</p>
        <Link href="/shop" className="btn-ghost mt-4 inline-flex px-4 py-1.5 text-xs">Browse the Shop</Link>
      </div>
    );
  if (!p) return <div className="card-shop mx-auto h-64 max-w-2xl animate-pulse" aria-hidden />;

  const s = p.sellerStats;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/shop" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="h-3.5 w-3.5" /> Shop
      </Link>

      <PublishedBanner path={`/shop/${p.id}`} title={`${p.title} — $${p.price} on Mavyn`} text={p.external ? "Sold on the seller's website" : "Funds held until delivery"} />

      <article className="card-shop p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 capitalize">
              Product · {p.category}
              {p.condition && ` · ${CONDITION_LABEL[p.condition]}`}
              {p.soldOut && <span className="ml-2 text-rose-300">· Sold out</span>}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">{p.title}</h1>
            <p className="mt-0.5 font-mono text-lg font-medium tracking-[0.08em] text-lime-300">${p.price}</p>
          </div>
          <button onClick={share} className="btn-ghost shrink-0 px-3 py-1.5 text-xs" title="Copy link — anyone can view it, no account needed">
            {copied ? <Check className="h-3.5 w-3.5 text-lime-300" /> : <Link2 className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Share"}
          </button>
        </div>

        {p.media.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {p.media.map((m, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={m} alt={`${p.title} ${i + 1}`} className="h-40 w-40 shrink-0 rounded-xl border border-line object-cover" />
            ))}
          </div>
        )}

        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-300">{p.description}</p>
        <p className="mt-2 text-[11px] text-zinc-500">
          {p.available > 0 ? `${p.available} available` : "None available"} · {p.sold} sold
          {p.seller.locationLabel ? ` · Ships from ${p.seller.locationLabel}` : ""}
        </p>

        {/* ------------------------- buy panel ------------------------- */}
        {step === "done" ? (
          <div className="mt-5 rounded-xl border border-lime-400/40 bg-lime-400/5 p-4 text-center">
            <p className="text-sm font-bold text-lime-300">Payment secured — ${total.toFixed(2)}</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-zinc-400">
              Funds are held until you confirm delivery. Follow every step — placed, secured, preparing,
              shipped, delivered — in your orders.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Link href="/orders" className="btn-lime px-4 py-2 text-xs">Track your order</Link>
              <Link href="/messages" className="btn-ghost px-4 py-2 text-xs">Message seller</Link>
            </div>
          </div>
        ) : p.external ? (
          <div className="mt-5 border-t border-dashed border-line pt-4">
            <a href={p.externalUrl!} target="_blank" rel="noopener noreferrer" className="btn-lime w-full justify-center py-2.5 text-sm">
              <ExternalLink className="h-4 w-4" /> Shop Website
            </a>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
              External checkout — you&apos;ll complete your purchase on the seller&apos;s website. Mavyn doesn&apos;t process this sale.
            </p>
          </div>
        ) : p.soldOut || p.archived ? (
          <p className="mt-5 rounded-xl border border-line px-4 py-2.5 text-center text-sm text-zinc-500">
            {p.archived ? "This listing is no longer available." : "Sold out — kept as part of the seller's history."}
          </p>
        ) : p.isMine ? (
          <Link href="/shop" className="btn-ghost mt-5 w-full justify-center py-2.5 text-sm">Your listing — manage from the Shop</Link>
        ) : step === "pay" ? (
          <div className="mt-5 space-y-3 border-t border-dashed border-line pt-4">
            <p className="rounded-lg border border-violet-400/25 bg-violet-400/5 px-3 py-2 text-[11px] text-zinc-400">
              <span className="font-bold text-violet-300">Demo payment.</span> Simulated — no real money moves.
              Funds stay held until you confirm delivery.
            </p>
            <dl className="space-y-1.5 rounded-xl border border-line bg-card-raised p-3.5 text-sm">
              <div className="flex justify-between"><dt className="text-zinc-500">{p.title}{Object.keys(picks).length ? ` (${Object.entries(picks).map(([k, v]) => `${k}: ${v}`).join(" · ")})` : ""}</dt><dd className="font-mono tracking-[0.08em] text-zinc-200">${subtotal.toFixed(2)}</dd></div>
              <div className="flex justify-between"><dt className="text-zinc-500">Mavyn fee (5%)</dt><dd className="font-mono tracking-[0.08em] text-zinc-200">${fee.toFixed(2)}</dd></div>
              <div className="flex justify-between border-t border-dashed border-line pt-1.5 font-semibold"><dt className="text-zinc-200">Total</dt><dd className="font-mono tracking-[0.08em] text-lime-300">${total.toFixed(2)}</dd></div>
            </dl>
            {buyError && <p className="text-xs font-medium text-rose-300">{buyError}</p>}
            <PaymentDirection side="paying" name={p.seller.displayName} context={p.title} amount={`$${total.toFixed(2)}`} />
            <button onClick={pay} disabled={busy} className="btn-pay w-full justify-center py-2.5 text-sm disabled:opacity-40">
              {busy ? "Processing…" : `Pay $${total.toFixed(2)}`}
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-3 border-t border-dashed border-line pt-4">
            {p.variants.map((g) => (
              <div key={g.name}>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{g.name}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {g.options.map((o) => (
                    <button
                      key={o}
                      onClick={() => setPicks((cur) => ({ ...cur, [g.name]: o }))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        picks[g.name] === o ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {p.fulfillment.length > 1 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">How do you want it?</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {p.fulfillment.map((f) => (
                    <button key={f} onClick={() => setFulfillment(f)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${fulfillment === f ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
                      {FULFILLMENT_LABEL[f]}
                    </button>
                  ))}
                </div>
                {fulfillment === "pickup" && (
                  <p className="mt-1.5 text-[11px] text-zinc-600">Exact location shared after confirmation — nobody&apos;s address is public.</p>
                )}
              </div>
            )}
            {buyError && <p className="text-xs font-medium text-rose-300">{buyError}</p>}
            <button onClick={buy} disabled={busy} className="btn-lime w-full justify-center py-2.5 text-sm disabled:opacity-40">
              <Tag className="h-4 w-4" /> {busy ? "Placing order…" : "Buy now"}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
              <ShieldCheck className="h-3 w-3 text-lime-400" /> Payment held until you confirm delivery.
            </p>
            {me === null && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-zinc-500">
                <Lock className="h-3 w-3" /> Create a free account to buy — orders, payments, and tracking in one place.
              </p>
            )}
          </div>
        )}

        {/* returns & protection — the terms, BEFORE any money moves */}
        {!p.external && (
          <div className="mt-4 rounded-xl border border-line bg-card-raised/50 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Returns &amp; buyer protection — before you pay</p>
            <ul className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-zinc-400">
              {(p.returnPolicyLines ?? []).map((l) => (
                <li key={l} className="flex items-start gap-1.5">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" /> {l}
                </li>
              ))}
              {p.protection && (
                <li className="flex items-start gap-1.5 text-zinc-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-lime-400/70" />
                  Payment held until delivery + a {p.protection.protectionHours}h protection window after it
                  {p.protection.sellerEvidenceRequired ? " · high-value: seller records item evidence before shipping" : ""}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* --------------------- seller — verified history --------------------- */}
        <div className="mt-5 rounded-xl border border-line bg-card-raised/50 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Seller</p>
          <div className="mt-2 flex items-center gap-3">
            <Link href={`/creator/${p.seller.handle}`}>
              <Avatar src={p.seller.avatarUrl} initials={p.seller.displayName.charAt(0)} size="md" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/creator/${p.seller.handle}`} className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-zinc-100 hover:text-violet-300">
                {p.seller.displayName}
                {p.seller.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
              </Link>
              <p className="truncate text-xs text-zinc-500">{p.seller.roleLine}</p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line-soft pt-2.5 text-[11px] text-zinc-400">
            {s.identityVerified && (
              <span className="inline-flex items-center gap-1 text-lime-300"><BadgeCheck className="h-3 w-3" /> Identity Verified</span>
            )}
            {s.businessVerified && (
              <span className="inline-flex items-center gap-1 text-sky-300"><BadgeCheck className="h-3 w-3" /> Business Verified</span>
            )}
            {s.rating != null && (
              <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {s.rating.toFixed(1)} · {s.reviewsCount} review{s.reviewsCount === 1 ? "" : "s"}</span>
            )}
            <span>{s.completedOrders} completed order{s.completedOrders === 1 ? "" : "s"}</span>
            <span>Joined {new Date(s.joined).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
          </div>
          {p.otherListings.length > 0 && (
            <div className="mt-2.5 border-t border-line-soft pt-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-600">Other listings</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {p.otherListings.map((o) => (
                  <Link key={o.id} href={`/shop/${o.id}`} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200">
                    {o.title} · <span className="font-mono tracking-[0.05em] text-lime-300">${o.price}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          <p className="mt-2.5 text-[10px] leading-relaxed text-zinc-600">
            These are the things Mavyn has actually verified and counted — not a guarantee. Problems with an
            order? Report it from your orders page and a human reviews it.
          </p>
        </div>
      </article>
    </div>
  );
}
