"use client";

/* ------------------------------------------------------------------ */
/*  Shop — Products alongside Posts, Services, and Opportunities.      */
/*  PRODUCT = "buy this". Two honest modes per listing:                */
/*   · Mavyn checkout — funds held until delivery (orders timeline)   */
/*   · External checkout — clearly disclosed: "you'll complete your    */
/*     purchase on the seller's website". Never disguised.             */
/*  Guests browse everything; buying asks for an account.              */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { CategoryChip } from "@/lib/categories";
import Link from "next/link";
import { Search, Tag, Plus, ExternalLink, Package } from "lucide-react";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useSession } from "@/lib/session";
import { FULFILLMENT_LABEL, type ProductFulfillment } from "@/lib/products";

interface ProductItem {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  soldOut: boolean;
  external: boolean;
  fulfillment: ProductFulfillment[];
  media: string[];
  seller: { handle: string; displayName: string; avatarUrl: string | null; verified: boolean; locationLabel?: string | null };
  isMine: boolean;
}

const CONDITION_LABEL: Record<string, string> = { new: "New", like_new: "Like new", used: "Used" };

export default function ShopPage() {
  const { user: me } = useSession();
  const [items, setItems] = useState<ProductItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("category");
    if (c) setCategory(c);
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setItems(d.products ?? []));
  }, []);

  const categories = ["All", ...Array.from(new Set((items ?? []).map((p) => p.category)))];
  const filtered = (items ?? []).filter((p) => {
    const q = query.trim().toLowerCase();
    return (
      (category === "All" || p.category === category) &&
      (!q || p.title.toLowerCase().includes(q) || p.seller.displayName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
          <Tag className="h-5 w-5 text-lime-400" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Shop</h1>
          <p className="text-sm text-zinc-400">
            Real things from real people. Mavyn checkout holds funds until delivery; external listings say so.
          </p>
        </div>
        {me && (
          <span className="flex shrink-0 gap-2">
            <Link href="/orders" className="btn-ghost px-3.5 py-1.5 text-xs sm:text-sm">
              <Package className="h-4 w-4" /> Orders
            </Link>
            <Link href="/shop/new" className="btn-lime px-4 py-1.5 text-xs sm:text-sm">
              <Plus className="h-4 w-4" /> Sell something
            </Link>
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products or sellers…"
            className="w-full rounded-full border border-line bg-card py-2 pl-10 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-lime-400/40"
          />
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
                category === c ? "border-lime-400/50 bg-lime-400/10 font-semibold text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items === null ? (
          [0, 1, 2, 3].map((i) => <div key={i} className="card-shop h-52 animate-pulse" aria-hidden />)
        ) : (
          filtered.map((p) => (
            <article key={p.id} className={`card-shop flex min-w-0 flex-col break-words p-4 ${p.soldOut ? "opacity-60" : ""}`}>
              {p.media[0] && (
                <Link href={`/shop/${p.id}`} className="relative mb-3 block aspect-[4/3] overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.media[0]} alt={p.title} className="absolute inset-0 h-full w-full object-cover" />
                </Link>
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-zinc-100">
                    <Link href={`/shop/${p.id}`} className="transition hover:text-lime-300">{p.title}</Link>
                  </h3>
                  <p className="font-mono text-sm font-medium tracking-[0.08em] text-lime-300">${p.price}</p>
                </div>
                <span className="flex shrink-0 flex-col items-end gap-1">
                <CategoryChip category="shop" />
                {p.soldOut ? (
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-500">Sold</span>
                ) : p.external ? (
                  <span className="shrink-0 rounded-full border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-sky-300" title="You'll complete your purchase on the seller's website">
                    External
                  </span>
                ) : null}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-zinc-400">{p.description}</p>
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                {p.condition && <span className="rounded-full border border-line px-2 py-0.5">{CONDITION_LABEL[p.condition]}</span>}
                <span className="rounded-full border border-line px-2 py-0.5 capitalize">{p.category}</span>
                {p.fulfillment.map((f) => (
                  <span key={f} className="rounded-full border border-line px-2 py-0.5">{FULFILLMENT_LABEL[f]}</span>
                ))}
              </p>
              <div className="mt-3 flex items-center gap-2 border-t border-dashed border-line pt-3">
                <Link href={`/creator/${p.seller.handle}`} className="flex min-w-0 flex-1 items-center gap-2">
                  <Avatar src={p.seller.avatarUrl} initials={p.seller.displayName.charAt(0)} size="xs" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 truncate text-xs font-semibold text-zinc-200">
                      {p.seller.displayName}
                      {p.seller.verified && <VerifiedBadge className="h-3 w-3" />}
                    </span>
                    {p.seller.locationLabel && <span className="block truncate text-[10px] text-zinc-500">{p.seller.locationLabel}</span>}
                  </span>
                </Link>
                <Link href={`/shop/${p.id}`} className="btn-lime shrink-0 px-3.5 py-1.5 text-xs">
                  {p.external ? <ExternalLink className="h-3.5 w-3.5" /> : <Tag className="h-3.5 w-3.5" />}
                  {p.isMine ? "Manage" : p.soldOut ? "View" : p.external ? "View" : "Buy"}
                </Link>
              </div>
            </article>
          ))
        )}
        {items !== null && filtered.length === 0 && (
          <p className="col-span-full py-10 text-center text-sm text-zinc-500">Nothing here yet.</p>
        )}
      </div>
    </div>
  );
}
