"use client";

/* ------------------------------------------------------------------ */
/*  Orders — the buyer SEES what's happening instead of hoping.        */
/*  Timeline: placed → secured → preparing → shipped (carrier /        */
/*  tracking / eta) → delivered → completed (payout released).         */
/*  Buyer: pay · confirm received · cancel · report a problem.         */
/*  Seller: preparing · ship (with tracking) · hand off · cancel.      */
/*  Reports open a HUMAN dispute review — never an automatic refund.   */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Package, Truck, Flag, MessageSquare, Check } from "lucide-react";
import Avatar from "@/components/Avatar";
import TrustReportModal from "@/components/TrustReportModal";
import { useSession } from "@/lib/session";
import { ORDER_FLOW, ORDER_STATUS_LABEL, ORDER_REPORT_REASONS, FULFILLMENT_LABEL, type OrderTracking, type ProductFulfillment } from "@/lib/products";

interface Order {
  id: string;
  productId: string | null;
  title: string;
  price: number;
  qty: number;
  variant: string;
  fulfillment: ProductFulfillment;
  status: string;
  tracking: OrderTracking;
  paymentStatus: string | null;
  conversationId: string | null;
  myRole: "buyer" | "seller";
  with: { handle: string; displayName: string; avatarUrl: string | null };
  createdAt: string;
}

