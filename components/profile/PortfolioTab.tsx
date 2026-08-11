"use client";

/* ------------------------------------------------------------------ */
/*  Profile → Portfolio: real portfolio_items records. Entries added   */
/*  from completed Mavyn projects carry the Verified badge; uploads   */
/*  and links render with typed placeholder tiles — never a broken     */
/*  image.                                                             */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, EyeOff, FileImage, FileVideo, Music, Link2, Briefcase, Trash2, Plus } from "lucide-react";
import { useProfile } from "@/lib/profile";

interface Item {
  id: string;
  title: string;
  kind: string;
  mediaUrl: string | null;
  client: string;
  projectId: string | null;
  aiInvolvement: string;
  visible: boolean;
}

const KIND_ICON: Record<string, typeof FileImage> = {
  image: FileImage,
  video: FileVideo,
  audio: Music,
  link: Link2,
  project: Briefcase,
  mavyn_project: BadgeCheck,
};

const KIND_TONE: Record<string, string> = {
  image: "from-violet-500/30 to-violet-900/40 text-violet-300",
  video: "from-amber-500/30 to-amber-900/40 text-amber-300",
  audio: "from-lime-500/25 to-emerald-900/40 text-lime-300",
  link: "from-zinc-600/40 to-zinc-900/40 text-zinc-300",
  project: "from-lime-500/25 to-emerald-900/40 text-lime-300",
  mavyn_project: "from-lime-500/25 to-emerald-900/40 text-lime-300",
};

export default function PortfolioTab({ isOwner }: { isOwner: boolean }) {
  const profile = useProfile();
  const [items, setItems] = useState<Item[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/me/portfolio", { cache: "no-store" });
    if (!res.ok) {
      setItems([]);
      return;
    }
    setItems((await res.json()).items ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    await fetch(`/api/me/portfolio?id=${id}`, { method: "DELETE" });
    load();
  };

  // privacy: owner can hide the portfolio from visitors in Edit Profile
  if (!isOwner && !profile.showPortfolio) {
    return (
      <div className="rounded-xl border border-line bg-card-raised p-8 text-center">
        <EyeOff className="mx-auto h-5 w-5 text-zinc-500" />
        <p className="mt-2 text-sm font-semibold text-zinc-300">Portfolio is private</p>
        <p className="mt-1 text-xs text-zinc-500">The owner has chosen not to show their portfolio publicly.</p>
      </div>
    );
  }

  const shown = (items ?? []).filter((i) => isOwner || i.visible);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          <span className="font-semibold text-zinc-200">Show me what you can do.</span> Completed
          work, client projects, and published pieces.
        </p>
      </div>

      {items === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card aspect-[4/3] animate-pulse" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center">
          <p className="text-sm font-semibold text-zinc-300">Nothing here yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-zinc-500">
            Complete a project and add it from the Opportunities tab, or add entries in{" "}
            <Link href="/profile/edit" className="text-violet-300 hover:underline">
              Edit Profile → Portfolio
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((item) => {
            const Icon = KIND_ICON[item.kind] ?? Link2;
            return (
              <article key={item.id} className="card group overflow-hidden transition hover:border-zinc-600">
                <div className="relative aspect-[4/3] overflow-hidden">
                  {item.mediaUrl ? (
                    <Image
                      src={item.mediaUrl}
                      alt={item.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 320px"
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${KIND_TONE[item.kind] ?? KIND_TONE.link}`}>
                      <Icon className="h-8 w-8 opacity-80" />
                    </div>
                  )}
                  {item.kind === "mavyn_project" && (
                    <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border border-lime-400/40 bg-ink/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-lime-300 backdrop-blur">
                      <BadgeCheck className="h-3 w-3" /> Verified project
                    </span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2 p-3.5">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-zinc-100">{item.title}</h3>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {item.client ? `Client: ${item.client}` : item.kind.replace("_", " ")}
                    </p>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => remove(item.id)}
                      title="Remove from portfolio"
                      className="shrink-0 rounded-md p-1 text-zinc-600 transition hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {isOwner && (
            <Link
              href="/profile/edit"
              className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300"
            >
              <Plus className="h-6 w-6" />
              <span className="text-xs font-semibold">Add work</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
