"use client";

/* List something on the Campus Marketplace — the type drives the form.
   FREE = they keep it. BORROW = it comes back. Never blurred. */

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, GraduationCap, ImagePlus, X } from "lucide-react";
import { useSession } from "@/lib/session";
import { LISTING_TYPES, CAMPUS_CATEGORIES, CAMPUS_FULFILLMENT, CONDITIONS, type ListingType } from "@/lib/campusMarket";

const inputCls =
  "w-full rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-400/50";

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 800 / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function NewCampusListingPage() {
  const router = useRouter();
  const { user } = useSession();
  const [type, setType] = useState<ListingType>("fixed");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [media, setMedia] = useState<string[]>([]);
  const [fulfillment, setFulfillment] = useState<string[]>(["pickup"]);
  const [meetSpot, setMeetSpot] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  // auction
  const [auctionEndsAt, setAuctionEndsAt] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [bidIncrement, setBidIncrement] = useState("1");
  // borrow
  const [maxBorrowDays, setMaxBorrowDays] = useState("7");
  const [allowExtensions, setAllowExtensions] = useState(true);
  const [deposit, setDeposit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const needsPrice = ["fixed", "negotiable", "auction"].includes(type);

  const submit = async () => {
    setError(null);
    if (!title.trim()) return setError(type === "need_borrow" ? "What do you need to borrow?" : "What are you listing?");
    if (needsPrice && (!price || Number(price) < 1)) return setError(type === "auction" ? "Set the starting price" : "Set the price");
    setBusy(true);
    const res = await fetch("/api/campus/market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type, title, description, category,
        price: needsPrice ? Number(price) : undefined,
        condition, quantity: Number(quantity) || 1, media, fulfillment, meetSpot,
        expiresAt: expiresAt || undefined,
        auctionEndsAt: auctionEndsAt || undefined,
        reservePrice: reservePrice || undefined,
        bidIncrement: Number(bidIncrement) || 1,
        maxBorrowDays: Number(maxBorrowDays) || 7,
        allowExtensions,
        deposit: deposit || undefined,
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not publish");
      if (res.status === 401) router.push("/login?next=%2Fcampus%2Fmarket%2Fnew");
      return;
    }
    router.push(`/campus/market/${d.id}?published=1`);
  };

  if (!user)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold text-zinc-200">Join UpNova and verify your campus to list</p>
        <Link href="/signup?next=%2Fcampus%2Fmarket%2Fnew" className="btn-lime mt-4 inline-flex px-5 py-2 text-sm">Create free account</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-10">
      <div>
        <Link href="/campus/market" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Campus Marketplace
        </Link>
        <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10">
            <GraduationCap className="h-5 w-5 text-violet-400" />
          </span>
          List on your campus
        </h1>
      </div>

      {/* transaction type — drives everything below */}
      <section className="card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">What kind of listing?</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {LISTING_TYPES.map((t) => (
            <button key={t.id} onClick={() => setType(t.id)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${type === t.id ? "border-violet-400/50 bg-violet-400/10 text-violet-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
          {type === "free" && "Free means they KEEP it. If it should come back, list it as Borrow."}
          {type === "borrow" && "Borrow means it stays yours and comes back — free by default; this is sharing, not renting."}
          {type === "need_borrow" && "You're asking to borrow something. Owners nearby can offer theirs."}
          {type === "auction" && "Optional — most campus listings do fine as fixed price or OBO."}
          {type === "trade" && "Offers happen in Messages — describe what you'd trade for."}
          {["fixed", "negotiable"].includes(type) && "Paid campus sales run through UpNova's protected orders — funds held until handoff."}
        </p>
      </section>

      <section className="card space-y-3 p-5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === "need_borrow" ? "What do you need? — e.g. Graphing calculator" : "Title — e.g. TI-84 Plus CE"} className={inputCls} maxLength={80} autoFocus />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={type === "need_borrow" ? "When you need it, for how long, why (optional)…" : "Describe it honestly — condition details sell."} className={`${inputCls} resize-none`} />
        <div className="flex flex-wrap gap-1.5">
          {CAMPUS_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition ${category === c ? "border-violet-400/50 bg-violet-400/10 text-violet-300" : "border-line text-zinc-500 hover:border-zinc-600"}`}>
              {c}
            </button>
          ))}
        </div>
        {category === "food" && (
          <p className="text-[11px] text-amber-300">Food listings must follow campus food-safety rules — sealed/packaged items only.</p>
        )}
        {/* photos */}
        {type !== "need_borrow" && (
          <div className="flex flex-wrap gap-2">
            {media.map((m, i) => (
              <span key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m} alt="" className="h-20 w-20 rounded-xl border border-line object-cover" />
                <button onClick={() => setMedia(media.filter((_, x) => x !== i))} className="absolute -right-1.5 -top-1.5 rounded-full border border-line bg-ink p-0.5 text-zinc-400"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {media.length < 4 && (
              <button onClick={() => fileInput.current?.click()} className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-zinc-500 hover:border-zinc-600 hover:text-zinc-300">
                <ImagePlus className="h-5 w-5" /><span className="text-[9px] font-semibold">Photo</span>
              </button>
            )}
            <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const img = await readImage(f); setMedia((m) => [...m, img].slice(0, 4)); } e.target.value = ""; }} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {needsPrice && (
            <div className="relative w-28">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder={type === "auction" ? "Start" : "Price"} className={`${inputCls} pl-7`} />
            </div>
          )}
          {type !== "need_borrow" && (
            <>
              <div className="flex gap-1.5">
                {CONDITIONS.map((c) => (
                  <button key={c.id} onClick={() => setCondition(condition === c.id ? "" : c.id)} className={`rounded-full border px-2.5 py-1 text-[11px] transition ${condition === c.id ? "border-violet-400/50 bg-violet-400/10 text-violet-300" : "border-line text-zinc-500"}`}>
                    {c.label}
                  </button>
                ))}
              </div>
              {["fixed", "free"].includes(type) && (
                <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                  Qty <input value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ""))} className={`${inputCls} w-16 py-1.5 text-center`} />
                </label>
              )}
            </>
          )}
        </div>

        {/* fulfillment + meet spot (general area only) */}
        {type !== "need_borrow" && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">How does it change hands?</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CAMPUS_FULFILLMENT.map((f) => (
                <button key={f.id} onClick={() => setFulfillment((cur) => (cur.includes(f.id) ? cur.filter((x) => x !== f.id) : [...cur, f.id]))} className={`rounded-full border px-2.5 py-1 text-[11px] transition ${fulfillment.includes(f.id) ? "border-violet-400/50 bg-violet-400/10 text-violet-300" : "border-line text-zinc-500"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <input value={meetSpot} onChange={(e) => setMeetSpot(e.target.value)} placeholder="General meeting area — e.g. Student Center lobby (never your address)" maxLength={80} className={`${inputCls} mt-2 py-2 text-xs`} />
          </div>
        )}

        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Listing expires (optional)</p>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={`${inputCls} w-44`} />
        </div>
      </section>

      {/* auction config */}
      {type === "auction" && (
        <section className="card space-y-3 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Auction settings</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            <label className="flex items-center gap-1.5">
              Ends
              <input type="datetime-local" value={auctionEndsAt} onChange={(e) => setAuctionEndsAt(e.target.value)} className={`${inputCls} w-auto py-1.5`} />
            </label>
            <label className="flex items-center gap-1.5">
              Bid increment $<input value={bidIncrement} onChange={(e) => setBidIncrement(e.target.value.replace(/[^0-9]/g, ""))} className={`${inputCls} w-16 py-1.5`} />
            </label>
            <label className="flex items-center gap-1.5">
              Reserve (optional) $<input value={reservePrice} onChange={(e) => setReservePrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="hidden" className={`${inputCls} w-20 py-1.5`} />
            </label>
          </div>
          <p className="text-[11px] text-zinc-600">Winner gets 48h to pay through protected orders. No qualifying bid → the auction simply expires.</p>
        </section>
      )}

      {/* borrow config */}
      {type === "borrow" && (
        <section className="card space-y-3 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Borrowing settings — free by default</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            <label className="flex items-center gap-1.5">
              Max period
              <select value={maxBorrowDays} onChange={(e) => setMaxBorrowDays(e.target.value)} className={`${inputCls} w-auto py-1.5`}>
                {[1, 2, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={allowExtensions} onChange={(e) => setAllowExtensions(e.target.checked)} className="accent-sky-400" />
              Allow extension requests
            </label>
            <label className="flex items-center gap-1.5">
              Refundable deposit (optional) $<input value={deposit} onChange={(e) => setDeposit(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" className={`${inputCls} w-20 py-1.5`} />
            </label>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-600">
            Borrowing stays $0 — the deposit is protection for higher-value items and goes back when the item
            returns properly. Condition is documented at handoff and at return.
          </p>
        </section>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Link href="/campus/market" className="btn-ghost px-4 py-2 text-sm">Cancel</Link>
        <button onClick={submit} disabled={busy} className="btn-lime px-5 py-2 text-sm disabled:opacity-50">
          {busy ? "Publishing…" : type === "need_borrow" ? "Post request" : "Publish listing"}
        </button>
      </div>
    </div>
  );
}
