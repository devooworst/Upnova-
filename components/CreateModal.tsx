"use client";

import { useEffect, useState } from "react";
import GoLiveFlow from "@/components/GoLiveFlow";
import Link from "next/link";
import {
  Tag,
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

import { useSession } from "@/lib/session";
import { promptJoin } from "./GuestGate";

/* ------------------------------------------------------------------ */
/* The Create system. One rule: each creation type gets its own        */
/* purpose-specific form — Mavyn asks only what that type needs.      */
/* Posts are social. Opportunities request people. Services offer      */
/* skills. Polls ask. Events host. Lives broadcast. Shared controls:   */
/* audience/reach, community, tags.                                    */
/* ------------------------------------------------------------------ */

type Kind = "Post" | "Opportunity" | "Service" | "Poll" | "Event" | "Live" | "Product" | "__community__";

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
      { kind: "Product", icon: Tag, title: "Product", desc: "Sell something — shipped, picked up, or digital.", tint: "text-lime-400" },
    ],
  },
  {
    group: "Engage",
    items: [
      { kind: "Poll", icon: BarChart2, title: "Poll", desc: "Ask your community.", tint: "text-violet-400" },
      { kind: "Event", icon: Calendar, title: "Event", desc: "Create something people can attend.", tint: "text-amber-400" },
      { kind: "Live", icon: Radio, title: "Live", desc: "Go live with your audience.", tint: "text-red-400" },
      { kind: "__community__", icon: Users, title: "Community", desc: "Start a space for your people.", tint: "text-violet-300" },
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
  const { user: sessionUser } = useSession();

  // no guest creation, ever — if a guest reaches this modal through any
  // path, convert the attempt into the contextual join prompt. (The APIs
  // behind every kind require a session regardless.)
  useEffect(() => {
    if (open && sessionUser === null) {
      setOpen(false);
      promptJoin("create");
    }
  }, [open, sessionUser]);

  /* post */
  const [postText, setPostText] = useState("");
  const [postType, setPostType] = useState("Normal post");
  const [audience, setAudience] = useState("Near Me");
  const [community, setCommunity] = useState("None");
  const [tags, setTags] = useState<string[]>([]);

  /* opportunity */
  const [oppTitle] = useState("");
  const [roles] = useState([{ role: "Videographer", count: 1 }]);
  const [payType] = useState("Paid");
  const [budget] = useState("");

  /* service */
  const [svcName] = useState("");
  const [svcCategory] = useState("Music");
  const [priceModel] = useState("Starting at");
  const [svcPrice] = useState("");
  const [availability] = useState("Accepting clients");

  /* poll */
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState("3 days");
  const [voters, setVoters] = useState("Everyone");
  const [ownOptions, setOwnOptions] = useState(false);
  const [showResults, setShowResults] = useState("After voting");

  /* live */
  const [liveTitle] = useState("");
  const [liveCategory] = useState("Music");

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
                      onClick={() => {
                        if ((item.kind as string) === "__community__") {
                          window.location.href = "/communities/create";
                          return;
                        }
                        setKind(item.kind);
                      }}
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
              {kind === "Live" ? "You're live" : `Your ${kind.toLowerCase()} is live`}
            </p>
            {/* what appears on the feed — type DNA preview */}
            <div className="mx-auto mt-4 max-w-sm text-left">
              {kind === "Post" && (
                <div className="card-people p-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      src={sessionUser?.profile.avatarUrl ?? null}
                      initials={(sessionUser?.profile.displayName || "?").charAt(0)}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{sessionUser?.profile.displayName ?? "You"}</p>
                      <p className="text-[10px] text-zinc-500">{postType !== "Normal post" && `${postType} · `}{audience}</p>
                    </div>
                  </div>
                  <p className="mt-2.5 text-sm text-zinc-300">{postText || "Your post"}</p>
                </div>
              )}
              {kind === "Opportunity" && (
                <div className="card-money p-4">
                  <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-lime-400">
                    {payType === "Paid" ? "paid opportunity" : payType}
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
                  <p className="text-xs text-zinc-500">by {sessionUser?.profile.displayName ?? "You"} ✓ · {svcCategory}</p>
                  <p className="mt-1.5 text-sm text-zinc-400">
                    {priceModel} <span className="text-base font-extrabold tabular-nums text-lime-400">${svcPrice || "—"}</span>
                    <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-lime-300"><span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> {availability}</span>
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
          <div className="space-y-3 px-5 py-6 text-center">
            <p className="text-sm font-semibold text-zinc-100">Opportunities get the full form</p>
            <p className="mx-auto max-w-sm text-xs leading-relaxed text-zinc-500">
              Budget, dates, and what applicants must provide — you decide the requirements.
            </p>
            <a href="/opportunities/new" className="btn-lime inline-flex px-5 py-2 text-sm">
              Post an opportunity
            </a>
          </div>
        )}

        {kind === "Service" && !published && (
          <div className="space-y-3 px-5 py-6 text-center">
            <p className="text-sm font-semibold text-zinc-100">Services get the full builder</p>
            <p className="mx-auto max-w-sm text-xs leading-relaxed text-zinc-500">
              What you offer, how it&apos;s fulfilled, availability, travel, pricing, and your
              policies — set once, and Mavyn builds the booking experience from your rules.
            </p>
            <a href="/services/new" className="btn-lime inline-flex px-5 py-2 text-sm">
              Open the service builder
            </a>
          </div>
        )}

        {kind === "Product" && !published && (
          <div className="space-y-3 px-5 py-6 text-center">
            <p className="text-sm font-semibold text-zinc-100">Products get the full builder</p>
            <p className="mx-auto max-w-sm text-xs leading-relaxed text-zinc-500">
              Photos, price, quantity, variants, and fulfillment — sell through Mavyn checkout
              (funds held until delivery) or link to your own store, clearly disclosed.
            </p>
            <a href="/shop/new" className="btn-lime inline-flex px-5 py-2 text-sm">
              Open the product builder
            </a>
          </div>
        )}

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
          /* the REAL Go Live flow — one shared component with the Live
             page; creates an actual stream and routes to /live/[id] */
          <GoLiveFlow onClose={() => setOpen(false)} />
        )}
      </div>
    </div>
  );
}
