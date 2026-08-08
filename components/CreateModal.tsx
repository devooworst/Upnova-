"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  X,
  Image as ImageIcon,
  Briefcase,
  Sparkles,
  Calendar,
  BarChart2,
  Radio,
  Users,
  Check,
  Plus,
  Trash2,
} from "lucide-react";
import { CREATE_MODAL_EVENT } from "./CreateModalTrigger";
import Avatar from "./Avatar";
import { currentUser } from "@/lib/data";

/* ------------------------------------------------------------------ */
/* The Create system. One rule: each creation type gets its own        */
/* purpose-specific form — UpNova asks only what that type needs.      */
/* Posts are social. Opportunities request people. Services offer      */
/* skills. Polls ask. Events host. Lives broadcast. Shared controls:   */
/* audience/reach, community, tags.                                    */
/* ------------------------------------------------------------------ */

type Kind = "Post" | "Opportunity" | "Service" | "Poll" | "Event" | "Live";

const menu: { group: string; items: { kind: Kind; icon: typeof ImageIcon; title: string; desc: string; tint: string }[] }[] = [
  {
    group: "Share something",
    items: [
      { kind: "Post", icon: ImageIcon, title: "Post", desc: "Share photos, videos, thoughts or updates.", tint: "text-violet-400" },
    ],
  },
  {
    group: "Get work done",
    items: [
      { kind: "Opportunity", icon: Briefcase, title: "Opportunity", desc: "Find people for a project.", tint: "text-lime-400" },
      { kind: "Service", icon: Sparkles, title: "Service", desc: "Offer your skills and get hired.", tint: "text-lime-400" },
    ],
  },
  {
    group: "Engage",
    items: [
      { kind: "Poll", icon: BarChart2, title: "Poll", desc: "Ask your community.", tint: "text-violet-400" },
      { kind: "Event", icon: Calendar, title: "Event", desc: "Create something people can attend.", tint: "text-amber-400" },
      { kind: "Live", icon: Radio, title: "Live", desc: "Go live with your audience.", tint: "text-red-400" },
    ],
  },
];

const audiences = ["Near Me", "My City", "My State", "Nationwide", "Global", "Followers", "Community"];
const label = "font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500";

