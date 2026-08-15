"use client";

/* ------------------------------------------------------------------ */
/*  Orders — professional-marketplace protection with a simple face.   */
/*                                                                     */
/*  Normal path stays: Buy → Track → Receive → (confirm or just wait — */
/*  the protection window auto-completes). Something wrong?            */
/*  Report a problem / Request return → evidence → resolution.         */
/*  Sellers: Ship (+ evidence on high-value) → track → respond →       */
/*  payout. Disputes freeze funds; nobody wins by default.             */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react";
import { PaymentDirection } from "@/components/PaymentDirection";
import Link from "next/link";
import { Package, Truck, Flag, MessageSquare, Check, X, RotateCcw, Clock, FileText, ImagePlus } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useSession } from "@/lib/session";
import { ORDER_STATUS_LABEL, FULFILLMENT_LABEL, type OrderTracking, type ProductFulfillment } from "@/lib/products";
import { PROBLEM_REASONS, RETURN_REASONS, DISPUTE_STATUS_LABEL } from "@/lib/protection";

const FLOW = ["placed", "secured", "preparing", "shipped", "delivered", "protection", "completed"] as const;
const FLOW_LABEL: Record<string, string> = {
  ...ORDER_STATUS_LABEL,
  protection: "Buyer-protection window",
  completed: "Completed — funds released",
};

interface DisputeSummary {
  id: string;
  kind: "problem" | "return";
  reason: string;
  status: string;
  openedByMe: boolean;
}

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
  protectionEndsAt: string | null;
  protection: { tier: string; protectionHours: number; sellerEvidenceRequired: boolean; returnTrackingRequired: boolean };
  dispute: DisputeSummary | null;
  hasSellerEvidence: boolean;
  paymentStatus: string | null;
  conversationId: string | null;
  myRole: "buyer" | "seller";
  with: { handle: string; displayName: string; avatarUrl: string | null };
  createdAt: string;
}

interface EvidenceEntry {
  by: string;
  at: string;
  note: string;
  photos: string[];
}

function reasonLabel(kind: string, id: string) {
  return (kind === "return" ? RETURN_REASONS : PROBLEM_REASONS).find((r) => r.id === id)?.label ?? id;
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 700 / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function OrdersPage() {
  const { user: me } = useSession();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [tab, setTab] = useState<"buying" | "selling">("buying");
  const [caseFor, setCaseFor] = useState<{ order: Order; kind: "problem" | "return" } | null>(null);
  const [shipFor, setShipFor] = useState<string | null>(null);
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
          <p className="text-sm text-zinc-400">
            Funds held until delivery + protection window. Problems open an evidence-based case — never an automatic verdict.
          </p>
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
          mine.map((o) => <OrderCard key={o.id} o={o} act={act} shipFor={shipFor} setShipFor={setShipFor} openCase={(kind) => setCaseFor({ order: o, kind })} reload={load} />)
        )}
      </div>

      {caseFor && <CaseModal order={caseFor.order} kind={caseFor.kind} onClose={() => setCaseFor(null)} onDone={() => { setCaseFor(null); load(); }} />}
    </div>
  );
}

/* ------------------------------- order card ------------------------------- */

