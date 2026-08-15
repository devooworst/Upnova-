"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Lock,
  MessageSquare,
  Paperclip,
  Search,
  Send,
  Star,
  Users,
  Zap,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import OpportunityCard from "@/components/OpportunityCard";
import { useSession, invalidateSession } from "@/lib/session";
import { creators, campusOrgs } from "@/lib/data";

/* ------------------------------------------------------------------ */
/* Your Campus — NOT one giant collection of group chats.              */
/* Four layers, separated on purpose:                                  */
/*   💬 Communities   — interest-based conversation                    */
/*   🛍️ Services      — discover students who offer services          */
/*   💰 Opportunities — paid work, gigs, collaborations                */
/*   🏛️ Organizations — verified orgs with their own pages            */
/* plus Events and Campus Questions. Everything connects to the        */
/* existing Follow / Profile / Services / Opportunities / Messaging /  */
/* Booking / Payment systems.                                          */
/* ------------------------------------------------------------------ */

/* FOUR doors, not eight — one tile row: Marketplace (a real link) plus
   three sections. Campus Services lives inside Opportunities (same
   money system); Student Groups, Organizations and Campus Questions
   are CHANNEL CATEGORIES inside Communities (exactly like Study Talk
   and Late Night Conversations) — nothing was removed, only the
   competing navigation. */
const sections = [
  { id: "communities", label: "Communities", desc: "Chats · groups · orgs · questions" },
  { id: "opps", label: "Opportunities", desc: "Gigs, collabs & student services" },
  { id: "events", label: "Events", desc: "What's happening on campus" },
] as const;
type SectionId = (typeof sections)[number]["id"];

/* channel categories folded into Communities — selecting one swaps the
   chat pane for that content, inside the same panel */
const CAMPUS_LIFE_CHANNELS = [
  { id: "#groups", name: "Student Groups" },
  { id: "#orgs", name: "Organizations" },
  { id: "#questions", name: "Campus Questions" },
] as const;

/* ---- 💬 interest communities: for talking, not selling ---- */
const interestCommunities = [
  { id: "general", emoji: "💬", name: "General Campus", members: 1284 },
  { id: "fashion", emoji: "👗", name: "Fashion & Streetwear", members: 412 },
  { id: "gaming", emoji: "🎮", name: "Gaming", members: 366 },
  { id: "anime", emoji: "🍿", name: "Anime & TV", members: 298 },
  { id: "musicfans", emoji: "🎵", name: "Music Fans", members: 521 },
  { id: "art", emoji: "🎨", name: "Art Lovers", members: 187 },
  { id: "tech", emoji: "💻", name: "Tech & Nerd Stuff", members: 243 },
  { id: "sports", emoji: "🏀", name: "Sports", members: 350 },
  { id: "study", emoji: "📚", name: "Study Talk", members: 402 },
  { id: "memes", emoji: "😂", name: "Campus Memes", members: 876 },
  { id: "latenight", emoji: "🌙", name: "Late Night Conversations", members: 231 },
];

interface ChatMsg {
  author: string;
  initials: string;
  gradient: string;
  avatar?: string | null;
  time: string;
  text: string;
  creatorCard?: string;
}

const communityChats: Record<string, ChatMsg[]> = {
  general: [
    { author: "Maya R.", initials: "M", gradient: "from-rose-500 to-pink-600", time: "2:14 PM", text: "Does anybody know somebody who does nails on campus? 💅" },
    { author: "Toni A.", initials: "T", gradient: "from-amber-500 to-orange-600", time: "2:16 PM", text: "Yeah! @Ava does nails between shoots. Here's her profile 👇", creatorCard: "ava" },
    { author: "Maya R.", initials: "M", gradient: "from-rose-500 to-pink-600", time: "2:19 PM", text: "Just booked her for Friday. This app is dangerous 😭" },
  ],
  fashion: [
    { author: "Sasha G.", initials: "S", gradient: "from-violet-500 to-fuchsia-600", time: "11:03 AM", text: "What's everybody wearing this semester? I need the fits report before syllabus week 👀" },
    { author: "Nia C.", initials: "N", gradient: "from-rose-500 to-pink-600", time: "11:20 AM", text: "Thrifted everything. Drop day for my capsule is Sep 5 — details in the Fashion Club org page." },
  ],
  latenight: [
    { author: "Devon P.", initials: "D", gradient: "from-sky-500 to-indigo-600", time: "1:12 AM", text: "media lab crew — who's still up? beat session in 20." },
  ],
  study: [
    { author: "Toni A.", initials: "T", gradient: "from-amber-500 to-orange-600", time: "9:15 AM", text: "Study group for stats midterm, library room 204, Thursday 6pm. All welcome." },
  ],
};

