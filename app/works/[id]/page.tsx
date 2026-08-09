"use client";

/* ------------------------------------------------------------------ */
/*  Work page — stream the preview, license on the creator's terms.    */
/*  Guests see everything; licensing asks for an account. Every        */
/*  purchase creates the permanent license record. Exclusive sales     */
/*  stop further licensing. Report-unauthorized-use feeds the human    */
/*  dispute lane, where license records are the evidence.              */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Lock, Link2, Check, FileKey2, Flag, BadgeCheck, Play } from "lucide-react";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import TrustReportModal from "@/components/TrustReportModal";
import { useSession } from "@/lib/session";
import { promptJoin } from "@/components/GuestGate";
import { PublishedBanner } from "@/components/ShareSheet";
import { WORK_KINDS, WORK_REPORT_REASONS, type LicenseOption } from "@/lib/licensing";

interface WorkDetail {
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
  archived: boolean;
  licensesIssued: number;
  createdAt: string;
  creator: { id: string; handle: string; displayName: string; avatarUrl: string | null; verified: boolean; roleLine: string };
  creatorStats: { worksLicensed: number; identityVerified: boolean; businessVerified: boolean };
  myLicense: { id: string; optionName: string; status: string } | null;
  isMine: boolean;
}

export default function WorkPage() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useSession();
  const [w, setW] = useState<WorkDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [buying, setBuying] = useState<LicenseOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState<{ licenseId?: string; negotiation?: boolean } | null>(null);
  const [reporting, setReporting] = useState(false);

  const load = () =>
    fetch(`/api/works/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) setError(d.error || "Not found");
        else setW(d.work);
      })
      .catch(() => setError("Network error"));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const license = async (o: LicenseOption) => {
    if (!w) return;
    if (me === null) return promptJoin("license", `/works/${w.id}`);
    setBusy(true);
    setNotice(null);
    const total = o.price != null ? +(o.price * 1.05).toFixed(2) : undefined;
    const res = await fetch(`/api/works/${w.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: o.id, expectedTotal: total }),
    });
    const d = await res.json();
    setBusy(false);
    setBuying(null);
    if (!res.ok) return setNotice(d.error || "Could not license");
    setDone(d);
    load();
  };

  if (error)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold text-zinc-200">{error}</p>
        <Link href="/works" className="btn-ghost mt-4 inline-flex px-4 py-1.5 text-xs">Browse works</Link>
      </div>
    );
  if (!w) return <div className="card-money mx-auto h-64 max-w-2xl animate-pulse" aria-hidden />;

  const kindLabel = WORK_KINDS.find((k) => k.id === w.kind)?.label ?? w.kind;
  const isAudio = w.previewUrl?.startsWith("data:audio/");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/works" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="h-3.5 w-3.5" /> Works
      </Link>

      <PublishedBanner path={`/works/${w.id}`} title={`${w.title} — license on UpNova`} text="Stream the preview, license on the creator's terms" />

      <article className="card-money p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {w.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.coverUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover" />
            )}
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {kindLabel}
                {w.exclusivelyLicensed && <span className="ml-2 text-amber-300">· Exclusively licensed</span>}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">{w.title}</h1>
              <p className="text-[11px] text-zinc-500">{w.licensesIssued} license{w.licensesIssued === 1 ? "" : "s"} on record</p>
            </div>
          </div>
          <button onClick={share} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">
            {copied ? <Check className="h-3.5 w-3.5 text-lime-300" /> : <Link2 className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Share"}
          </button>
        </div>

        {/* ------------------- streaming preview ------------------- */}
        <div className="mt-4 rounded-xl border border-line bg-card-raised/50 p-3.5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            <Play className="h-3 w-3" /> Preview · {w.previewLength}s{w.watermarked ? " · tagged" : ""}
          </p>
          {isAudio ? (
            <audio controls preload="none" src={w.previewUrl!} className="mt-2 w-full" />
          ) : w.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.previewUrl} alt="Preview" className="mt-2 max-h-64 rounded-lg border border-line object-contain" />
          ) : (
            <p className="mt-2 text-xs text-zinc-500">
              The creator hasn&apos;t attached a streaming clip yet — ask for one in Messages.
            </p>
          )}
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
            Previews stream — the original files are delivered after licensing. Previews reduce
            unauthorized use; nothing makes media impossible to record. The license terms and records
            below are the real protection.
          </p>
        </div>

        {w.description && <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-300">{w.description}</p>}

        {/* ------------------- license options ------------------- */}
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">License options — the creator&apos;s terms</p>
          {done && (
            <p className="mt-2 rounded-xl border border-lime-400/40 bg-lime-400/5 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-200">
              {done.negotiation ? (
                <>Inquiry sent — negotiate the custom terms in <Link href="/messages" className="font-semibold text-lime-300 underline-offset-2 hover:underline">Messages</Link>.</>
              ) : (
                <>License <span className="font-mono tracking-[0.05em] text-lime-300">#{done.licenseId?.slice(0, 8).toUpperCase()}</span> issued — the full record is in <Link href="/works?licenses=1" className="font-semibold text-lime-300 underline-offset-2 hover:underline">My licenses</Link>.</>
              )}
            </p>
          )}
          {notice && <p className="mt-2 text-xs font-medium text-rose-300">{notice}</p>}
          <div className="mt-2 space-y-2">
            {w.options.map((o) => (
              <div key={o.id} className={`rounded-xl border p-3.5 ${w.exclusivelyLicensed ? "opacity-50" : "border-line"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-100">
                    {o.name}
                    <span className="ml-2 rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-zinc-500">{o.type.replace("_", "-")}</span>
                    {o.attribution && <span className="ml-1.5 text-[10px] text-violet-300">attribution required</span>}
                  </p>
                  <span className="font-mono text-sm font-medium tracking-[0.08em] text-lime-300">
                    {o.price == null ? "Quote" : o.price === 0 ? "Free" : `$${o.price}`}
                  </span>
                </div>
                <ul className="mt-1.5 space-y-0.5 text-[11px] leading-relaxed text-zinc-400">
                  {o.usage && <li><span className="text-zinc-500">Permitted:</span> {o.usage}</li>}
                  {o.restrictions && <li><span className="text-zinc-500">Not allowed:</span> {o.restrictions}</li>}
                </ul>
                {!w.isMine && !w.exclusivelyLicensed && !w.archived && (
                  buying?.id === o.id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line-soft pt-2">
                      <span className="text-xs text-zinc-400">
                        {o.price == null ? "Opens the conversation to negotiate terms." : o.price === 0 ? "Free — the record is still created." : `$${o.price} + $${(o.price * 0.05).toFixed(2)} fee = $${(o.price * 1.05).toFixed(2)} (demo payment, held until delivery)`}
                      </span>
                      <button onClick={() => license(o)} disabled={busy} className="btn-lime px-3.5 py-1.5 text-xs disabled:opacity-40">
                        {busy ? "…" : o.price == null ? "Start conversation" : o.price === 0 ? "Get free license" : `Pay $${(o.price * 1.05).toFixed(2)}`}
                      </button>
                      <button onClick={() => setBuying(null)} className="btn-ghost px-2.5 py-1.5 text-xs">Back</button>
                    </div>
                  ) : (
                    <button onClick={() => (me === null ? promptJoin("license", `/works/${w.id}`) : setBuying(o))} className="btn-lime mt-2 px-3.5 py-1.5 text-xs">
                      <FileKey2 className="h-3.5 w-3.5" /> {o.price == null ? "Request quote" : o.price === 0 ? "Use free" : "License"}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
          {me === null && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
              <Lock className="h-3 w-3" /> Create a free account to license — the record lives on your account.
            </p>
          )}
          {w.myLicense && (
            <p className="mt-2 text-[11px] text-zinc-400">
              You hold license <span className="font-mono tracking-[0.05em] text-lime-300">#{w.myLicense.id.slice(0, 8).toUpperCase()}</span> ({w.myLicense.optionName}) — see <Link href="/works?licenses=1" className="text-lime-300 underline-offset-2 hover:underline">My licenses</Link>.
            </p>
          )}
        </div>

        {/* ------------------- creator + report ------------------- */}
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card-raised/50 p-3.5">
          <Link href={`/creator/${w.creator.handle}`}>
            <Avatar src={w.creator.avatarUrl} initials={w.creator.displayName.charAt(0)} size="md" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/creator/${w.creator.handle}`} className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-zinc-100 hover:text-violet-300">
              {w.creator.displayName}
              {w.creator.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
              {w.creatorStats.identityVerified && (
                <span className="inline-flex items-center gap-1 text-[10px] text-lime-300"><BadgeCheck className="h-3 w-3" /> Identity Verified</span>
              )}
            </Link>
            <p className="truncate text-xs text-zinc-500">
              {w.creator.roleLine} · {w.creatorStats.worksLicensed} license{w.creatorStats.worksLicensed === 1 ? "" : "s"} issued all-time
            </p>
          </div>
          {me && (
            <button onClick={() => setReporting(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-zinc-500 transition hover:text-rose-300">
              <Flag className="h-3.5 w-3.5" /> Report
            </button>
          )}
        </div>
      </article>

      {reporting && (
        <TrustReportModal
          targetType="work"
          targetId={w.id}
          targetLabel={`work "${w.title}"`}
          reasons={WORK_REPORT_REASONS}
          onClose={() => setReporting(false)}
        />
      )}
    </div>
  );
}