function OrderCard({
  o,
  act,
  shipFor,
  setShipFor,
  openCase,
  reload,
}: {
  o: Order;
  act: (id: string, body: Record<string, unknown>) => void;
  shipFor: string | null;
  setShipFor: (v: string | null) => void;
  openCase: (kind: "problem" | "return") => void;
  reload: () => void;
}) {
  const [carrier, setCarrier] = useState("USPS");
  const [code, setCode] = useState("");
  const [serial, setSerial] = useState("");
  const [weight, setWeight] = useState("");
  const [evPhotos, setEvPhotos] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [detail, setDetail] = useState<{ timeline: { at: string; actor: string; kind: string; note: string }[]; dispute: (DisputeSummary & { evidence: EvidenceEntry[]; returnTracking: string; resolutionNote: string }) | null; sellerEvidence: Record<string, unknown> } | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const cancelled = o.status === "cancelled";
  const flowIdx =
    o.status === "delivered" && o.protectionEndsAt ? FLOW.indexOf("protection") : FLOW.indexOf(o.status as (typeof FLOW)[number]);
  const highValue = o.protection.sellerEvidenceRequired;
  const openDispute = o.dispute && ["open", "under_review", "return_authorized", "return_in_transit"].includes(o.dispute.status);

  const loadDetail = async () => {
    const res = await fetch(`/api/orders/${o.id}/dispute`, { cache: "no-store" });
    if (res.ok) setDetail(await res.json());
    setShowDetail(true);
  };

  const disputeAct = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/orders/${o.id}/dispute`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      reload();
      loadDetail();
    }
  };

  return (
    <article className={`card p-4 ${cancelled ? "opacity-60" : ""} ${openDispute ? "border-amber-400/40" : ""}`}>
      <div className="flex items-start gap-3">
        <Avatar src={o.with.avatarUrl} initials={o.with.displayName.charAt(0)} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-100">
            {o.title}
            <span className="font-mono text-xs font-medium tracking-[0.08em] text-lime-300">${o.price * o.qty}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cancelled ? "border-line text-zinc-500" : o.status === "completed" ? "border-lime-400/40 text-lime-300" : "border-amber-400/40 text-amber-300"}`}>
              {ORDER_STATUS_LABEL[o.status] ?? o.status}
            </span>
            {openDispute && (
              <span className="rounded-full border border-rose-400/40 bg-rose-400/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-300">
                Case open — funds held
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Order #{o.id.slice(0, 8).toUpperCase()} · {o.myRole === "buyer" ? "from" : "for"} {o.with.displayName}
            {o.variant && ` · ${o.variant}`} · {FULFILLMENT_LABEL[o.fulfillment] ?? o.fulfillment}
          </p>
        </div>
      </div>

      {/* ------------------------ the visible timeline ------------------------ */}
      {!cancelled && (
        <ol className="mt-3 space-y-1 border-t border-line-soft pt-3">
          {FLOW.map((step, i) => {
            const done = flowIdx >= i && !(step === "completed" && o.status !== "completed");
            return (
              <li key={step} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${done ? "border-lime-400 bg-lime-400/20" : "border-line"}`}>
                  {done && <Check className="h-2.5 w-2.5 text-lime-300" />}
                </span>
                <span className={done ? "text-zinc-200" : "text-zinc-600"}>
                  {FLOW_LABEL[step]}
                  {step === "shipped" && done && (o.tracking.carrier || o.tracking.code) && (
                    <span className="ml-1.5 font-mono text-[10px] tracking-[0.05em] text-zinc-400">
                      {o.tracking.carrier}{o.tracking.code ? ` · ${o.tracking.code}` : ""}
                      {o.tracking.eta ? ` · est. ${new Date(o.tracking.eta).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                    </span>
                  )}
                  {step === "protection" && o.protectionEndsAt && o.status === "delivered" && (
                    <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] text-amber-300">
                      <Clock className="h-3 w-3" />
                      {new Date(o.protectionEndsAt).getTime() > Date.now()
                        ? `until ${new Date(o.protectionEndsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${new Date(o.protectionEndsAt).toLocaleTimeString("en-US", { hour: "numeric" })} — then auto-completes`
                        : "ending…"}
                    </span>
                  )}
                  {step === "secured" && done && o.paymentStatus && (
                    <span className="ml-1.5 text-[10px] text-zinc-500">
                      (funds {o.paymentStatus === "released" ? "released" : o.paymentStatus === "refunded" ? "refunded" : "held by Mavyn"})
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* --------------------------- dispute panel --------------------------- */}
      {o.dispute && (
        <div className={`mt-3 rounded-xl border px-3.5 py-2.5 ${openDispute ? "border-amber-400/30 bg-amber-400/5" : "border-line bg-card-raised/50"}`}>
          <p className="text-xs font-semibold text-zinc-200">
            {o.dispute.kind === "return" ? "Return" : "Problem"} · {reasonLabel(o.dispute.kind, o.dispute.reason)}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">{DISPUTE_STATUS_LABEL[o.dispute.status] ?? o.dispute.status}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {/* seller responses */}
            {o.myRole === "seller" && o.dispute.status === "open" && (
              <>
                <button onClick={() => disputeAct({ action: "approve_return" })} className="btn-lime px-3 py-1.5 text-[11px]">Approve return</button>
                <button
                  onClick={() => {
                    const note = window.prompt("Your side of it — what does your evidence show?");
                    if (note != null) disputeAct({ action: "refute", note });
                  }}
                  className="btn-ghost px-3 py-1.5 text-[11px]"
                >
                  Contest with evidence
                </button>
              </>
            )}
            {o.myRole === "buyer" && o.dispute.status === "return_authorized" && (
              <button
                onClick={() => {
                  const code = window.prompt(`Return tracking number${o.protection.returnTrackingRequired ? " (required for this order value)" : " (optional)"}:`);
                  if (code != null) disputeAct({ action: "mark_returned", carrier: "USPS", code });
                }}
                className="btn-lime px-3 py-1.5 text-[11px]"
              >
                <RotateCcw className="h-3 w-3" /> Mark return shipped
              </button>
            )}
            {o.myRole === "seller" && o.dispute.status === "return_in_transit" && (
              <button onClick={() => disputeAct({ action: "confirm_return_received" })} className="btn-lime px-3 py-1.5 text-[11px]">
                Return arrived — refund
              </button>
            )}
            {openDispute && (
              <button
                onClick={() => {
                  const note = window.prompt("Add evidence — describe it (photos can be attached from the case view):");
                  if (note) disputeAct({ action: "add_evidence", note });
                }}
                className="btn-ghost px-3 py-1.5 text-[11px]"
              >
                Add evidence
              </button>
            )}
            {o.myRole === "buyer" && openDispute && o.dispute.status === "open" && (
              <button onClick={() => disputeAct({ action: "escalate" })} className="btn-ghost px-3 py-1.5 text-[11px]">Send to Mavyn review</button>
            )}
            {openDispute && o.dispute.openedByMe && (
              <button onClick={() => disputeAct({ action: "withdraw" })} className="rounded-full px-3 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-300">Withdraw</button>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------ actions ------------------------------ */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
        {o.myRole === "buyer" && o.status === "placed" && (
          <span className="flex w-full flex-col gap-2">
            <PaymentDirection side="paying" name={o.with.displayName} context={o.title} amount={`$${(o.price * o.qty * 1.05).toFixed(2)}`} />
            <button onClick={() => act(o.id, { action: "pay", expectedTotal: +(o.price * o.qty * 1.05).toFixed(2) })} className="btn-pay w-full justify-center px-3.5 py-1.5 text-xs sm:w-auto sm:self-start">
              Pay ${(o.price * o.qty * 1.05).toFixed(2)} — demo payment
            </button>
          </span>
        )}
        {o.myRole === "seller" && ["secured", "preparing", "shipped", "delivered"].includes(o.status) && (
          <PaymentDirection
            side="receiving"
            name={o.with.displayName}
            context={o.title}
            status="secured — releases when the buyer confirms"
            amount={`$${o.price * o.qty}`}
            className="w-full"
          />
        )}
        {o.myRole === "buyer" && ["shipped", "delivered"].includes(o.status) && !openDispute && (
          <button onClick={() => act(o.id, { action: "confirm_received" })} className="btn-lime px-3.5 py-1.5 text-xs">
            <Check className="h-3.5 w-3.5" /> All good — release ${o.price * o.qty}
          </button>
        )}
        {o.myRole === "seller" && o.status === "secured" && (
          o.fulfillment === "shipping" ? (
            shipFor === o.id ? (
              <span className="flex w-full flex-col gap-2">
                <span className="flex flex-wrap items-center gap-2">
                  <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier" className="w-24 rounded-lg border border-line bg-card-raised px-2.5 py-1.5 text-xs text-zinc-100 outline-none" />
                  <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Tracking number" className="w-44 rounded-lg border border-line bg-card-raised px-2.5 py-1.5 text-xs text-zinc-100 outline-none" />
                  <input value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Weight lb" className="w-20 rounded-lg border border-line bg-card-raised px-2.5 py-1.5 text-xs text-zinc-100 outline-none" />
                </span>
                {highValue && (
                  <span className="flex flex-wrap items-center gap-2">
                    <input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Serial number (private — protects you)" className="w-64 rounded-lg border border-amber-400/40 bg-card-raised px-2.5 py-1.5 text-xs text-zinc-100 outline-none" />
                    <button onClick={() => fileInput.current?.click()} className="btn-ghost px-2.5 py-1.5 text-[11px]">
                      <ImagePlus className="h-3.5 w-3.5" /> Item photo ({evPhotos.length})
                    </button>
                    <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const img = await readImage(f); setEvPhotos((p) => [...p, img].slice(0, 3)); } e.target.value = ""; }} />
                    <span className="text-[10px] text-amber-300/80">High-value order — record the item before shipping. Weight alone never proves contents.</span>
                  </span>
                )}
                <span className="flex gap-2">
                  <button onClick={() => act(o.id, { action: "ship", carrier, code, eta: new Date(Date.now() + 5 * 86400_000).toISOString(), serial, weightLb: weight, evidencePhotos: evPhotos })} className="btn-lime px-3 py-1.5 text-xs">
                    <Truck className="h-3.5 w-3.5" /> Mark shipped
                  </button>
                  <button onClick={() => setShipFor(null)} className="btn-ghost px-2.5 py-1.5 text-xs">Cancel</button>
                </span>
              </span>
            ) : (
              <button onClick={() => setShipFor(o.id)} className="btn-lime px-3.5 py-1.5 text-xs">
                <Truck className="h-3.5 w-3.5" /> Ship it{highValue ? " (evidence required)" : ""}
              </button>
            )
          ) : (
            <button onClick={() => act(o.id, { action: "handoff" })} className="btn-lime px-3.5 py-1.5 text-xs">Mark handed off</button>
          )
        )}
        {o.conversationId && (
          <Link href={`/messages?c=${o.conversationId}`} className="btn-ghost px-3 py-1.5 text-xs">
            <MessageSquare className="h-3.5 w-3.5" /> Message
          </Link>
        )}
        <button onClick={() => (showDetail ? setShowDetail(false) : loadDetail())} className="btn-ghost px-3 py-1.5 text-xs">
          <FileText className="h-3.5 w-3.5" /> {showDetail ? "Hide timeline" : "Timeline"}
        </button>
        {["placed", "secured", "preparing"].includes(o.status) && !openDispute && (
          <button onClick={() => act(o.id, { action: "cancel" })} className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:text-rose-300">
            Cancel{o.status !== "placed" ? " — full refund" : ""}
          </button>
        )}
        {o.myRole === "buyer" && ["shipped", "delivered", "completed"].includes(o.status) && !openDispute && (
          <span className="ml-auto flex gap-1.5">
            {["delivered", "completed"].includes(o.status) && (
              <button onClick={() => openCase("return")} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-300">
                <RotateCcw className="h-3.5 w-3.5" /> Request return
              </button>
            )}
            <button onClick={() => openCase("problem")} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:text-rose-300">
              <Flag className="h-3.5 w-3.5" /> Report a problem
            </button>
          </span>
        )}
      </div>

      {/* ---------------------- private evidence timeline ---------------------- */}
      {showDetail && detail && (
        <div className="mt-3 rounded-xl border border-line bg-card-raised/50 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            Evidence timeline — private to you, {o.with.displayName.split(" ")[0]}, and Mavyn review
          </p>
          <ol className="mt-2 space-y-1">
            {detail.timeline.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px]">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                <span className="text-zinc-400">
                  <span className="font-mono tracking-[0.05em] text-zinc-500">{new Date(e.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>{" "}
                  <span className="text-zinc-300">{e.actor}</span> · {e.kind.replace(/_/g, " ")}
                  {e.note ? ` — ${e.note}` : ""}
                </span>
              </li>
            ))}
          </ol>
          {detail.sellerEvidence && Object.keys(detail.sellerEvidence).some((k) => detail.sellerEvidence[k]) && (
            <p className="mt-2 border-t border-line-soft pt-2 text-[11px] text-zinc-400">
              Shipment evidence on file:
              {detail.sellerEvidence.serial ? ` serial ${o.myRole === "seller" ? detail.sellerEvidence.serial : "(recorded — visible to platform review)"}` : ""}
              {detail.sellerEvidence.weightLb ? ` · ${detail.sellerEvidence.weightLb} lb` : ""}
              {Array.isArray(detail.sellerEvidence.photos) && (detail.sellerEvidence.photos as string[]).length ? ` · ${(detail.sellerEvidence.photos as string[]).length} photo(s)` : ""}
            </p>
          )}
          {detail.dispute && detail.dispute.evidence.length > 0 && (
            <div className="mt-2 border-t border-line-soft pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Case evidence</p>
              {detail.dispute.evidence.map((e, i) => (
                <div key={i} className="mt-1.5 text-[11px] text-zinc-400">
                  <span className="text-zinc-300">{e.by === o.with.handle ? o.with.displayName : e.by}</span> — {e.note}
                  {e.photos.length > 0 && (
                    <span className="mt-1 flex gap-1.5">
                      {e.photos.map((p, j) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={j} src={p} alt="Evidence" className="h-14 w-14 rounded-lg border border-line object-cover" />
                      ))}
                    </span>
                  )}
                </div>
              ))}
              {detail.dispute.resolutionNote && (
                <p className="mt-1.5 text-[11px] text-zinc-300">Resolution: {detail.dispute.resolutionNote}</p>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/* --------------------------- open-a-case modal --------------------------- */

function CaseModal({ order, kind, onClose, onDone }: { order: Order; kind: "problem" | "return"; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const reasons = kind === "return" ? RETURN_REASONS : PROBLEM_REASONS;

  const submit = async () => {
    if (!reason) return setError("Pick what happened");
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orders/${order.id}/dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, reason, note, photos }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error || "Could not open the case");
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {kind === "return" ? "Request return/refund" : "Report a problem"}
            </p>
            <h3 className="mt-1 text-sm font-bold text-zinc-100">{order.title}</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-3 space-y-1.5">
          {reasons.map((r) => (
            <button key={r.id} onClick={() => setReason(r.id)} className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left text-xs font-medium transition ${reason === r.id ? "border-amber-400/50 bg-amber-400/5 text-amber-200" : "border-line text-zinc-300 hover:border-zinc-600"}`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${reason === r.id ? "bg-amber-400" : "bg-zinc-700"}`} />
              {r.label}
            </button>
          ))}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What happened? Dates, details, anything that helps review." className="mt-3 w-full resize-none rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-400/40" />
        <div className="mt-2 flex items-center gap-2">
          <button onClick={() => fileInput.current?.click()} className="btn-ghost px-3 py-1.5 text-xs">
            <ImagePlus className="h-3.5 w-3.5" /> Add photos ({photos.length}/3)
          </button>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const img = await readImage(f); setPhotos((p) => [...p, img].slice(0, 3)); } e.target.value = ""; }} />
          {photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p} alt="" className="h-10 w-10 rounded-lg border border-line object-cover" />
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
          Opening a case holds the funds and asks the {kind === "return" ? "seller" : "seller for their side"} —
          nothing refunds or releases automatically. Contested cases go to Mavyn review with both parties&apos; evidence.
        </p>
        {error && <p className="mt-2 text-xs font-medium text-rose-300">{error}</p>}
        <button onClick={submit} disabled={busy} className="btn-lime mt-3 w-full justify-center py-2.5 text-sm disabled:opacity-40">
          {busy ? "Opening…" : kind === "return" ? "Request return" : "Submit report"}
        </button>
      </div>
    </div>
  );
}