/* ---- 🛍️ campus services: a directory, not a chat ---- */
const lookingFor = ["Hair", "Nails", "Photography", "Editing", "Tutoring", "Design", "Music", "Other"];

const campusServices = [
  { id: "cs-ava", creatorId: "ava", name: "Ava Chen", service: "Braiding & Silk Press", category: "Hair", startingAt: 65, rating: 4.9, verified: true, spot: "On campus" },
  { id: "cs-maya", name: "Maya Reyes", initials: "M", gradient: "from-rose-500 to-pink-600", service: "Nail Sets & Designs", category: "Nails", startingAt: 40, rating: 4.8, verified: true, spot: "Towers Hall" },
  { id: "cs-toni", name: "Toni Alvarez", initials: "T", gradient: "from-amber-500 to-orange-600", service: "Portraits & Event Photography", category: "Photography", startingAt: 50, rating: 4.7, verified: true, spot: "On campus" },
  { id: "cs-devon", name: "Devon Price", initials: "D", gradient: "from-sky-500 to-indigo-600", service: "Video Editing & Reels", category: "Editing", startingAt: 35, rating: 4.6, verified: true, spot: "Remote / campus" },
  { id: "cs-sasha", name: "Sasha Green", initials: "S", gradient: "from-violet-500 to-fuchsia-600", service: "Stats & Math Tutoring", category: "Tutoring", startingAt: 20, rating: 5.0, verified: true, spot: "Library" },
  { id: "cs-kb", name: "K. Boateng", initials: "K", gradient: "from-emerald-500 to-teal-600", service: "Beats & Mixing", category: "Music", startingAt: 45, rating: 4.7, verified: true, spot: "Media building" },
];

const campusOppIds = ["org-promo", "campus-web", "campus-mv-collab", "social-video"];

