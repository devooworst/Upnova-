"use client";

/* ------------------------------------------------------------------ */
/*  Create a community — the creator decides visibility, who can post   */
/*  and invite, the rules, and WHICH IDENTITY MODES the room permits    */
/*  (real profile / alias / anonymous). Campus linking requires         */
/*  verified campus status; server-enforced.                            */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, GraduationCap } from "lucide-react";
import { useSession } from "@/lib/session";
import { COMMUNITY_ACCESS, COMMUNITY_CATEGORIES, IDENTITY_MODES } from "@/lib/communityIdentity";

export default function CreateCommunityPage() {
  const { user } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [access, setAccess] = useState("public");
  const [joinApproval, setJoinApproval] = useState(false);
  const [whoCanPost, setWhoCanPost] = useState("members");
  const [whoCanInvite, setWhoCanInvite] = useState("mods");
  const [modes, setModes] = useState<string[]>(["real"]);
  const [rules, setRules] = useState<string[]>([]);
  const [ruleDraft, setRuleDraft] = useState("");
  const [campus, setCampus] = useState<{ campusId: string; campusName: string } | null>(null);
  const [linkCampus, setLinkCampus] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void fetch("/api/campus/verify").then(async (r) => {
      if (r.ok) {
        const j = await r.json();
        if (j.verified) setCampus({ campusId: j.campusId, campusName: j.campusName });
      }
    });
  }, [user]);

  const toggleMode = (m: string) =>
    setModes((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const submit = async () => {
    setErr(null);
    setBusy(true);
    const res = await fetch("/api/communities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        category,
        access,
        joinApproval,
        whoCanPost,
        whoCanInvite,
        identityModes: modes,
        rules,
        campusId: linkCampus && campus ? campus.campusId : undefined,
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(j.error || "Couldn't create the community");
    router.push(`/communities/${j.slug}`);
  };

  const input =
    "w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-400/40";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="px-1">
        <Link href="/communities" className="mb-2 inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.1em] text-zinc-500 hover:text-violet-300">
          <ArrowLeft className="h-3 w-3" /> COMMUNITIES
        </Link>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10">
            <Users className="h-5 w-5 text-violet-400" />
          </span>
          Create a community
        </h1>
      </header>

      {err && <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">{err}</div>}

      <section className="card-people space-y-4 p-4">
        <div>
          <label className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-zinc-500">NAME</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Late Night Conversations" className={input} />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-zinc-500">DESCRIPTION</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What is this community about? Who is it for?" className={input} />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-zinc-500">CATEGORY</label>
          <div className="flex flex-wrap gap-1.5">
            {COMMUNITY_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.08em] transition ${category === c ? "bg-violet-400 font-bold text-zinc-950" : "border border-zinc-800 text-zinc-400 hover:border-violet-400/40"}`}
              >
                {c.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card-people space-y-3 p-4">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Visibility</h2>
        {COMMUNITY_ACCESS.map((a) => (
          <label key={a.id} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition ${access === a.id ? "border-violet-400/50 bg-violet-400/5" : "border-zinc-800 hover:border-zinc-700"}`}>
            <input type="radio" checked={access === a.id} onChange={() => setAccess(a.id)} className="mt-0.5 accent-violet-400" />
            <span>
              <span className="block text-sm font-semibold text-zinc-200">{a.label}</span>
              <span className="block text-xs text-zinc-500">{a.desc}</span>
            </span>
          </label>
        ))}
        {access === "public" && (
          <label className="flex cursor-pointer items-center gap-2 px-1 text-sm text-zinc-300">
            <input type="checkbox" checked={joinApproval} onChange={(e) => setJoinApproval(e.target.checked)} className="accent-violet-400" />
            Require approval to join
          </label>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-zinc-500">WHO CAN POST</label>
            <select value={whoCanPost} onChange={(e) => setWhoCanPost(e.target.value)} className={input}>
              <option value="members">All members</option>
              <option value="mods">Moderators only</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] tracking-[0.14em] text-zinc-500">WHO CAN INVITE</label>
            <select value={whoCanInvite} onChange={(e) => setWhoCanInvite(e.target.value)} className={input}>
              <option value="mods">Moderators only</option>
              <option value="members">All members</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card-people space-y-3 p-4">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Identity modes allowed</h2>
        <p className="text-xs text-zinc-500">
          You decide how members can appear here. Anonymity is to the community — UpNova always retains the account behind every post
          for moderation and safety.
        </p>
        {IDENTITY_MODES.map((m) => (
          <label key={m.id} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition ${modes.includes(m.id) ? "border-violet-400/50 bg-violet-400/5" : "border-zinc-800 hover:border-zinc-700"}`}>
            <input type="checkbox" checked={modes.includes(m.id)} onChange={() => toggleMode(m.id)} className="mt-0.5 accent-violet-400" />
            <span>
              <span className="block text-sm font-semibold text-zinc-200">{m.label}</span>
              <span className="block text-xs text-zinc-500">{m.desc}</span>
            </span>
          </label>
        ))}
      </section>

      <section className="card-people space-y-3 p-4">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Community rules</h2>
        {rules.map((r, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-zinc-300">
            <span className="font-mono text-[10px] text-zinc-600">{i + 1}.</span>
            <span className="flex-1">{r}</span>
            <button onClick={() => setRules(rules.filter((_, j) => j !== i))} className="text-zinc-600 hover:text-red-400">✕</button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={ruleDraft}
            onChange={(e) => setRuleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ruleDraft.trim()) {
                setRules([...rules, ruleDraft.trim()]);
                setRuleDraft("");
              }
            }}
            placeholder="Add a rule and press Enter"
            className={input}
          />
        </div>
      </section>

      {campus && (
        <section className="card-people p-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" checked={linkCampus} onChange={(e) => setLinkCampus(e.target.checked)} className="mt-0.5 accent-amber-400" />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
                <GraduationCap className="h-4 w-4 text-amber-400" /> Link to {campus.campusName}
              </span>
              <span className="block text-xs text-zinc-500">Only verified {campus.campusName} members will be able to join.</span>
            </span>
          </label>
        </section>
      )}

      <button
        disabled={busy || name.trim().length < 3 || !modes.length}
        onClick={() => void submit()}
        className="w-full rounded-full bg-violet-400 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-violet-300 disabled:opacity-40"
      >
        {busy ? "Creating…" : "Create community"}
      </button>
    </div>
  );
}
