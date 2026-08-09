"use client";

/* ------------------------------------------------------------------ */
/*  Works — showcase safely, license on YOUR terms.                    */
/*  Streaming previews (configurable length, creator-controlled        */
/*  watermark labeling) instead of source files; license options are   */
/*  the creator's own. "My licenses" is the permanent record both      */
/*  sides can point to. UpNova never claims audio can't be recorded —  */
/*  terms + records + a dispute lane are the real protection.          */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Disc3, Plus, FileKey2, MessageSquare, Check } from "lucide-react";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useSession } from "@/lib/session";
import { WORK_KINDS, LICENSE_STATUS_LABEL, type LicenseOption } from "@/lib/licensing";

interface WorkItem {
  id: string;
  title: string;
  kind: string;
  description: string;
  coverUrl: string | null;
  previewUrl: string | null;
  previewLength: number;
  watermarked: boolean;
  options: LicenseOption[];
  exclusivelyLicensed: boolean;
  creator: { handle: string; displayName: string; avatarUrl: string | null; verified: boolean };
  isMine: boolean;
}

interface LicenseRow {
  id: string;
  workId: string | null;
  workTitle: string;
  licenseType: string;
  optionName: string;
  permittedUsage: string;
  restrictions: string;
  attribution: boolean;
  price: number;
  status: string;
  conversationId: string | null;
  myRole: "creator" | "licensee";
  with: string;
  date: string;
}