export default function OrdersPage() {
  const { user: me } = useSession();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [tab, setTab] = useState<"buying" | "selling">("buying");
  const [reporting, setReporting] = useState<Order | null>(null);
  const [shipFor, setShipFor] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("USPS");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/orders", { cache: "no-store" });
    if (!res.ok) return setOrders([]);
    setOrders((await res.json()).orders ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, body: Record<string, unknown>) => {
    setError(null);
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) setError((await res.json()).error || "Could not update");
    setShipFor(null);
    load();
  };

  if (me === null)
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <p className="text-sm font-semibold text-zinc-200">Create an account to see orders</p>
        <div className="mt-4 flex justify-center gap-2">
          <Link href="/signup?next=%2Forders" className="btn-lime px-5 py-2 text-sm">Create account</Link>
          <Link href="/login?next=%2Forders" className="btn-ghost px-4 py-2 text-sm">Sign in</Link>
        </div>
      </div>
    );

  const mine = (orders ?? []).filter((o) => (tab === "buying" ? o.myRole === "buyer" : o.myRole === "seller"));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
          <Package className="h-5 w-5 text-lime-400" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Orders</h1>
          <p className="text-sm text-zinc-400">Every purchase shows its real state — funds are held until delivery.</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 border-b border-line-soft text-sm">
        {(["buying", "selling"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 pb-2.5 capitalize transition ${tab === t ? "border-white font-semibold text-zinc-50" : "border-transparent font-medium text-zinc-500 hover:text-zinc-300"}`}>
            {t}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-xs font-medium text-rose-300">{error}</p>}

      <div className="mt-4 space-y-3">
        {orders === null ? (
          <div className="card h-32 animate-pulse" aria-hidden />
        ) : mine.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm font-semibold text-zinc-200">No orders {tab === "buying" ? "yet" : "on the selling side"}</p>
            <Link href="/shop" className="btn-lime mt-4 inline-flex px-4 py-2 text-xs">Browse the Shop</Link>
          </div>
        ) : (
          mine.map((o) => {
            const flowIdx = ORDER_FLOW.indexOf(o.status as (typeof ORDER_FLOW)[number]);
            const cancelled = o.status === "cancelled";
            return (
              <article key={o.id} className={`card p-4 ${cancelled ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-3">
                  <Avatar src={o.with.avatarUrl} initials={o.with.displayName.charAt(0)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-100">
                      {o.title}
                      <span className="font-mono text-xs font-medium tracking-[0.08em] text-lime-300">${o.price * o.qty}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cancelled ? "border-line text-zinc-500" : o.status === "completed" ? "border-lime-400/40 text-lime-300" : "border-amber-400/40 text-amber-300"}`}>
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Order #{o.id.slice(0, 8).toUpperCase()} · {o.myRole === "buyer" ? "from" : "for"} {o.with.displayName}
                      {o.variant && ` · ${o.variant}`} · {FULFILLMENT_LABEL[o.fulfillment] ?? o.fulfillment}
                    </p>
                  </div>
                </div>

                {/* ------------------------ the timeline ------------------------ */}
                {!cancelled && (
                  <ol className="mt-3 space-y-1 border-t border-line-soft pt-3">
                    {ORDER_FLOW.map((step, i) => {
                      const done = flowIdx >= i;
                      const isTrack = step === "shipped";
                      return (
                        <li key={step} className="flex items-start gap-2 text-xs">
                          <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${done ? "border-lime-400 bg-lime-400/20" : "border-line"}`}>
                            {done && <Check className="h-2.5 w-2.5 text-lime-300" />}
                          </span>
                          <span className={done ? "text-zinc-200" : "text-zinc-600"}>
                            {ORDER_STATUS_LABEL[step]}
                            {isTrack && done && (o.tracking.carrier || o.tracking.code) && (
                              <span className="ml-1.5 font-mono text-[10px] tracking-[0.05em] text-zinc-400">
                                {o.tracking.carrier}{o.tracking.code ? ` · ${o.tracking.code}` : ""}
                                {o.tracking.eta ? ` · est. ${new Date(o.tracking.eta).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                              </span>
                            )}
                            {step === "secured" && done && o.paymentStatus && (
                              <span className="ml-1.5 text-[10px] text-zinc-500">
                                (funds {o.paymentStatus === "released" ? "released to seller" : o.paymentStatus === "refunded" ? "refunded" : "held by UpNova"})
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}

                {/* ------------------------- actions ------------------------- */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
                  {o.myRole === "buyer" && o.status === "placed" && (
                    <button onClick={() => act(o.id, { action: "pay", expectedTotal: +(o.price * o.qty * 1.05).toFixed(2) })} className="btn-lime px-3.5 py-1.5 text-xs">
                      Pay ${(o.price * o.qty * 1.05).toFixed(2)} — demo payment
                    </button>
                  )}
                  {o.myRole === "buyer" && ["shipped", "delivered"].includes(o.status) && (
                    <button onClick={() => act(o.id, { action: "confirm_received" })} className="btn-lime px-3.5 py-1.5 text-xs">
                      <Check className="h-3.5 w-3.5" /> Confirm received — release ${o.price * o.qty}
                    </button>
                  )}
                  {o.myRole === "seller" && o.status === "secured" && (
                    <>
                      {o.fulfillment === "shipping" ? (
                        shipFor === o.id ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier" className="w-24 rounded-lg border border-line bg-card-raised px-2.5 py-1.5 text-xs text-zinc-100 outline-none" />
                            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Tracking number" className="w-44 rounded-lg border border-line bg-card-raised px-2.5 py-1.5 text-xs text-zinc-100 outline-none" />
                            <button onClick={() => act(o.id, { action: "ship", carrier, code, eta: new Date(Date.now() + 5 * 86400_000).toISOString() })} className="btn-lime px-3 py-1.5 text-xs">
                              <Truck className="h-3.5 w-3.5" /> Mark shipped
                            </button>
                          </span>
                        ) : (
                          <button onClick={() => setShipFor(o.id)} className="btn-lime px-3.5 py-1.5 text-xs">
                            <Truck className="h-3.5 w-3.5" /> Ship it
                          </button>
                        )
                      ) : (
                        <button onClick={() => act(o.id, { action: "handoff" })} className="btn-lime px-3.5 py-1.5 text-xs">
                          Mark handed off
                        </button>
                      )}
                    </>
                  )}
                  {o.conversationId && (
                    <Link href={`/messages?c=${o.conversationId}`} className="btn-ghost px-3 py-1.5 text-xs">
                      <MessageSquare className="h-3.5 w-3.5" /> Message
                    </Link>
                  )}
                  {["placed", "secured", "preparing"].includes(o.status) && (
                    <button onClick={() => act(o.id, { action: "cancel" })} className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:text-rose-300">
                      Cancel{o.status !== "placed" ? " — full refund" : ""}
                    </button>
                  )}
                  {o.myRole === "buyer" && !["placed", "cancelled"].includes(o.status) && (
                    <button onClick={() => setReporting(o)} className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:text-rose-300">
                      <Flag className="h-3.5 w-3.5" /> Report a problem
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {reporting && (
        <TrustReportModal
          targetType="order"
          targetId={reporting.id}
          targetLabel={`order ${reporting.title}`}
          reasons={ORDER_REPORT_REASONS}
          onClose={() => setReporting(null)}
        />
      )}
    </div>
  );
}