function Chips({ options, value, onChange, accent = "white" }: { options: string[]; value: string; onChange: (v: string) => void; accent?: "white" | "lime" | "violet" | "amber" }) {
  const activeCls = {
    white: "border-white/50 bg-white/10 text-zinc-100",
    lime: "border-lime-400/60 bg-lime-400/10 text-lime-300",
    violet: "border-violet-400/60 bg-violet-400/10 text-violet-300",
    amber: "border-amber-400/60 bg-amber-400/10 text-amber-300",
  }[accent];
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
            value === o ? activeCls : "border-line text-zinc-400 hover:border-zinc-600"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export default function CreateModal() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);
  const [published, setPublished] = useState(false);

  /* post */
  const [postText, setPostText] = useState("");
  const [postType, setPostType] = useState("Normal post");
  const [audience, setAudience] = useState("Near Me");
  const [community, setCommunity] = useState("None");
  const [tags, setTags] = useState<string[]>([]);

  /* opportunity */
  const [oppTitle, setOppTitle] = useState("");
  const [oppType, setOppType] = useState("Gig");
  const [roles, setRoles] = useState([{ role: "Videographer", count: 1 }]);
  const [payType, setPayType] = useState("Paid");
  const [budget, setBudget] = useState("");
  const [payStructure, setPayStructure] = useState("Fixed payment");
  const [oppNeeds, setOppNeeds] = useState<string[]>(["Portfolio"]);
  const [respond, setRespond] = useState("Apply");

  /* service */
  const [svcName, setSvcName] = useState("");
  const [svcCategory, setSvcCategory] = useState("Music");
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [priceModel, setPriceModel] = useState("Starting at");
  const [svcPrice, setSvcPrice] = useState("");
  const [availability, setAvailability] = useState("Accepting clients");
  const [originalWork, setOriginalWork] = useState(true);
  const [svcType, setSvcType] = useState("Creative");
  const [highTrustDone, setHighTrustDone] = useState(false);

  /* poll */
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState("3 days");
  const [voters, setVoters] = useState("Everyone");
  const [ownOptions, setOwnOptions] = useState(false);
  const [showResults, setShowResults] = useState("After voting");

  /* live */
  const [liveTitle, setLiveTitle] = useState("");
  const [liveCategory, setLiveCategory] = useState("Music");
  const [liveChat, setLiveChat] = useState(true);
  const [liveReactions, setLiveReactions] = useState(true);

  useEffect(() => {
    const handler = (e: Event) => {
      const k = (e as CustomEvent).detail as Kind | undefined;
      setKind(k ?? null);
      setPublished(false);
      setOpen(true);
    };
    window.addEventListener(CREATE_MODAL_EVENT, handler);
    return () => window.removeEventListener(CREATE_MODAL_EVENT, handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  const reset = () => {
    setOpen(false);
    setKind(null);
    setPublished(false);
  };

  const toggleIn = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={reset} />
      <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-card p-5 shadow-card animate-fade-up sm:max-w-lg sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-zinc-50">
            {published ? "Published" : kind ? (kind === "Live" ? "Go Live" : `Create ${kind}`) : "Create"}
          </h2>
          <div className="flex items-center gap-1">
            {kind && !published && (
              <button onClick={() => setKind(null)} className="text-xs text-zinc-500 hover:text-zinc-300">
                ← All types
              </button>
            )}
            <button onClick={reset} className="icon-btn -mr-2" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ================= menu ================= */}
        {!kind && (
          <div className="space-y-4">
            {menu.map((g) => (
              <div key={g.group}>
                <p className={label}>{g.group}</p>
                <div className="mt-1.5 space-y-1">
                  {g.items.map((item) => (
                    <button
                      key={item.kind}
                      onClick={() => setKind(item.kind)}
                      className="flex w-full items-start gap-3 rounded-xl border border-line p-3 text-left transition hover:border-zinc-600 hover:bg-card-raised"
                    >
                      <item.icon className={`mt-0.5 h-5 w-5 shrink-0 ${item.tint}`} />
                      <span>
                        <span className="block text-sm font-semibold text-zinc-100">{item.title}</span>
                        <span className="block text-xs text-zinc-500">{item.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <Link
              href="/communities/create"
              onClick={reset}
              className="flex items-center gap-2.5 rounded-xl border border-dashed border-line px-3 py-2.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300"
            >
              <Users className="h-4 w-4" /> Building a Community? That gets its own setup wizard →
            </Link>
          </div>
        )}

        {/* ================= published ================= */}
        {kind && published && (
          <div className="py-2 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lime-400/15">
              <Check className="h-6 w-6 text-lime-400" />
            </span>
            <p className="mt-3 text-sm font-semibold text-zinc-100">
              {kind === "Live" ? "🔴 You're live" : `Your ${kind.toLowerCase()} is live`}
            </p>
            {/* what appears on the feed — type DNA preview */}
            <div className="mx-auto mt-4 max-w-sm text-left">
              {kind === "Post" && (
                <div className="card-people p-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar src={currentUser.avatar} initials="D" size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{currentUser.name}</p>
                      <p className="text-[10px] text-zinc-500">{postType !== "Normal post" && `${postType} · `}{audience}</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-sm text-zinc-300">{postText || "Your post"}</p>
                </div>
              )}
              {kind === "Opportunity" && (
                <div className="card-money p-4">
                  <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-lime-400">
                    {payType === "Paid" ? "🟢 paid opportunity" : payType}
                  </p>
                  <p className="mt-1 text-base font-bold text-zinc-50">{oppTitle || "Your opportunity"}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Looking for: {roles.map((r) => `${r.count} ${r.role}`).join(" + ")}
                  </p>
                  <p className="mt-1.5 text-lg font-extrabold tabular-nums tracking-tight text-lime-400">
                    {budget ? `$${budget}` : payType}
                  </p>
                </div>
              )}
              {kind === "Service" && (
                <div className="card-people p-4">
                  <p className="text-base font-bold text-zinc-50">{svcName || "Your service"}</p>
                  <p className="text-xs text-zinc-500">by {currentUser.name} ✓ · {svcCategory}</p>
                  <p className="mt-1.5 text-sm text-zinc-400">
                    {priceModel} <span className="text-base font-extrabold tabular-nums text-lime-400">${svcPrice || "—"}</span>
                    <span className="ml-2 text-[11px] text-lime-300">🟢 {availability}</span>
                  </p>
                </div>
              )}
              {kind === "Poll" && (
                <div className="card-people p-4">
                  <p className="text-sm font-semibold text-zinc-100">{question || "Your question"}</p>
                  {options.filter(Boolean).map((o) => (
                    <div key={o} className="mt-1.5 rounded-lg border border-violet-400/30 px-3 py-1.5 text-xs text-zinc-300">{o}</div>
                  ))}
                  <p className="mt-2 text-[10px] text-zinc-500">Runs {duration.toLowerCase()} · {voters} can vote</p>
                </div>
              )}
              {kind === "Live" && (
                <div className="card-people border-red-500/40 p-4">
                  <p className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-red-400">
                    <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-red-500" /> live now
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-100">{liveTitle || "Your stream"}</p>
                  <p className="text-xs text-zinc-500">{liveCategory} · 1 watching</p>
                </div>
              )}
            </div>
            <button onClick={reset} className="btn-lime mt-5 rounded-md px-8 py-2 text-sm">Done</button>
          </div>
        )}

        {/* ================= POST — the social side ================= */}
        {kind === "Post" && !published && (
          <div className="space-y-4">
            <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-6 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300">
              <Plus className="h-4 w-4" /> Add photos or video
            </button>
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={3}
              placeholder="What's happening?"
              className="input-dark resize-none"
              autoFocus
            />
            <div>
              <p className={label}>Post type</p>
              <Chips
                options={["Normal post", "Looking to Collaborate", "Looking for Work", "Announcement", "Campus", "Creative Work"]}
                value={postType}
                onChange={setPostType}
                accent="violet"
              />
            </div>
            <div>
              <p className={label}>Who can see this?</p>
              <Chips options={audiences} value={audience} onChange={setAudience} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <p className={label}>Add to community</p>
                <select value={community} onChange={(e) => setCommunity(e.target.value)} className="input-dark mt-1.5">
                  <option>None</option>
                  <option>DMV Creators</option>
                  <option>Music Producers</option>
                  <option>Photographers</option>
                </select>
              </div>
              <div className="flex-1">
                <p className={label}>Tags</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {["Music", "Photography", "Fashion", "Video"].map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleIn(tags, setTags, t)}
                      className={`rounded-full border px-2 py-1 text-[11px] transition ${
                        tags.includes(t) ? "border-violet-400/60 bg-violet-400/10 text-violet-300" : "border-line text-zinc-500"
                      }`}
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => setPublished(true)}
              disabled={!postText.trim()}
              className={`w-full rounded-full py-2.5 text-sm font-bold transition ${postText.trim() ? "bg-violet-400 text-zinc-950 hover:bg-violet-300" : "cursor-not-allowed bg-card-raised text-zinc-600"}`}
            >
              Publish
            </button>
          </div>
        )}

        {/* ================= OPPORTUNITY — a project listing builder ================= */}
        {kind === "Opportunity" && !published && (
          <div className="space-y-4">
            <div>
              <p className={label}>1 · What are you looking for?</p>
              <input value={oppTitle} onChange={(e) => setOppTitle(e.target.value)} placeholder="Nike Fall Campaign" className="input-dark mt-1.5" autoFocus />
              <Chips
                options={["Brand Collaboration", "Freelance", "Gig", "Creative Project", "Casting", "Event Work", "Internship", "Other"]}
                value={oppType}
                onChange={setOppType}
                accent="lime"
              />
            </div>

            <div>
              <p className={label}>2 · Who are you looking for?</p>
              <div className="mt-1.5 space-y-1.5">
                {roles.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={r.role}
                      onChange={(e) => setRoles(roles.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}
                      placeholder="Videographer"
                      className="input-dark flex-1"
                    />
                    <input
                      value={r.count}
                      onChange={(e) => setRoles(roles.map((x, j) => (j === i ? { ...x, count: Number(e.target.value.replace(/\D/g, "")) || 1 } : x)))}
                      className="input-dark w-14 text-center tabular-nums"
                      aria-label="How many"
                    />
                    {roles.length > 1 && (
                      <button onClick={() => setRoles(roles.filter((_, j) => j !== i))} className="icon-btn h-8 w-8" aria-label="Remove role">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={() => setRoles([...roles, { role: "", count: 1 }])} className="text-xs font-semibold text-lime-400 hover:text-lime-300">
                  + Add role
                </button>
              </div>
            </div>

            <div>
              <p className={label}>3 · Payment</p>
              <Chips options={["Paid", "Unpaid / Collaboration", "Negotiable", "Revenue / Royalty split"]} value={payType} onChange={setPayType} accent="lime" />
              {payType === "Paid" && (
                <div className="mt-2 flex gap-2">
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
                    <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} placeholder="2400" inputMode="numeric" className="input-dark pl-7 tabular-nums" />
                  </div>
                  <select value={payStructure} onChange={(e) => setPayStructure(e.target.value)} className="input-dark flex-1">
                    <option>Fixed payment</option>
                    <option>Hourly</option>
                    <option>Per deliverable</option>
                    <option>Milestone payments</option>
                    <option>Royalty split</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <p className={label}>4 · Project details</p>
              <textarea rows={2} placeholder="Describe the project and what they'll be doing…" className="input-dark mt-1.5 resize-none" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Portfolio", "Experience", "Equipment", "Transportation", "Age requirement"].map((n) => (
                  <button
                    key={n}
                    onClick={() => toggleIn(oppNeeds, setOppNeeds, n)}
                    className={`rounded-full border px-2 py-1 text-[11px] transition ${oppNeeds.includes(n) ? "border-lime-400/60 bg-lime-400/10 text-lime-300" : "border-line text-zinc-500"}`}
                  >
                    {oppNeeds.includes(n) ? "✓ " : "+ "}{n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <p className={label}>5 · Where &amp; who sees it</p>
                <select className="input-dark mt-1.5">
                  <option>Baltimore</option>
                  <option>Remote</option>
                  <option>Multiple locations</option>
                </select>
                <select className="input-dark mt-1.5">
                  <option>25 miles</option>
                  <option>5 miles</option>
                  <option>City</option>
                  <option>State</option>
                  <option>Nationwide</option>
                  <option>Global / Remote</option>
                </select>
              </div>
              <div className="flex-1">
                <p className={label}>6 · Deadlines</p>
                <input placeholder="Apply by · Aug 18" className="input-dark mt-1.5" />
                <input placeholder="Project date · Sep 5–7" className="input-dark mt-1.5" />
              </div>
            </div>

            <div>
              <p className={label}>7 · How should people respond?</p>
              <Chips options={["Apply", "Message first", "Apply + portfolio", "Invite only"]} value={respond} onChange={setRespond} accent="lime" />
            </div>

            <button
              onClick={() => setPublished(true)}
              disabled={!oppTitle.trim()}
              className={`w-full rounded-md py-2.5 text-sm font-bold transition ${oppTitle.trim() ? "bg-lime-400 text-zinc-950 hover:bg-lime-300 hover:shadow-glow" : "cursor-not-allowed bg-card-raised text-zinc-600"}`}
            >
              Publish Opportunity
            </button>
          </div>
        )}

        {/* ================= SERVICE — a professional listing ================= */}
        {kind === "Service" && !published && (
          <div className="space-y-4">
            <div>
              <p className={label}>What are you offering?</p>
              <input value={svcName} onChange={(e) => setSvcName(e.target.value)} placeholder="Music Production" className="input-dark mt-1.5" autoFocus />
              <Chips
                options={["Music", "Photography", "Video", "Design", "Fashion", "Beauty", "Writing", "Technology", "Business", "Other"]}
                value={svcCategory}
                onChange={setSvcCategory}
                accent="lime"
              />
            </div>
            <textarea rows={2} placeholder="Describe your service — what clients get and how you work…" className="input-dark resize-none" />
            <div>
              <p className={label}>What type of service is this?</p>
              <Chips
                options={["Creative", "In-person", "Home access", "Childcare", "Pet care", "Transportation", "Personal assistance", "Other"]}
                value={svcType}
                onChange={setSvcType}
                accent="lime"
              />
              {(() => {
                const level = ["Childcare", "Pet care", "Home access", "Transportation", "Personal assistance"].includes(svcType)
                  ? "High-Trust"
                  : svcType === "In-person"
                  ? "Identity Verified"
                  : "Standard";
                return (
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Verification required:{" "}
                    <span className={`font-semibold ${level === "High-Trust" ? "text-red-300" : level === "Identity Verified" ? "text-amber-300" : "text-zinc-300"}`}>
                      {level}
                    </span>
                    {svcType === "Childcare" && <span className="text-zinc-600"> + applicable additional screening</span>}
                  </p>
                );
              })()}
            </div>
            <div>
              <p className={label}>What do you deliver?</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {["Beat", "Mixing", "Mastering", "Recording", "Revisions", "Edited gallery", "Source files"].map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleIn(deliverables, setDeliverables, d)}
                    className={`rounded-full border px-2 py-1 text-[11px] transition ${deliverables.includes(d) ? "border-lime-400/60 bg-lime-400/10 text-lime-300" : "border-line text-zinc-500"}`}
                  >
                    {deliverables.includes(d) ? "☑ " : "☐ "}{d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <p className={label}>Pricing</p>
                <select value={priceModel} onChange={(e) => setPriceModel(e.target.value)} className="input-dark mt-1.5">
                  <option>Starting at</option>
                  <option>Fixed price</option>
                  <option>Hourly</option>
                  <option>Custom quote</option>
                </select>
              </div>
              <div className="w-28">
                <p className={label}>&nbsp;</p>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
                  <input value={svcPrice} onChange={(e) => setSvcPrice(e.target.value.replace(/\D/g, ""))} placeholder="300" inputMode="numeric" className="input-dark pl-7 tabular-nums" />
                </div>
              </div>
              <div className="flex-1">
                <p className={label}>Turnaround</p>
                <input placeholder="3–5 days" className="input-dark mt-1.5" />
              </div>
            </div>
            <div>
              <p className={label}>Availability &amp; reach</p>
              <Chips options={["Accepting clients", "Available this week", "Currently booked", "Not accepting"]} value={availability} onChange={setAvailability} accent="lime" />
              <select className="input-dark mt-2">
                <option>Nationwide / Remote</option>
                <option>Nearby (5 mi)</option>
                <option>25 miles</option>
                <option>City</option>
                <option>State</option>
                <option>Global</option>
              </select>
            </div>
            <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-4 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300">
              <Plus className="h-3.5 w-3.5" /> Attach portfolio examples — photos, video, audio, past projects
            </button>
            <label className="flex cursor-pointer items-center justify-between rounded-md border border-line bg-card-raised px-3 py-2.5 text-sm text-zinc-300">
              <span>🔴 Original work — no undisclosed generative AI</span>
              <input type="checkbox" checked={originalWork} onChange={(e) => setOriginalWork(e.target.checked)} className="accent-lime-400" />
            </label>
            {["Childcare", "Pet care", "Home access", "Transportation", "Personal assistance"].includes(svcType) && !highTrustDone ? (
              <div className="rounded-md border border-red-400/30 bg-red-500/5 p-3.5">
                <p className="text-sm font-semibold text-zinc-100">❌ Cannot publish yet</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  {svcType} requires High-Trust Verification — identity, age, and background
                  screening where legally permitted. Complete verification to offer this service.
                </p>
                <button
                  onClick={() => setHighTrustDone(true)}
                  className="mt-2.5 w-full rounded-md bg-lime-400 py-2 text-xs font-bold text-zinc-950 transition hover:bg-lime-300"
                >
                  Complete Verification
                </button>
              </div>
            ) : (
              <>
                {highTrustDone && ["Childcare", "Pet care", "Home access", "Transportation", "Personal assistance"].includes(svcType) && (
                  <p className="rounded-md border border-lime-400/30 bg-lime-400/5 px-3 py-2 text-xs text-lime-300">
                    ✓ Eligible to offer {svcType.toLowerCase()} services
                  </p>
                )}
                <button
                  onClick={() => setPublished(true)}
                  disabled={!svcName.trim()}
                  className={`w-full rounded-md py-2.5 text-sm font-bold transition ${svcName.trim() ? "bg-lime-400 text-zinc-950 hover:bg-lime-300 hover:shadow-glow" : "cursor-not-allowed bg-card-raised text-zinc-600"}`}
                >
                  Publish Service
                </button>
              </>
            )}
          </div>
        )}

        {/* ================= POLL — actually useful ================= */}
        {kind === "Poll" && !published && (
          <div className="space-y-4">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What type of content should I make next?" className="input-dark" autoFocus />
            <div className="space-y-1.5">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={o}
                    onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={`Option ${i + 1}`}
                    className="input-dark flex-1"
                  />
                  {options.length > 2 && (
                    <button onClick={() => setOptions(options.filter((_, j) => j !== i))} className="icon-btn h-8 w-8" aria-label="Remove option">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <button onClick={() => setOptions([...options, ""])} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
                  + Add option
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <p className={label}>Runs for</p>
                <Chips options={["1 day", "3 days", "7 days"]} value={duration} onChange={setDuration} accent="violet" />
              </div>
            </div>
            <div>
              <p className={label}>Who can vote?</p>
              <Chips options={["Everyone", "Followers", "Community", "Nearby", "Campus"]} value={voters} onChange={setVoters} accent="violet" />
            </div>
            <div className="flex gap-3">
              <label className="flex flex-1 cursor-pointer items-center justify-between rounded-md border border-line bg-card-raised px-3 py-2 text-xs text-zinc-300">
                People can add options
                <input type="checkbox" checked={ownOptions} onChange={(e) => setOwnOptions(e.target.checked)} className="accent-violet-400" />
              </label>
              <select value={showResults} onChange={(e) => setShowResults(e.target.value)} className="input-dark flex-1 text-xs">
                <option>After voting</option>
                <option>After poll ends</option>
                <option>Always</option>
              </select>
            </div>
            <button
              onClick={() => setPublished(true)}
              disabled={!question.trim() || options.filter(Boolean).length < 2}
              className={`w-full rounded-full py-2.5 text-sm font-bold transition ${question.trim() && options.filter(Boolean).length >= 2 ? "bg-violet-400 text-zinc-950 hover:bg-violet-300" : "cursor-not-allowed bg-card-raised text-zinc-600"}`}
            >
              Publish Poll
            </button>
          </div>
        )}

        {/* ================= EVENT — gets the full setup ================= */}
        {kind === "Event" && !published && (
          <div className="py-2 text-center">
            <Calendar className="mx-auto h-10 w-10 text-amber-400" />
            <p className="mt-3 text-sm font-semibold text-zinc-100">Events get the full setup</p>
            <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-zinc-500">
              Events are real-world experiences — admission, age requirements, capacity, tickets,
              rules, and QR check-in. That deserves more than a popup.
            </p>
            <Link
              href="/events/create"
              onClick={reset}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-amber-300 hover:shadow-glow-amber"
            >
              Open Event Setup →
            </Link>
          </div>
        )}

        {/* ================= LIVE — "I'm going live right now" ================= */}
        {kind === "Live" && !published && (
          <div className="space-y-4">
            <input value={liveTitle} onChange={(e) => setLiveTitle(e.target.value)} placeholder="Making a beat from scratch 🎹" className="input-dark" autoFocus />
            <div>
              <p className={label}>Category</p>
              <Chips
                options={["Music", "Gaming", "Fashion", "Fitness", "Education", "Behind the Scenes", "Conversation", "Other"]}
                value={liveCategory}
                onChange={setLiveCategory}
                accent="white"
              />
            </div>
            <div>
              <p className={label}>Who can watch?</p>
              <Chips options={["Everyone", "Followers", "Community", "Nearby", "Campus"]} value={audience} onChange={setAudience} />
            </div>
            <div className="flex gap-2">
              <label className="flex flex-1 cursor-pointer items-center justify-between rounded-md border border-line bg-card-raised px-3 py-2 text-xs text-zinc-300">
                Enable chat
                <input type="checkbox" checked={liveChat} onChange={(e) => setLiveChat(e.target.checked)} className="accent-red-400" />
              </label>
              <label className="flex flex-1 cursor-pointer items-center justify-between rounded-md border border-line bg-card-raised px-3 py-2 text-xs text-zinc-300">
                Allow reactions
                <input type="checkbox" checked={liveReactions} onChange={(e) => setLiveReactions(e.target.checked)} className="accent-red-400" />
              </label>
            </div>
            <p className="text-[10px] text-zinc-600">Gifts/tips come later with creator monetization.</p>
            <button
              onClick={() => setPublished(true)}
              disabled={!liveTitle.trim()}
              className={`w-full rounded-full py-2.5 text-sm font-bold transition ${liveTitle.trim() ? "bg-red-500 text-white hover:bg-red-400" : "cursor-not-allowed bg-card-raised text-zinc-600"}`}
            >
              🔴 Go Live
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
