"use client";

/* ------------------------------------------------------------------ */
/*  TrustChips — renders a post's trust/context labels from the        */
/*  registry in lib/trust.ts. Shows what was actually verified;        */
/*  claims (attestation, disclosure) are labeled as claims.            */
/*  Reused by the feed post card and the profile post modal.           */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import { ShieldCheck, UserCheck, PenLine, Sparkles, AtSign, Check } from "lucide-react";
import { CONTENT_SIGNALS, DISCLOSURES, type PostTrust } from "@/lib/trust";

const TONE: Record<string, string> = {
  lime: "border-lime-400/40 bg-lime-400/10 text-lime-300",
  violet: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  amber: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  zinc: "border-line bg-card-raised text-zinc-400",
};

function Chip({ tone, title, children }: { tone: string; title: string; children: React.ReactNode }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] ${TONE[tone] ?? TONE.zinc}`}
    >
      {children}
    </span>
  );
}

export default function TrustChips({
  trust,
  postId,
  onConfirmed,
}: {
  trust?: PostTrust | null;
  postId?: string;
  onConfirmed?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  if (!trust) return null;

  const disclosureChip = DISCLOSURES[trust.disclosure]?.chip;
  const showConfirmed = trust.clientConfirmed || confirmed;
  const nothing = !trust.verifiedWork && !trust.attested && !disclosureChip;
  if (nothing) return null;

  const confirm = async () => {
    if (!postId) return;
    setConfirming(true);
    const res = await fetch(`/api/posts/${postId}/confirm`, { method: "POST" });
    setConfirming(false);
    if (res.ok) {
      setConfirmed(true);
      onConfirmed?.();
    }
  };

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      {trust.verifiedWork && (
        <Chip tone="lime" title={`${CONTENT_SIGNALS.verified_work.description} — ${trust.verifiedWork.title} with ${trust.verifiedWork.with}`}>
          <ShieldCheck className="h-3 w-3" /> Verified Work
        </Chip>
      )}
      {showConfirmed && (
        <Chip tone="violet" title={CONTENT_SIGNALS.client_confirmed.description}>
          <UserCheck className="h-3 w-3" /> Client Confirmed
        </Chip>
      )}
      {trust.attested && (
        <Chip tone="zinc" title={CONTENT_SIGNALS.creator_attested.description}>
          <PenLine className="h-3 w-3" /> Creator Attested
        </Chip>
      )}
      {disclosureChip && trust.disclosure !== "credited" && (
        <Chip tone="amber" title={DISCLOSURES[trust.disclosure].hint}>
          <Sparkles className="h-3 w-3" /> {disclosureChip}
        </Chip>
      )}
      {trust.disclosure === "credited" && (
        <Chip tone="zinc" title={DISCLOSURES.credited.hint}>
          <AtSign className="h-3 w-3" /> Credited Work{trust.credit ? `: ${trust.credit}` : ""}
        </Chip>
      )}
      {/* the linked client sees a one-tap confirm — nobody else does */}
      {trust.canConfirm && !showConfirmed && (
        <button
          onClick={confirm}
          disabled={confirming}
          className="inline-flex items-center gap-1 rounded-full border border-violet-400/50 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-violet-300 transition hover:bg-violet-400/10 disabled:opacity-50"
          title="You were the client on the linked transaction — confirm this work happened"
        >
          <Check className="h-3 w-3" /> {confirming ? "Confirming…" : "Confirm this work"}
        </button>
      )}
    </div>
  );
}
