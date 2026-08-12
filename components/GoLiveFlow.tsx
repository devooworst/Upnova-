"use client";

/* ------------------------------------------------------------------ */
/*  GoLiveFlow — the ONE Go Live form (used by the Live page and the   */
/*  Create modal). Deliberately simple, per the product rule:          */
/*    1 · "What's happening?" title                                    */
/*    2 · category chips                                               */
/*    3 · who can watch (campus requires the VERIFIED campus)          */
/*    4 · optional "Live controls" (collapsed by default)              */
/*    → one prominent GO LIVE                                          */
/*  Advanced moderation lives on the stream page AFTER going live.     */
/* ------------------------------------------------------------------ */

import { Radio, ChevronDown, ShieldCheck, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  ["music", "Music"], ["gaming", "Gaming"], ["fashion", "Fashion"], ["fitness", "Fitness"],
  ["education", "Education"], ["business", "Business"], ["conversation", "Conversation"],
  ["behind_the_scenes", "Behind the Scenes"], ["irl", "IRL"], ["creative", "Creative"], ["other", "Other"],
] as const;

const AUDIENCES = [
  ["everyone", "Everyone", "Anyone on Mavyn can watch"],
  ["followers", "Followers", "Only people who follow you"],
  ["campus", "Campus", "Verified members of your school"],
  ["nearby", "Nearby", "People close to your city — never your exact location"],
  ["community", "Community", "Members of one of your communities"],
  ["invite", "Invite only", "Only guests you invite on stage"],
] as const;

const TOGGLES = [
  ["chatEnabled", "Enable chat"],
  ["reactionsEnabled", "Allow reactions"],
  ["sharingEnabled", "Allow sharing"],
  ["guestsEnabled", "Allow guests / co-hosts"],
  ["saveReplay", "Save replay when I end"],
] as const;

export default function GoLiveFlow({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("music");
  const [audience, setAudience] = useState("everyone");
  const [communityId, setCommunityId] = useState("");
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    chatEnabled: true, reactionsEnabled: true, sharingEnabled: true, guestsEnabled: true, saveReplay: true,
  });
  const [showControls, setShowControls] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [campus, setCampus] = useState<{ verified: boolean; campusName?: string } | null>(null);
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    fetch("/api/campus/verify").then((r) => r.json()).then(setCampus).catch(() => setCampus({ verified: false }));
    fetch("/api/communities").then((r) => r.json()).then((d) => setCommunities((d.mine ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))).catch(() => {});
  }, []);

  const start = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category, audience, communityId: communityId || undefined, ...toggles }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(j.error || "Couldn't start the live");
    onClose?.();
    router.push(`/live/${j.id}`);
  };

  return (
    <div className="space-y-4" data-guide="golive-flow">
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">What are you doing?</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 120))}
          placeholder="What's happening? — e.g. Making a beat from scratch"
          aria-label="Live title"
          data-guide="golive-title"
          className="input-dark"
          autoFocus
        />
      </div>

      <div data-guide="golive-category">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Category</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(([v, l]) => (
            <button
              key={v}
              onClick={() => setCategory(v)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                category === v ? "border-red-400/50 bg-red-400/10 text-red-300" : "border-line text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div data-guide="golive-audience">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Who can watch?</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {AUDIENCES.map(([v, l, hint]) => {
            const campusLocked = v === "campus" && campus !== null && !campus.verified;
            return (
              <button
                key={v}
                onClick={() => !campusLocked && setAudience(v)}
                disabled={campusLocked}
                title={campusLocked ? "Verify your campus in Settings to stream to your school" : undefined}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  audience === v
                    ? "border-red-400/50 bg-red-400/10"
                    : campusLocked
                      ? "cursor-not-allowed border-line-soft opacity-50"
                      : "border-line hover:border-zinc-600"
                }`}
              >
                <span className={`text-xs font-semibold ${audience === v ? "text-red-300" : "text-zinc-300"}`}>{l}</span>
                <span className="block text-[10px] leading-tight text-zinc-500">{hint}</span>
              </button>
            );
          })}
        </div>
        {audience === "campus" && campus?.verified && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-300">
            <ShieldCheck size={12} /> Streaming to {campus.campusName} — your verified campus. Only verified members can watch.
          </p>
        )}
        {audience === "community" && (
          <select value={communityId} onChange={(e) => setCommunityId(e.target.value)} className="input-dark mt-2" aria-label="Community">
            <option value="">Pick one of your communities…</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      <div>
        <button
          onClick={() => setShowControls((s) => !s)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 transition hover:text-zinc-200"
          data-guide="golive-controls"
        >
          <ChevronDown size={12} className={`transition ${showControls ? "rotate-180" : ""}`} /> Live controls
          <span className="font-normal text-zinc-600">— chat, reactions, sharing, guests, replay (all on by default)</span>
        </button>
        {showControls && (
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {TOGGLES.map(([k, l]) => (
              <label key={k} className="flex cursor-pointer items-center justify-between rounded-lg border border-line bg-card-raised px-3 py-2 text-xs text-zinc-300">
                {l}
                <input
                  type="checkbox"
                  checked={toggles[k]}
                  onChange={(e) => setToggles((t) => ({ ...t, [k]: e.target.checked }))}
                  className="accent-red-400"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      {error && <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

      <button
        onClick={start}
        disabled={!title.trim() || busy || (audience === "community" && !communityId)}
        data-guide="golive-start"
        className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition ${
          title.trim() && !busy ? "bg-red-500 text-white hover:bg-red-400" : "cursor-not-allowed bg-card-raised text-zinc-600"
        }`}
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Radio size={15} />} GO LIVE
      </button>
      <p className="text-center text-[10px] text-zinc-600">
        You can change chat, guests and moderation any time while you're live.
      </p>
    </div>
  );
}