export default function WorksPage() {
  const { user: me } = useSession();
  const [works, setWorks] = useState<WorkItem[] | null>(null);
  const [licenses, setLicenses] = useState<LicenseRow[] | null>(null);
  const [view, setView] = useState<"browse" | "licenses">("browse");
  const [kind, setKind] = useState("All");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("licenses")) setView("licenses");
    fetch("/api/works", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setWorks(d.works ?? []));
  }, []);

  const loadLicenses = useCallback(async () => {
    const res = await fetch("/api/me/licenses", { cache: "no-store" });
    if (!res.ok) return setLicenses([]);
    setLicenses((await res.json()).licenses ?? []);
  }, []);
  useEffect(() => {
    if (view === "licenses") loadLicenses();
  }, [view, loadLicenses]);

  const confirm = async (id: string) => {
    await fetch(`/api/licenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });
    loadLicenses();
  };

  const kinds = ["All", ...Array.from(new Set((works ?? []).map((w) => w.kind)))];
  const filtered = (works ?? []).filter((w) => kind === "All" || w.kind === kind);
  const kindLabel = (k: string) => WORK_KINDS.find((x) => x.id === k)?.label ?? k;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
          <Disc3 className="h-5 w-5 text-lime-400" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Works &amp; Licensing</h1>
          <p className="text-sm text-zinc-400">
            Preview the work, license it on the creator&apos;s terms — every license leaves a record.
          </p>
        </div>
        {me && (
          <Link href="/works/new" className="btn-lime shrink-0 px-4 py-1.5 text-xs sm:text-sm">
            <Plus className="h-4 w-4" /> Publish a work
          </Link>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4 border-b border-line-soft text-sm">
        {(["browse", "licenses"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`-mb-px border-b-2 pb-2.5 transition ${view === v ? "border-white font-semibold text-zinc-50" : "border-transparent font-medium text-zinc-500 hover:text-zinc-300"}`}>
            {v === "browse" ? "Browse" : "My licenses"}
          </button>
        ))}
      </div>

      {view === "browse" ? (
        <>
          <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto">
            {kinds.map((k) => (
              <button key={k} onClick={() => setKind(k)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${kind === k ? "border-lime-400/50 bg-lime-400/10 font-semibold text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
                {k === "All" ? "All" : kindLabel(k)}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {works === null ? (
              [0, 1].map((i) => <div key={i} className="card-money h-44 animate-pulse" aria-hidden />)
            ) : (
              filtered.map((w) => {
                const from = w.options.filter((o) => o.price != null && o.price > 0).sort((a, b) => a.price! - b.price!)[0];
                return (
                  <article key={w.id} className={`card-money flex flex-col p-4 ${w.exclusivelyLicensed ? "opacity-70" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{kindLabel(w.kind)}</p>
                        <h3 className="text-sm font-bold text-zinc-100">
                          <Link href={`/works/${w.id}`} className="transition hover:text-lime-300">{w.title}</Link>
                        </h3>
                        <p className="font-mono text-xs font-medium tracking-[0.08em] text-lime-300">
                          {w.exclusivelyLicensed ? "Exclusively licensed" : from ? `Licenses from $${from.price}` : w.options.some((o) => o.price === 0) ? "Free option available" : "Custom licensing"}
                        </p>
                      </div>
                      {w.watermarked && (
                        <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-500" title={`Tagged streaming preview · ${w.previewLength}s`}>
                          Tagged preview
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-zinc-400">{w.description}</p>
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {w.options.slice(0, 3).map((o) => (
                        <span key={o.id} className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] tracking-[0.05em] text-zinc-400">
                          {o.name} {o.price == null ? "· quote" : o.price === 0 ? "· free" : `· $${o.price}`}
                        </span>
                      ))}
                    </p>
                    <div className="mt-3 flex items-center gap-2 border-t border-dashed border-line pt-3">
                      <Link href={`/creator/${w.creator.handle}`} className="flex min-w-0 flex-1 items-center gap-2">
                        <Avatar src={w.creator.avatarUrl} initials={w.creator.displayName.charAt(0)} size="xs" />
                        <span className="flex items-center gap-1 truncate text-xs font-semibold text-zinc-200">
                          {w.creator.displayName}
                          {w.creator.verified && <VerifiedBadge className="h-3 w-3" />}
                        </span>
                      </Link>
                      <Link href={`/works/${w.id}`} className="btn-lime shrink-0 px-3.5 py-1.5 text-xs">
                        <FileKey2 className="h-3.5 w-3.5" /> {w.isMine ? "Manage" : "License"}
                      </Link>
                    </div>
                  </article>
                );
              })
            )}
            {works !== null && filtered.length === 0 && (
              <p className="col-span-full py-10 text-center text-sm text-zinc-500">No works yet.</p>
            )}
          </div>
        </>
      ) : (
        <div className="mt-4 space-y-2.5">
          {me === null ? (
            <div className="card p-8 text-center">
              <p className="text-sm font-semibold text-zinc-200">Create an account to hold licenses</p>
              <Link href="/signup?next=%2Fworks%3Flicenses%3D1" className="btn-lime mt-4 inline-flex px-5 py-2 text-sm">Create free account</Link>
            </div>
          ) : licenses === null ? (
            <div className="card h-24 animate-pulse" aria-hidden />
          ) : licenses.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm font-semibold text-zinc-200">No licenses yet</p>
              <p className="mt-1 text-xs text-zinc-500">License a work and the full record lives here permanently.</p>
            </div>
          ) : (
            licenses.map((l) => (
              <article key={l.id} className="card p-4">
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-zinc-100">
                  {l.workTitle}
                  <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-400">{l.optionName}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${l.status === "completed" ? "border-lime-400/40 text-lime-300" : "border-amber-400/40 text-amber-300"}`}>
                    {l.status}
                  </span>
                </p>
                <p className="mt-1 font-mono text-[11px] tracking-[0.05em] text-zinc-500">
                  License #{l.id.slice(0, 8).toUpperCase()} · {l.myRole === "creator" ? `licensed to ${l.with}` : `from ${l.with}`} ·{" "}
                  {new Date(l.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ·{" "}
                  <span className="text-lime-300">${l.price}</span>
                </p>
                <ul className="mt-2 space-y-0.5 text-xs leading-relaxed text-zinc-400">
                  {l.permittedUsage && <li><span className="text-zinc-500">Permitted:</span> {l.permittedUsage}</li>}
                  {l.restrictions && <li><span className="text-zinc-500">Restrictions:</span> {l.restrictions}</li>}
                  {l.attribution && <li className="text-zinc-300">Attribution required</li>}
                  <li className="text-zinc-600">{LICENSE_STATUS_LABEL[l.status] ?? l.status}</li>
                </ul>
                <div className="mt-2.5 flex items-center gap-2 border-t border-line-soft pt-2.5">
                  {l.myRole === "licensee" && l.status === "issued" && (
                    <button onClick={() => confirm(l.id)} className="btn-lime px-3.5 py-1.5 text-xs">
                      <Check className="h-3.5 w-3.5" /> Confirm delivery — release ${l.price}
                    </button>
                  )}
                  {l.conversationId && (
                    <Link href={`/messages?c=${l.conversationId}`} className="btn-ghost px-3 py-1.5 text-xs">
                      <MessageSquare className="h-3.5 w-3.5" /> Conversation
                    </Link>
                  )}
                  {l.workId && (
                    <Link href={`/works/${l.workId}`} className="rounded-full px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">View work</Link>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