export default function CampusPage() {
  // campus access is a database fact: a verified campus_verifications row
  const { user } = useSession();
  // DEMO MODE (tester switch, top-left): gate opens for testing; the real
  // verification fact is still shown honestly. SIMULATION MODE enforces.
  const demoUnrestricted = !!user && user.testerMode !== "simulation";
  const verified = !!user?.campus || demoUnrestricted;
  const [section, setSection] = useState<SectionId>("communities");
  const [community, setCommunity] = useState("general");
  const [svcFilter, setSvcFilter] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [affiliation, setAffiliation] = useState("current_student");
  const [vGradYear, setVGradYear] = useState("");
  const [vProgram, setVProgram] = useState("");
  /* Verification NEVER touches the auth session. Any failure — including
     a 401 — stays on this page as an inline message; we never redirect,
     never clear credentials. Success soft-refreshes the session so
     user.campus arrives and the page (and sidebar) unlock in place. */
  const verifyCollege = async () => {
    setVerifyBusy(true);
    setVerifyError("");
    try {
      const res = await fetch("/api/campus/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliation, gradYear: vGradYear, program: vProgram }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (res.status === 401) {
        setVerifyError("We couldn't confirm your session for this request. You have not been signed out — refresh the page and try again.");
        return;
      }
      if (!res.ok) {
        setVerifyError(data?.error || "Verification failed — please try again.");
        return;
      }
      invalidateSession();
    } catch {
      setVerifyError("Network error — please try again.");
    } finally {
      setVerifyBusy(false);
    }
  };
  const graduate = async () => {
    if (!window.confirm("Switch your status to Alumni? Everything you built stays — connections, messages, portfolio, history. Student-only areas (Marketplace, Student Groups) close; the alumni environment opens.")) return;
    await fetch("/api/campus/verify", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "graduate" }) });
    invalidateSession();
  };

  const ava = creators.find((c) => c.id === "ava")!;
  const services = campusServices.filter((s) => !svcFilter || s.category === svcFilter);
  const chat = communityChats[community] ?? [];
  const specialChannel = CAMPUS_LIFE_CHANNELS.find((c) => c.id === community) ?? null;
  const activeCommunity =
    interestCommunities.find((c) => c.id === community) ?? interestCommunities[0];

  /* ---------------- locked: free verification first ---------------- */
  // session still being checked — decide NOTHING yet (no locked-state flash)
  if (user === undefined) {
    return (
      <div className="mx-auto max-w-md pt-12 text-center" aria-busy="true">
        <div className="mx-auto h-16 w-16 animate-pulse rounded-2xl bg-card-raised" />
        <div className="mx-auto mt-4 h-5 w-48 animate-pulse rounded bg-card-raised" />
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="mx-auto max-w-md pt-12 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-400/10">
          <Lock className="h-7 w-7 text-violet-400" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">
          Your campus network is waiting
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
          Your Campus is a private, verified environment. Prove your school affiliation once —
          student, alumni, or faculty — and it unlocks. No plan, Free or Pro, can buy its way in.
        </p>
        <div className="mx-auto mt-5 max-w-sm space-y-2 text-left">
          {[
            { id: "current_student", label: "Current Student" },
            { id: "alumni", label: "Alumni" },
            { id: "faculty_staff", label: "Faculty / Staff" },
          ].map((a) => (
            <label key={a.id} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-sm transition ${affiliation === a.id ? "border-violet-400/50 bg-violet-400/5 text-zinc-100" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
              <input type="radio" checked={affiliation === a.id} onChange={() => setAffiliation(a.id)} className="accent-violet-400" />
              {a.label}
            </label>
          ))}
          {affiliation !== "faculty_staff" && (
            <div className="grid grid-cols-2 gap-2">
              <input value={vGradYear} onChange={(e) => setVGradYear(e.target.value)} placeholder={affiliation === "alumni" ? "Class of (e.g. 2022)" : "Class of (optional)"} className="rounded-lg border border-line bg-card-raised px-3 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50" />
              <input value={vProgram} onChange={(e) => setVProgram(e.target.value)} placeholder="Major (optional)" className="rounded-lg border border-line bg-card-raised px-3 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50" />
            </div>
          )}
        </div>
        {user === null ? (
          <Link
            href="/login"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-violet-400 px-6 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet"
          >
            <GraduationCap className="h-4 w-4" /> Sign in to verify
          </Link>
        ) : (
          <button
            onClick={verifyCollege}
            disabled={verifyBusy}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-violet-400 px-6 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet disabled:opacity-50"
          >
            <GraduationCap className="h-4 w-4" /> {verifyBusy ? "Verifying…" : "Verify affiliation — Free"}
          </button>
        )}
        {verifyError && (
          <p className="mx-auto mt-3 max-w-sm rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] leading-relaxed text-red-300">
            {verifyError}
          </p>
        )}
        <p className="mt-3 text-[10px] text-zinc-600">
          Verification is always free — Free vs Pro controls platform features, never campus access.
          Class year and major are optional profile attributes you control; they are never turned into
          automatic communities.
        </p>
      </div>
    );
  }

  /* ---------------- the campus ---------------- */
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* COMPACT header — one tight block, not a hero. The page's real
          content (channels + live chat) starts one tile-row below. */}
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <GraduationCap className="h-4 w-4 shrink-0 text-violet-400" />
            <h1 className="text-lg font-bold leading-tight tracking-tight text-zinc-50">{user?.campus?.name ?? "Bowie State University"}</h1>
            {user?.campus ? (
              <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-violet-300">
                {user.campus.affiliation === "alumni" ? "Alumni" : user.campus.affiliation === "faculty_staff" ? "Faculty / Staff" : "Current Student"}
                {user.campus.gradYear ? ` · Class of ${user.campus.gradYear}` : ""}
              </span>
            ) : (
              <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-amber-300" title="DEMO MODE — you are not verified; access is open for testing only">
                Demo access — not verified
              </span>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-3 pl-6 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> 2,841 verified students</span>
            <span className="flex items-center gap-1 text-violet-400">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse-dot" /> 116 online
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.campus && <AcademicProfileCard />}
          {!!user?.campus && user.campus.affiliation !== "alumni" && user.campus.affiliation !== "faculty_staff" && (
            <button onClick={graduate} className="btn-ghost px-3 py-1.5 text-xs" title="Student → Alumni: nothing is deleted; student-only areas close, the alumni environment opens">
              I graduated
            </button>
          )}
        </div>
      </header>

      {/* DEMO MODE, no real verification — say so plainly */}
      {!user?.campus && demoUnrestricted && (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-4 py-3">
          <p className="text-xs font-semibold text-amber-300">DEMO MODE — verification gate opened for testing</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
            You are not actually verified at this school. Switch to Simulation Mode (top-left) to
            experience the real verification requirement, or verify below Settings → Demo Controls.
          </p>
        </div>
      )}

      {/* alumni environment — same campus, different doors open */}
      {user?.campus?.affiliation === "alumni" && (
        <div className="rounded-lg border border-violet-400/25 bg-violet-400/5 px-4 py-3">
          <p className="text-xs font-semibold text-violet-300">Alumni environment</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
            You&apos;re here as {user.campus.name} alumni{user.campus.gradYear ? ` — Class of ${user.campus.gradYear}` : ""}.
            Communities, events, networking, and your alumni community stay open; current-student-only
            areas (Marketplace, Student Groups) are closed.
          </p>
        </div>
      )}

      {/* ONE consistent tile row — four doors, identical styling. The
          only highlight is the OPEN section (violet + "open" tag): a
          visible state with a visible reason, never decoration. */}
      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Campus sections">
        {user?.campus?.affiliation === "current_student" || !user?.campus?.affiliation ? (
          <Link
            href="/campus/market"
            className="rounded-lg border border-line p-2 text-left transition hover:border-zinc-600 hover:bg-card-raised sm:p-2.5"
          >
            <p className="text-sm font-semibold text-zinc-100">Marketplace</p>
            <p className="mt-0.5 hidden truncate text-[10px] text-zinc-500 sm:block">Buy · sell · trade · borrow</p>
          </Link>
        ) : (
          <div className="rounded-lg border border-line p-2 text-left opacity-60 sm:p-2.5" title="Student-to-student trading is for current students. Your communities, events, and alumni network stay open.">
            <p className="text-sm font-semibold text-zinc-500">Marketplace</p>
            <p className="mt-0.5 hidden truncate text-[10px] text-zinc-600 sm:block">Current students only</p>
          </div>
        )}
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            aria-current={section === s.id ? "true" : undefined}
            className={`rounded-lg border p-2 text-left transition sm:p-2.5 ${
              section === s.id
                ? "border-violet-400/50 bg-violet-400/5"
                : "border-line hover:border-zinc-600 hover:bg-card-raised"
            }`}
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
              {s.label}
              {section === s.id && (
                <span className="rounded-full border border-violet-400/40 px-1.5 py-px font-mono text-[8px] font-bold uppercase tracking-wide text-violet-300">open</span>
              )}
            </p>
            <p className="mt-0.5 hidden truncate text-[10px] text-zinc-500 sm:block">{s.desc}</p>
          </button>
        ))}
      </nav>

      {/* ================= COMMUNITIES — for talking =================
          The callout box that used to sit here was redundant (it promoted
          the exact panel below it) — its one useful link now lives in the
          panel header as "All communities →". */}
      {section === "communities" && (
        <div className="card-people flex h-[480px] overflow-hidden animate-fade-up">
          <nav className="hidden w-56 shrink-0 overflow-y-auto border-r border-line-soft p-2 sm:block" aria-label="Interest communities">
            <p className="px-3 pb-1 pt-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">Channels</p>
            {interestCommunities.map((c) => (
              <button
                key={c.id}
                onClick={() => setCommunity(c.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${
                  community === c.id ? "bg-white/10 font-semibold text-zinc-50" : "text-zinc-400 hover:bg-card-raised hover:text-zinc-200"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="shrink-0 font-mono text-[9px] text-zinc-600">{c.members}</span>
              </button>
            ))}
            {/* Student Groups, Organizations, Campus Questions live HERE
                now — channel categories, exactly like Study Talk. Their
                full content opens in the pane on the right. */}
            <p className="px-3 pb-1 pt-3 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">Campus life</p>
            {CAMPUS_LIFE_CHANNELS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCommunity(c.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${
                  community === c.id ? "bg-white/10 font-semibold text-zinc-50" : "text-zinc-400 hover:bg-card-raised hover:text-zinc-200"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
              </button>
            ))}
          </nav>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-line-soft px-4 py-3 sm:hidden">
              <select value={community} onChange={(e) => setCommunity(e.target.value)} className="input-dark py-2">
                <optgroup label="Channels">
                  {interestCommunities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Campus life">
                  {CAMPUS_LIFE_CHANNELS.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="hidden items-center gap-2 border-b border-line-soft px-4 py-3 sm:flex">
              <p className="text-sm font-semibold text-zinc-100">{specialChannel ? specialChannel.name : activeCommunity.name}</p>
              {!specialChannel && <span className="font-mono text-[10px] text-zinc-600">{activeCommunity.members} members</span>}
              <a href="/communities?category=Campus%20Social" className="ml-auto font-mono text-[9px] font-semibold tracking-[0.1em] text-violet-300 hover:text-violet-200">
                ALL COMMUNITIES →
              </a>
            </div>
            {/* CHANNEL CATEGORIES — Student Groups / Organizations /
                Campus Questions render their full content right here in
                the pane, like any other channel. Nothing was removed. */}
            {specialChannel ? (
              <div className="flex-1 overflow-y-auto p-4">
                {community === "#groups" && <CampusGroups />}
                {community === "#orgs" && (
        <div className="animate-fade-up">
          <div className="grid gap-3 sm:grid-cols-2">
            {campusOrgs.map((org) => (
              <Link key={org.id} href={`/campus/${org.id}`} className="card-people card-lift overflow-hidden hover:border-zinc-600">
                <div className={`h-14 bg-gradient-to-br ${org.gradient} opacity-70`} />
                <div className="p-4">
                  <span className={`-mt-9 flex h-10 w-10 items-center justify-center rounded-xl border-2 border-card bg-gradient-to-br text-xl shadow-card ${org.gradient}`}>
                    {org.emoji}
                  </span>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-zinc-100">
                    {org.name}
                    {org.verified && <span className="text-sky-400" title="Verified Organization">✓</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {org.verified ? org.category : "Community Group"} · {org.members} members
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <p className="mt-2.5 text-[10px] leading-relaxed text-zinc-600">
            ✓ Verified Organization means the org is legitimate — it never proves who is a member.
            Membership verification comes in V2, approved by org admins.
          </p>
        </div>
                )}
                {community === "#questions" && (
        <div className="space-y-3 animate-fade-up">
          <a href="/communities/bowie-campus-questions" className="card-people block p-5 transition hover:border-violet-400/40">
            <p className="text-sm font-semibold text-zinc-100">Campus Questions is now a community</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Ask with your profile, an alias, or anonymously — the community decides nothing about who you are, and
              moderators keep it safe. Your question, your visibility level.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-violet-400 px-4 py-1.5 text-xs font-bold text-zinc-950">
              Open Campus Questions →
            </span>
          </a>
          <p className="px-1 font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-600">
            Real name · alias · anonymous — anonymous to the community, always accountable to Mavyn
          </p>
        </div>
                )}
              </div>
            ) : (
              <>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {chat.length === 0 && (
                <p className="pt-10 text-center text-xs text-zinc-600">Quiet in here — start the conversation.</p>
              )}
              {chat.map((m, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <Avatar src={m.avatar} initials={m.initials} gradient={m.gradient} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs">
                      <span className="font-semibold text-zinc-100">{m.author}</span>{" "}
                      <span className="text-zinc-600">{m.time}</span>
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-zinc-300">{m.text}</p>
                    {/* social → discovery → business: a shared profile is hireable */}
                    {m.creatorCard === "ava" && (
                      <div className="card-people mt-2 max-w-sm p-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar src={ava.avatar} initials={ava.initials} gradient={ava.gradient} size="sm" className="ring-1 ring-line" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-zinc-100">{ava.name}</p>
                            <p className="truncate text-xs text-zinc-500">Nails + photography · ★ {ava.rating} · on campus</p>
                          </div>
                        </div>
                        <div className="mt-2.5 flex gap-1.5">
                          <Link href={`/messages?to=${ava.handle}`} className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-600">
                            <MessageSquare className="h-3 w-3" /> Message
                          </Link>
                          <Link href={`/creator/${ava.id}`} className="rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-600">
                            View Services
                          </Link>
                          <Link href={`/messages?to=${ava.handle}`} className="flex items-center gap-1 rounded-full bg-lime-400 px-2.5 py-1 text-[11px] font-bold text-zinc-950 transition hover:bg-lime-300">
                            <Zap className="h-3 w-3" /> Hire
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-line-soft p-3">
              <button className="icon-btn h-9 w-9" aria-label="Attach"><Paperclip className="h-4 w-4" /></button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${activeCommunity.name}…`}
                className="input-dark rounded-full"
                onKeyDown={(e) => e.key === "Enter" && setDraft("")}
              />
              <button onClick={() => setDraft("")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-950 transition hover:bg-white" aria-label="Send">
                <Send className="h-4 w-4" />
              </button>
            </div>
              </>
            )}
          </div>
        </div>
      )}


      {/* ================= 💰 CAMPUS OPPORTUNITIES ================= */}
      {section === "opps" && (
        <div className="space-y-4 animate-fade-up">
          <p className="text-sm text-zinc-500">
            Paid work, gigs, and collaborations on campus — same protected system as everywhere on Mavyn.
          </p>
          {campusOppIds.map((id) => (
            <OpportunityCard key={id} id={id} />
          ))}

          {/* CAMPUS SERVICES — merged in: hiring a student and applying to
              a gig are the same money system, so they share one door.
              Requests still post as Campus Opportunities. */}
          <h3 className="border-t border-line-soft px-1 pt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Student services
          </h3>
        <div className="space-y-4 animate-fade-up">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
              I&apos;m looking for…
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {lookingFor.map((f) => (
                <button
                  key={f}
                  onClick={() => setSvcFilter(svcFilter === f ? null : f)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    svcFilter === f ? "border-violet-400/60 bg-violet-400/10 text-violet-300" : "border-line text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <article key={s.id} className="card-people card-lift flex items-center gap-3 p-4 hover:border-zinc-600">
                {"creatorId" in s && s.creatorId ? (
                  <Avatar src={ava.avatar} initials="A" size="md" className="ring-1 ring-line" />
                ) : (
                  <Avatar initials={(s as { initials?: string }).initials ?? s.name[0]} gradient={(s as { gradient?: string }).gradient} size="md" className="ring-1 ring-line" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
                    {s.name}
                    {s.verified && <span className="rounded-full border border-violet-400/40 px-1.5 py-px text-[8px] font-bold text-violet-300">STUDENT</span>}
                  </p>
                  <p className="truncate text-xs text-zinc-400">{s.service}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{s.rating}</span>
                    <span>{s.spot}</span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-zinc-500">from <span className="text-base font-extrabold tabular-nums tracking-tight text-lime-400">${s.startingAt}</span></p>
                  <Link
                    href={"creatorId" in s && s.creatorId ? `/creator/${s.creatorId}` : "/services"}
                    className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-lime-400 px-3 py-1 text-[11px] font-bold text-zinc-950 transition hover:bg-lime-300"
                  >
                    <Zap className="h-3 w-3" /> Book
                  </Link>
                </div>
              </article>
            ))}
            {services.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-zinc-500">Nobody offers that yet — post a request below.</p>
            )}
          </div>

          {/* post a request → optionally becomes a Campus Opportunity */}
          <div className="rounded-xl border border-dashed border-line p-4">
            {requestSent ? (
              <p className="text-center text-sm text-lime-300">
                ✓ Request posted as a Campus Opportunity — students can apply now.
              </p>
            ) : requestOpen ? (
              <div className="space-y-2.5">
                <input placeholder="Looking for a makeup artist" className="input-dark" autoFocus />
                <textarea rows={2} placeholder="Need makeup for a photoshoot on August 22. Bowie State campus. Budget: $75." className="input-dark resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => setRequestSent(true)} className="btn-lime flex-1 rounded-md py-2 text-xs">
                    Post Request
                  </button>
                  <button onClick={() => setRequestOpen(false)} className="btn-ghost px-4 py-2 text-xs">Cancel</button>
                </div>
                <p className="text-[10px] text-zinc-600">Requests post as Campus Opportunities — one system, not a million.</p>
              </div>
            ) : (
              <button onClick={() => setRequestOpen(true)} className="flex w-full items-center justify-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200">
                <Search className="h-4 w-4" /> Can&apos;t find what you&apos;re looking for? <span className="font-semibold text-lime-400">+ Post a Request</span>
              </button>
            )}
          </div>
        </div>
        </div>
      )}



      {/* ================= 🎉 EVENTS — strictly campus ================= */}
      {section === "events" && <CampusEvents />}


      {/* graduation → alumni */}
      <section className="rounded-xl border border-line p-4">
        <p className="text-sm font-semibold text-zinc-200">After graduation</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          This community becomes your <span className="font-semibold text-zinc-300">Alumni Community</span> —
          free, with your relationships, followers, portfolio, projects, and history intact. Grad school? Hold both:
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="chip px-2.5 py-1 text-[11px]">Bowie State Alumni</span>
          <span className="chip border-violet-400/40 px-2.5 py-1 text-[11px] text-violet-300">Current Graduate Student · Morgan State</span>
        </div>
        <p className="mt-2.5 border-t border-line-soft pt-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-600">
          school → community → skills → collabs → paid work → portfolio → alumni network → career
        </p>
      </section>
    </div>
  );
}


/* Campus events — ONLY events stamped with this campus (on-campus or
   directly school-associated). Off-campus parties, concerts, and city
   events live in the main Events section, not here. */
function CampusEvents() {
  const [data, setData] = useState<{
    campusName: string;
    events: {
      id: string; slug: string; title: string; description: string; category: string;
      startsAt: string; timeLabel: string; location: string; attending: number;
      spotsLeft: number | null; kind: string; going: boolean; isHost: boolean;
    }[];
  } | null>(null);

  const load = async () => {
    const res = await fetch("/api/campus/events", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  };
  useEffect(() => {
    void load();
  }, []);

  const toggleGoing = async (id: string) => {
    const res = await fetch(`/api/events/${id}`, { method: "POST" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      if (j.error) alert(j.error);
    }
    void load();
  };

  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  return (
    <div className="space-y-3 animate-fade-up">
      <div className="flex items-center justify-between px-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          On campus & school-associated only
        </p>
        <a href="/events/create" className="btn-ghost px-4 py-1.5 text-xs">+ Create campus event</a>
      </div>
      {data === null ? (
        <div className="card-event h-32 animate-pulse" />
      ) : data.events.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-600">No campus events yet — host the first one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.events.map((e) => {
            const d = new Date(e.startsAt);
            return (
              <article key={e.id} className="card-event p-4">
                <div className="flex items-start gap-3">
                  <span className="flex shrink-0 flex-col items-center rounded-lg border border-amber-400/40 px-2.5 py-1.5">
                    <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-400">{MONTHS[d.getMonth()]}</span>
                    <span className="text-lg font-extrabold leading-tight text-zinc-50">{d.getDate()}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <a href={`/events/${e.slug}`} className="block truncate text-[15px] font-bold text-zinc-50 hover:text-amber-300">{e.title}</a>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">{e.category} · {e.timeLabel}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-400">{e.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3 border-t border-dashed border-line pt-2.5 text-[11px] text-zinc-500">
                  <span className="truncate">{e.location.split(",")[0]}</span>
                  <span className="shrink-0">{e.attending} going</span>
                  {(e.kind === "rsvp" || e.kind === "registration") && !e.isHost && (
                    <button
                      onClick={() => void toggleGoing(e.id)}
                      className={`ml-auto shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                        e.going ? "border border-lime-400/50 text-lime-300" : "bg-amber-400 text-zinc-950 hover:bg-amber-300"
                      }`}
                    >
                      {e.going ? "Going ✓" : e.kind === "registration" ? "Register" : "RSVP"}
                    </button>
                  )}
                  {e.isHost && <span className="ml-auto font-mono text-[9px] tracking-[0.1em] text-zinc-400">HOSTING</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="px-1 text-[11px] text-zinc-600">
        Looking for off-campus parties, concerts, and city events? Those live in{" "}
        <a href="/events" className="font-semibold text-amber-300 hover:text-amber-200">Events</a> — the wider world.
      </p>
    </div>
  );
}


/* Student Groups — this campus's communities in the Study Groups /
   Student Organizations / Academic Groups / Interest Groups categories.
   They live HERE, not in the general Communities directory; broader
   social/interest communities stay in Communities. Cards reuse the
   existing community join/detail flows — nothing is duplicated. */
function CampusGroups() {
  const [data, setData] = useState<{
    campusName: string;
    categories: string[];
    groups: {
      id: string; slug: string; name: string; description: string; access: string;
      category: string; members: number; activeMembers: number; rules: string[];
      identityModes: string[];
      viewer: { status: string } | null;
    }[];
  } | null>(null);
  const [cat, setCat] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/campus/groups", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  };
  useEffect(() => {
    void load();
  }, []);

  const join = async (g: { id: string; name: string }) => {
    const res = await fetch(`/api/communities/${g.id}/join`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setNote(j.error || "Couldn't join");
    else setNote(j.status === "pending" ? `Request sent — ${g.name}'s moderators will review it.` : `Welcome to ${g.name}.`);
    void load();
  };

  const shown = data ? data.groups.filter((g) => !cat || g.category === cat) : [];

  return (
    <div className="space-y-3 animate-fade-up">
      <div className="flex items-center justify-between px-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          Study groups, student orgs, academic & interest groups
        </p>
        <a href="/communities/create" className="btn-ghost px-4 py-1.5 text-xs">+ Create student group</a>
      </div>

      {note && (
        <div className="rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 py-2.5 text-sm text-violet-200">
          {note}
          <button onClick={() => setNote(null)} className="float-right text-violet-300/60 hover:text-violet-200">✕</button>
        </div>
      )}

      {data && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setCat("")}
            className={`shrink-0 rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.1em] transition ${!cat ? "bg-violet-400 font-bold text-zinc-950" : "border border-zinc-800 text-zinc-400 hover:border-violet-400/40"}`}
          >
            ALL
          </button>
          {data.categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(cat === c ? "" : c)}
              className={`shrink-0 rounded-full px-3 py-1 font-mono text-[10px] tracking-[0.1em] transition ${cat === c ? "bg-violet-400 font-bold text-zinc-950" : "border border-zinc-800 text-zinc-400 hover:border-violet-400/40"}`}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {data === null ? (
        <div className="card-people h-32 animate-pulse" />
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-600">
          {cat ? "No groups in that category yet — start one." : "No student groups yet — start the first one."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((g) => (
            <article key={g.id} className="card-people flex min-w-0 flex-col break-words gap-2.5 p-4">
              <div className="flex items-start justify-between gap-2">
                <a href={`/communities/${g.slug}`} className="min-w-0">
                  <h3 className="truncate text-[15px] font-bold text-zinc-100 hover:text-violet-300">{g.name}</h3>
                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-zinc-500">{g.description}</p>
                </a>
                <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.14em] ${g.access === "private" ? "bg-amber-400/10 text-amber-300" : g.access === "invite" ? "bg-sky-400/10 text-sky-300" : "bg-lime-400/10 text-lime-300"}`}>
                  {g.access === "private" ? "PRIVATE" : g.access === "invite" ? "INVITE-ONLY" : "PUBLIC"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.08em] text-zinc-500">
                <span className="text-violet-300">{g.category.toUpperCase()}</span>
                <span>{g.members} MEMBERS</span>
                <span>{g.activeMembers} ACTIVE</span>
              </div>
              <div className="mt-auto flex items-center gap-2 pt-1">
                <a href={`/communities/${g.slug}`} className="rounded-full border border-zinc-700 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-violet-400/40 hover:text-violet-300">
                  View
                </a>
                {!g.viewer && g.access !== "invite" && (
                  <button onClick={() => void join(g)} className="rounded-full bg-violet-400 px-3.5 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-violet-300">
                    {g.access === "private" ? "Request to join" : "Join"}
                  </button>
                )}
                {!g.viewer && g.access === "invite" && (
                  <span className="font-mono text-[10px] tracking-[0.1em] text-zinc-500">INVITATION NEEDED</span>
                )}
                {g.viewer?.status === "active" && <span className="font-mono text-[10px] tracking-[0.1em] text-lime-300">MEMBER</span>}
                {g.viewer?.status === "pending" && <span className="font-mono text-[10px] tracking-[0.1em] text-amber-300">REQUEST PENDING</span>}
                {g.viewer?.status === "invited" && (
                  <button onClick={() => void join(g)} className="rounded-full bg-violet-400 px-3.5 py-1.5 text-xs font-bold text-zinc-950 hover:bg-violet-300">
                    Accept invitation
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="px-1 text-[11px] text-zinc-600">
        Looking for broader conversations — music, photo, late-night talk? Those live in{" "}
        <a href="/communities" className="font-semibold text-violet-300 hover:text-violet-200">Communities</a>.
      </p>
    </div>
  );
}


/* Academic profile & privacy — the MEMBER controls what their public
   profile shows. The verification itself stays stored for trust and
   eligibility regardless. "Class of" is an attribute, never a community. */
function AcademicProfileCard() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{
    campusName: string; affiliation: string; gradYear: string; program: string;
    showSchool: boolean; showGradYear: boolean; showProgram: boolean;
  } | null>(null);

  const load = async () => {
    const res = await fetch("/api/campus/verify");
    if (res.ok) {
      const j = await res.json();
      if (j.verified) setData(j);
    }
  };
  useEffect(() => {
    if (open && !data) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const patch = async (body: Record<string, unknown>) => {
    await fetch("/api/campus/verify", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    void load();
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="btn-ghost px-3.5 py-1.5 text-xs">
        Academic profile
      </button>
      {open && data && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-line bg-card p-4 shadow-card">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Academic profile & visibility
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs text-zinc-400">
                <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-600">Class of</span>
                <input
                  defaultValue={data.gradYear}
                  onBlur={(e) => e.target.value !== data.gradYear && void patch({ gradYear: e.target.value })}
                  placeholder="2027"
                  className="w-full rounded-lg border border-line bg-card-raised px-2.5 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
                />
              </label>
              <label className="text-xs text-zinc-400">
                <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-600">Major / program</span>
                <input
                  defaultValue={data.program}
                  onBlur={(e) => e.target.value !== data.program && void patch({ program: e.target.value })}
                  placeholder="Cybersecurity"
                  className="w-full rounded-lg border border-line bg-card-raised px-2.5 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
                />
              </label>
            </div>
            <div className="mt-3 space-y-1.5">
              {([
                ["showSchool", "Show my school & status on my profile"],
                ["showGradYear", "Show my class year publicly"],
                ["showProgram", "Show my major publicly"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center justify-between gap-3 text-xs text-zinc-300">
                  {label}
                  <input
                    type="checkbox"
                    checked={data[key]}
                    onChange={(e) => void patch({ [key]: e.target.checked })}
                    className="accent-violet-400"
                  />
                </label>
              ))}
            </div>
            <p className="mt-3 border-t border-line-soft pt-2.5 text-[10px] leading-relaxed text-zinc-600">
              Your verification stays securely stored for trust and eligibility either way — these
              toggles only control what OTHER people see. Class year is a profile attribute and a
              discovery filter, never an automatic community.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
