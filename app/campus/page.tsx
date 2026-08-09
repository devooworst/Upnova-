"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Lock,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  Star,
  Users,
  Zap,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
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

const sections = [
  { id: "communities", emoji: "💬", label: "Communities", desc: "Interest-based conversations" },
  { id: "services", emoji: "🛍️", label: "Campus Services", desc: "Find students who offer services" },
  { id: "opps", emoji: "💰", label: "Opportunities", desc: "Jobs, gigs & collaborations" },
  { id: "orgs", emoji: "🏛️", label: "Organizations", desc: "Student organizations & groups" },
  { id: "events", emoji: "🎉", label: "Events", desc: "What's happening on campus" },
  { id: "questions", emoji: "📚", label: "Campus Questions", desc: "Questions, advice & info" },
] as const;
type SectionId = (typeof sections)[number]["id"];

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

const campusQuestions = [
  { q: "Anybody taken Prof. Okafor's digital media class? Project or exam final?", by: "Devon P.", answers: 6, time: "3h" },
  { q: "Best spot on campus to shoot golden hour portraits?", by: "Toni A.", answers: 11, time: "8h" },
  { q: "Is the media lab open during break week?", by: "Maya R.", answers: 3, time: "1d" },
  { q: "Where do I submit an org budget request to SGA?", by: "Sasha G.", answers: 4, time: "2d" },
];

export default function CampusPage() {
  // campus access is a database fact: a verified campus_verifications row
  const { user } = useSession();
  const verified = !!user?.campus;
  const [section, setSection] = useState<SectionId>("communities");
  const [community, setCommunity] = useState("general");
  const [svcFilter, setSvcFilter] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const verifyCollege = async () => {
    setVerifyBusy(true);
    const res = await fetch("/api/campus/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.status === 401) window.location.href = "/login";
    invalidateSession();
    setVerifyBusy(false);
  };

  const ava = creators.find((c) => c.id === "ava")!;
  const services = campusServices.filter((s) => !svcFilter || s.category === svcFilter);
  const chat = communityChats[community] ?? [];
  const activeCommunity = interestCommunities.find((c) => c.id === community)!;

  /* ---------------- locked: free verification first ---------------- */
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
          Communities, campus services, opportunities, organizations, and events — verified
          students only.
        </p>
        <button
          onClick={verifyCollege}
          disabled={verifyBusy}
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-violet-400 px-6 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet disabled:opacity-50"
        >
          <GraduationCap className="h-4 w-4" /> {verifyBusy ? "Verifying…" : "Verify College — Free"}
        </button>
        <p className="mt-3 text-[10px] text-zinc-600">
          The network is never paywalled: verification, campus chat, and applying cost $0.
          College+ is an optional exposure upgrade. Alumni keep their community after graduation.
        </p>
      </div>
    );
  }

  /* ---------------- the campus ---------------- */
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-400">
          <GraduationCap className="h-3.5 w-3.5" /> your campus
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{user?.campus?.name ?? "Your Campus"}</h1>
            <p className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> 2,841 verified students</span>
              <span className="flex items-center gap-1 text-violet-400">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse-dot" /> 116 online
              </span>
            </p>
          </div>
        </div>
      </header>

      {/* section nav — conversation, discovery, and commerce are separate layers */}
      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Campus sections">
        {/* Marketplace is real and important enough to lead — a live link,
            not a static module */}
        <Link
          href="/campus/market"
          className="rounded-lg border border-lime-400/40 bg-lime-400/5 p-2.5 text-left transition hover:bg-lime-400/10"
        >
          <p className="text-sm font-semibold text-lime-300">Marketplace</p>
          <p className="mt-0.5 truncate text-[10px] text-zinc-500">Buy · sell · free · trade · auction · borrow</p>
        </Link>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`rounded-lg border p-2.5 text-left transition ${
              section === s.id
                ? "border-violet-400/50 bg-violet-400/5"
                : "border-line hover:border-zinc-600 hover:bg-card-raised"
            }`}
          >
            <p className="text-sm font-semibold text-zinc-100">{s.label}</p>
            <p className="mt-0.5 truncate text-[10px] text-zinc-500">{s.desc}</p>
          </button>
        ))}
      </nav>

      {/* current module heading — campus → choose → interact */}
      <h2 className="px-1 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
        Campus {sections.find((s) => s.id === section)?.label.replace("Campus ", "")}
      </h2>

      {/* ================= COMMUNITIES — for talking ================= */}
      {section === "communities" && (
        <a href="/communities?category=Campus%20Social" className="card-people mb-3 block p-4 transition hover:border-violet-400/40 animate-fade-up">
          <p className="text-sm font-semibold text-zinc-100">Real campus communities are live</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Create your own, set the rules, and choose which identity modes it allows — real name, alias, or anonymous.
          </p>
          <span className="mt-2 inline-block font-mono text-[10px] tracking-[0.1em] text-violet-300">OPEN COMMUNITIES →</span>
        </a>
      )}
      {section === "communities" && (
        <div className="card-people flex h-[480px] overflow-hidden animate-fade-up">
          <nav className="hidden w-56 shrink-0 overflow-y-auto border-r border-line-soft p-2 sm:block" aria-label="Interest communities">
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
          </nav>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-line-soft px-4 py-3 sm:hidden">
              <select value={community} onChange={(e) => setCommunity(e.target.value)} className="input-dark py-2">
                {interestCommunities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="hidden items-center gap-2 border-b border-line-soft px-4 py-3 sm:flex">
              <p className="text-sm font-semibold text-zinc-100">{activeCommunity.name}</p>
              <span className="ml-auto font-mono text-[10px] text-zinc-600">{activeCommunity.members} members</span>
            </div>
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
                          <FollowButton id={ava.id} size="xs" />
                          <Link href={`/messages?to=${ava.id}`} className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-600">
                            <MessageSquare className="h-3 w-3" /> Message
                          </Link>
                          <Link href={`/creator/${ava.id}`} className="rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-600">
                            View Services
                          </Link>
                          <Link href={`/messages?to=${ava.id}`} className="flex items-center gap-1 rounded-full bg-lime-400 px-2.5 py-1 text-[11px] font-bold text-zinc-950 transition hover:bg-lime-300">
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
          </div>
        </div>
      )}

      {/* ================= 🛍️ CAMPUS SERVICES — a directory, not a chat ================= */}
      {section === "services" && (
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
      )}

      {/* ================= 💰 CAMPUS OPPORTUNITIES ================= */}
      {section === "opps" && (
        <div className="space-y-4 animate-fade-up">
          <p className="text-sm text-zinc-500">
            Paid work, gigs, and collaborations on campus — same protected system as everywhere on UpNova.
          </p>
          {campusOppIds.map((id) => (
            <OpportunityCard key={id} id={id} />
          ))}
        </div>
      )}

      {/* ================= 🏛️ ORGANIZATIONS ================= */}
      {section === "orgs" && (
        <div className="animate-fade-up">
          <div className="grid gap-3 sm:grid-cols-3">
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

      {/* ================= 🎉 EVENTS — strictly campus ================= */}
      {section === "events" && <CampusEvents />}

      {/* ================= 📚 CAMPUS QUESTIONS — lives in Communities ================= */}
      {section === "questions" && (
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
            Real name · alias · anonymous — anonymous to the community, always accountable to UpNova
          </p>
        </div>
      )}

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
