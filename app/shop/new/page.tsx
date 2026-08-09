"use client";

/* ------------------------------------------------------------------ */
/*  List a product — the same configurable-listing philosophy as       */
/*  services: category = defaults + custom, variants and fulfillment   */
/*  are the seller's configuration, and checkout is an HONEST choice:  */
/*  UpNova checkout (funds held until delivery) or the seller's own    */
/*  website (disclosed as external). One-time sales welcome: qty 1,    */
/*  sold once, kept in history.                                        */
/* ------------------------------------------------------------------ */

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Tag, ImagePlus, X } from "lucide-react";
import { useSession } from "@/lib/session";
import { PRODUCT_CATEGORIES, FULFILLMENT_LABEL, type ProductFulfillment } from "@/lib/products";
import { DEFAULT_RETURN_POLICY, type ReturnPolicy } from "@/lib/protection";
import { normalizeCategory } from "@/lib/servicePolicies";

const inputCls =
  "w-full rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-lime-400/50";

function readImage(file: File, maxW: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function NewProductPage() {
  const router = useRouter();
  const { user } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState("clothing");
  const [customMode, setCustomMode] = useState(false);
  const [customCat, setCustomCat] = useState("");
  const [condition, setCondition] = useState("");
  const [media, setMedia] = useState<string[]>([]);
  const [variants, setVariants] = useState<{ name: string; options: string }[]>([]);
  const [fulfillment, setFulfillment] = useState<ProductFulfillment[]>(["shipping"]);
  const [external, setExternal] = useState(false);
  const [policy, setPolicy] = useState<ReturnPolicy>({ ...DEFAULT_RETURN_POLICY });
  const [externalUrl, setExternalUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const toggleF = (f: ProductFulfillment) =>
    setFulfillment((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  const submit = async () => {
    setError(null);
    if (!title.trim()) return setError("What are you selling?");
    if (!price || Number(price) < 1) return setError("Set the price");
    if (external && !externalUrl.trim()) return setError("Add your store link — or switch to UpNova checkout");
    if (!external && fulfillment.length === 0) return setError("Pick at least one way buyers receive it");
    setBusy(true);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        price: Number(price),
        quantity: Number(quantity) || 1,
        category: customMode ? normalizeCategory(customCat) || "other" : category,
        condition,
        media,
        variants: variants
          .filter((v) => v.name.trim() && v.options.trim())
          .map((v) => ({ name: v.name.trim(), options: v.options.split(",").map((o) => o.trim()).filter(Boolean) })),
        fulfillment,
        externalUrl: external ? externalUrl.trim() : undefined,
        returnPolicy: policy,
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not publish");
      if (res.status === 401) router.push("/login");
      return;
    }
    router.push(`/shop/${d.id}?published=1`);
  };

  if (!user)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold text-zinc-200">Join UpNova to sell</p>
        <Link href="/signup?next=%2Fshop%2Fnew" className="btn-lime mt-4 inline-flex px-5 py-2 text-sm">Create free account</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-10">
      <div>
        <Link href="/shop" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Shop
        </Link>
        <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
            <Tag className="h-5 w-5 text-lime-400" />
          </span>
          Sell something
        </h1>
      </div>

      <section className="card space-y-3 p-5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are you selling? — e.g. Black UpNova Hoodie" className={inputCls} maxLength={80} autoFocus />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe it — material, sizing, story. Honest listings sell." className={`${inputCls} resize-none`} />

        {/* photos */}
        <div className="flex flex-wrap gap-2">
          {media.map((m, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-xl border border-line object-cover" />
              <button onClick={() => setMedia(media.filter((_, x) => x !== i))} className="absolute -right-1.5 -top-1.5 rounded-full border border-line bg-ink p-1 text-zinc-400 hover:text-rose-300">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {media.length < 4 && (
            <button onClick={() => fileInput.current?.click()} className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300">
              <ImagePlus className="h-5 w-5" />
              <span className="text-[9px] font-semibold">Photo</span>
            </button>
          )}
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const img = await readImage(f, 900); setMedia((m) => (m.length < 4 ? [...m, img] : m)); } e.target.value = ""; }} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-28">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Price" className={`${inputCls} pl-7`} />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-zinc-400">
            Quantity
            <input value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ""))} className={`${inputCls} w-20 py-2 text-center`} />
          </label>
          <div className="flex gap-1.5">
            {([["", "—"], ["new", "New"], ["like_new", "Like new"], ["used", "Used"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setCondition(v)} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${condition === v ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-500 hover:border-zinc-600"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-zinc-600">Quantity 1 = a one-time sale. Once it sells it shows SOLD and stays in your history.</p>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Category</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PRODUCT_CATEGORIES.map((c) => (
              <button key={c} onClick={() => { setCustomMode(false); setCategory(c); }} className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${!customMode && category === c ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
                {c}
              </button>
            ))}
            <button onClick={() => setCustomMode(true)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${customMode ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
              + Add category
            </button>
          </div>
          {customMode && (
            <input value={customCat} onChange={(e) => setCustomCat(e.target.value)} placeholder="Your category — e.g. Vinyl, Plants, Sneakers" maxLength={24} className={`${inputCls} mt-2`} autoFocus />
          )}
        </div>
      </section>

      {/* variants */}
      <section className="card space-y-2 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Variants (optional)</p>
        <p className="text-[11px] text-zinc-600">Up to two groups — buyers pick one option from each. e.g. Size: S, M, L, XL.</p>
        {variants.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={v.name} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Size" maxLength={20} className={`${inputCls} w-28 py-2 text-xs`} />
            <input value={v.options} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))} placeholder="S, M, L, XL" className={`${inputCls} flex-1 py-2 text-xs`} />
            <button onClick={() => setVariants(variants.filter((_, j) => j !== i))} className="rounded-md p-1 text-zinc-500 hover:text-rose-300"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {variants.length < 2 && (
          <button onClick={() => setVariants([...variants, { name: "", options: "" }])} className="btn-ghost w-full justify-center py-2 text-xs">
            + Add a variant group
          </button>
        )}
      </section>

      {/* fulfillment + checkout mode */}
      <section className="card space-y-3 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">How will buyers receive it?</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(Object.keys(FULFILLMENT_LABEL) as ProductFulfillment[]).map((f) => (
              <button key={f} onClick={() => toggleF(f)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${fulfillment.includes(f) ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
                {FULFILLMENT_LABEL[f]}
              </button>
            ))}
          </div>
          {fulfillment.includes("pickup") && (
            <p className="mt-1.5 text-[11px] text-zinc-600">
              Pickup never shows anyone&apos;s address — the exact spot is arranged in Messages after the order confirms.
            </p>
          )}
        </div>

        <div className="border-t border-line-soft pt-3">
          <label className="flex items-start gap-2 text-sm text-zinc-200">
            <input type="checkbox" checked={external} onChange={(e) => setExternal(e.target.checked)} className="mt-0.5 accent-sky-400" />
            <span>
              Sell on my own website instead
              <span className="block text-xs leading-relaxed text-zinc-500">
                UpNova becomes the discovery layer. Buyers see &quot;External checkout — you&apos;ll complete your
                purchase on the seller&apos;s website&quot;. UpNova checkout (with funds held until delivery) doesn&apos;t apply.
              </span>
            </span>
          </label>
          {external && (
            <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://your-store.com/product" className={`${inputCls} mt-2`} />
          )}
        </div>
      </section>

      {/* return policy — disclosed to buyers BEFORE checkout */}
      {!external && (
        <section className="card space-y-3 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Returns</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600">
              Your terms, shown to buyers before they pay. Platform protection (non-delivery, wrong/damaged/
              counterfeit/misrepresented items) applies no matter what you pick here.
            </p>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
            <span className="text-sm text-zinc-200">Accept ordinary returns <span className="block text-xs text-zinc-500">Changed mind, wrong size, etc.</span></span>
            <input type="checkbox" checked={policy.accepts} onChange={(e) => setPolicy({ ...policy, accepts: e.target.checked })} className="accent-lime-400" />
          </label>
          {policy.accepts && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
              <label className="flex items-center gap-1.5">
                Window
                <select value={policy.windowDays} onChange={(e) => setPolicy({ ...policy, windowDays: Number(e.target.value) })} className={`${inputCls} w-auto py-1.5`}>
                  {[7, 14, 30].map((d) => <option key={d} value={d}>{d} days</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1.5">
                Return shipping
                <select value={policy.whoPaysShipping} onChange={(e) => setPolicy({ ...policy, whoPaysShipping: e.target.value as "buyer" | "seller" })} className={`${inputCls} w-auto py-1.5`}>
                  <option value="buyer">Buyer pays</option>
                  <option value="seller">I pay</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5">
                Restocking fee
                <select value={policy.restockingPct} onChange={(e) => setPolicy({ ...policy, restockingPct: Number(e.target.value) })} className={`${inputCls} w-auto py-1.5`}>
                  {[0, 5, 10, 15, 20].map((p2) => <option key={p2} value={p2}>{p2}%</option>)}
                </select>
              </label>
              <input value={policy.conditions} onChange={(e) => setPolicy({ ...policy, conditions: e.target.value })} placeholder="Condition requirements — e.g. unworn, tags attached" maxLength={160} className={`${inputCls} py-1.5 text-xs`} />
            </div>
          )}
        </section>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Link href="/shop" className="btn-ghost px-4 py-2 text-sm">Cancel</Link>
        <button onClick={submit} disabled={busy} className="btn-lime px-5 py-2 text-sm disabled:opacity-50">
          {busy ? "Publishing…" : "List it"}
        </button>
      </div>
    </div>
  );
}
