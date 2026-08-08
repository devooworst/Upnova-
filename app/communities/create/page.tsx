"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, PartyPopper, Users } from "lucide-react";
import {
  communityAccessInfo,
  communityModeInfo,
  type CommunityAccess,
  type CommunityMode,
} from "@/lib/data";

/* ------------------------------------------------------------------ */
/* Create Community: a setup wizard, not an instant group chat.        */
/* The creator decides how open, how local, how interactive, and how   */
/* moderated their space is — within UpNova's platform rules.          */
/* ------------------------------------------------------------------ */

const types = [
  "General", "School / Campus", "Organization", "Creative", "Music",
  "Fashion", "Technology", "Gaming", "Sports", "Professional",
  "Neighborhood / Local", "Faith / Inspiration", "Support / Interest", "Lifestyle", "Other",
];

const reaches = ["5 miles", "25 miles", "City", "State", "Nationwide", "Global", "School"];

const defaultRules = [
  "Respect everyone.",
  "No harassment.",
  "No spam.",
  "No scams.",
  "No unauthorized advertising.",
  "Keep posts relevant.",
  "Follow UpNova's Terms and Safety Rules.",
];

const colors = [
  ["Lime", "from-lime-500/70 to-emerald-900"],
  ["Violet", "from-violet-600/70 to-purple-950"],
  ["Amber", "from-amber-500/70 to-orange-950"],
  ["Sky", "from-sky-500/70 to-blue-950"],
  ["Rose", "from-rose-500/70 to-pink-950"],
  ["Zinc", "from-zinc-600 to-zinc-900"],
] as const;

export default function CreateCommunityPage() {
  const [published, setPublished] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✦");
  const [type, setType] = useState(types[3]);
  const [access, setAccess] = useState<CommunityAccess>("public");
  const [reach, setReach] = useState("25 miles");
  const [school, setSchool] = useState("Bowie State University");
  const [mode, setMode] = useState<CommunityMode>("discussion");
  const [rules, setRules] = useState(defaultRules.join("\n"));
  const [requireAgree, setRequireAgree] = useState(true);
  const [color, setColor] = useState<string>(colors[1][1]);
  const [settings, setSettings] = useState({
    promotion: true,
    opportunities: true,
    events: true,
    links: true,
    approval: false,
  });
  const toggleSetting = (k: keyof typeof settings) =>
    setSettings((s) => ({ ...s, [k]: !s[k] }));

  const isSchool = reach === "School";

  if (published) {
    return (
      <div className="mx-auto max-w-md pt-10 text-center">
        <PartyPopper className="mx-auto h-10 w-10 text-violet-400" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">
          {emoji} {name || "Your community"} is live
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          {communityAccessInfo[access].label} · {communityModeInfo[mode].label} ·{" "}
          {isSchool ? school : reach}. You&apos;re the Owner — add Admins and Moderators as it grows.
        </p>
        {(access === "invite" || access === "private") && (
          <div className="mx-auto mt-4 flex max-w-xs items-center gap-2 rounded-md border border-line bg-card-raised px-3 py-2 text-xs text-zinc-300">
            <span className="truncate font-mono">upnova.app/i/{(name || "community").toLowerCase().replace(/\s+/g, "-").slice(0, 18)}-x7f2</span>
            <button className="ml-auto flex shrink-0 items-center gap-1 text-violet-300 hover:text-violet-200">
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/communities" className="rounded-md bg-violet-400 px-5 py-2 text-xs font-bold text-zinc-950 transition hover:bg-violet-300">
            See it on Communities
          </Link>
          <button onClick={() => setPublished(false)} className="btn-ghost px-5 py-2 text-xs">
            Edit setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <Link href="/communities" className="flex w-fit items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Communities
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-50">Create a Community</h1>
        <p className="mt-1 text-sm text-zinc-500">
          A customizable space, not just a group chat. You decide how open, how local, how
          interactive, and how moderated it is.
        </p>
      </header>

      {/* 1 · type */}
      <section className="card-people p-5">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-400">1 · What kind of community?</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                type === t ? "border-violet-400/60 bg-violet-400/10 text-violet-200" : "border-line text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* 2 · access */}
      <section className="card-people p-5">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-400">2 · Who can join?</h2>
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {(Object.keys(communityAccessInfo) as CommunityAccess[]).map((a) => (
            <button
              key={a}
              onClick={() => setAccess(a)}
              className={`rounded-md border p-3 text-left transition ${
                access === a ? "border-violet-400/50 bg-violet-400/5" : "border-line hover:border-zinc-600"
              }`}
            >
              <p className="text-sm font-semibold text-zinc-100">{communityAccessInfo[a].label}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{communityAccessInfo[a].desc}</p>
            </button>
          ))}
        </div>
        {access === "verified" && (
          <p className="mt-2.5 text-xs text-zinc-500">
            e.g. Bowie State students, or verified members of an organization.
          </p>
        )}
      </section>

      {/* 3 · reach */}
      <section className="card-people p-5">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-400">3 · Who is this community for?</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {reaches.map((r) => (
            <button
              key={r}
              onClick={() => setReach(r)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                reach === r ? "border-white/50 bg-white/10 text-zinc-100" : "border-line text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {isSchool && (
          <div className="mt-3">
            <select value={school} onChange={(e) => setSchool(e.target.value)} className="input-dark max-w-xs">
              <option>Bowie State University</option>
              <option>Morgan State University</option>
              <option>University of Maryland</option>
              <option>Towson University</option>
            </select>
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
              Official-school designation requires UpNova verification — typing a school&apos;s
              name doesn&apos;t grant a verified badge.
            </p>
          </div>
        )}
      </section>

      {/* 4 · rules */}
      <section className="card-people p-5">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-400">4 · Community rules</h2>
        <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={7} className="input-dark mt-3 resize-none text-xs leading-relaxed" />
        <label className="mt-2.5 flex cursor-pointer items-center gap-2.5 text-xs text-zinc-400">
          <input type="checkbox" checked={requireAgree} onChange={(e) => setRequireAgree(e.target.checked)} className="accent-violet-400" />
          Members must agree to the rules when joining
        </label>
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
          Your rules run your space — they never override UpNova&apos;s safety policies.
        </p>
      </section>

      {/* 5 · interaction mode */}
      <section className="card-people p-5">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-400">5 · How can people interact?</h2>
        <div className="mt-3 space-y-1.5">
          {(Object.keys(communityModeInfo) as CommunityMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition ${
                mode === m ? "border-violet-400/50 bg-violet-400/5" : "border-line hover:border-zinc-600"
              }`}
            >
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${mode === m ? "border-violet-400 bg-violet-400/20" : "border-zinc-600"}`}>
                {mode === m && <Check className="h-2.5 w-2.5 text-violet-400" />}
              </span>
              <span>
                <span className="block text-sm font-semibold text-zinc-100">{communityModeInfo[m].label}</span>
                <span className="block text-xs text-zinc-500">{communityModeInfo[m].desc}</span>
              </span>
            </button>
          ))}
        </div>
        {mode === "broadcast" && (
          <p className="mt-2.5 rounded-md border border-amber-400/25 bg-amber-400/5 p-2.5 text-xs text-zinc-400">
            Perfect for inspirational, motivational, or announcement communities — members react
            and save, but can&apos;t flood the space.
          </p>
        )}
      </section>

      {/* 6 · appearance */}
      <section className="card-people p-5">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-400">6 · Appearance</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[4rem_1fr]">
          <div>
            <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Icon</label>
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} className="input-dark mt-1.5 text-center text-lg" />
          </div>
          <div>
            <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Community name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="DMV Music Producers" className="input-dark mt-1.5" />
          </div>
        </div>
        <div className="mt-3">
          <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Description</label>
          <textarea rows={2} placeholder="What is this space for, and who is it for?" className="input-dark mt-1.5 resize-none" />
        </div>
        <div className="mt-3">
          <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Community color</label>
          <div className="mt-2 flex gap-2">
            {colors.map(([label, grad]) => (
              <button
                key={label}
                onClick={() => setColor(grad)}
                title={label}
                aria-label={`${label} theme`}
                className={`h-8 w-8 rounded-lg bg-gradient-to-br ${grad} ${color === grad ? "ring-2 ring-white" : "opacity-70 hover:opacity-100"}`}
              />
            ))}
          </div>
        </div>
        {/* live preview */}
        <div className="mt-4 overflow-hidden rounded-xl border border-line">
          <div className={`flex h-16 items-center justify-center bg-gradient-to-br text-3xl ${color}`}>{emoji}</div>
          <div className="p-3">
            <p className="text-sm font-bold text-zinc-100">{name || "Your community"}</p>
            <p className="text-xs text-zinc-500">
              {communityAccessInfo[access].label} · {communityModeInfo[mode].label} · {isSchool ? school : reach}
            </p>
          </div>
        </div>
      </section>

      {/* 7 · permissions */}
      <section className="card-people p-5">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-400">7 · What can members do?</h2>
        <div className="mt-3 space-y-1">
          {(
            [
              ["promotion", "Allow members to promote services"],
              ["opportunities", "Allow members to post opportunities"],
              ["events", "Allow event promotion"],
              ["links", "Allow external links"],
              ["approval", "Require approval before posts appear"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-sm text-zinc-300 transition hover:bg-card-raised">
              {label}
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={() => toggleSetting(key)}
                className="accent-violet-400"
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
          One owner might want &ldquo;no advertising&rdquo;; another wants &ldquo;everybody show me
          what you&apos;re selling.&rdquo; Your space, your call.
        </p>
      </section>

      {/* roles note */}
      <section className="rounded-xl border border-line p-4 text-xs text-zinc-500">
        <p className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Users className="h-4 w-4 text-violet-400" /> Roles
        </p>
        <p className="mt-1.5 leading-relaxed">
          You start as <span className="font-semibold text-zinc-300">Owner</span> (full control).
          Add <span className="font-semibold text-zinc-300">Admins</span> (manage the community) and{" "}
          <span className="font-semibold text-zinc-300">Moderators</span> (remove posts, mute /
          remove / ban members, lock comments, approve posts) once people join. Every community
          stays subject to UpNova&apos;s platform rules.
        </p>
      </section>

      <button
        onClick={() => setPublished(true)}
        disabled={!name.trim()}
        className={`w-full rounded-full py-3 text-sm font-bold transition ${
          name.trim()
            ? "bg-violet-400 text-zinc-950 hover:bg-violet-300 hover:shadow-glow-violet"
            : "cursor-not-allowed bg-card-raised text-zinc-600"
        }`}
      >
        Create Community
      </button>
    </div>
  );
}
