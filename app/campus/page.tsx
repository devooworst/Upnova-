"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Lock,
  MessageSquare,
  Paperclip,
  Send,
  Users,
  Zap,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import { getPlan, PRO_EVENT } from "@/lib/pro";
import { creators } from "@/lib/data";

/* ------------------------------------------------------------------ */
/* The verified digital campus network. Not a generic college chat —   */
/* channels for how students actually live, and every answer connects  */
/* to the real ecosystem: Follow → Message → View Services → Hire.     */
/* Graduation moves you to Alumni; you never lose what you built.      */
/* ------------------------------------------------------------------ */

const channels = [
  { id: "main", emoji: "💬", name: "Main campus chat" },
  { id: "beauty", emoji: "💇", name: "Hair & Beauty" },
  { id: "art", emoji: "🎨", name: "Art & Design" },
  { id: "music", emoji: "🎵", name: "Music" },
  { id: "photo", emoji: "📸", name: "Photography" },
  { id: "fashion", emoji: "👗", name: "Fashion" },
  { id: "tech", emoji: "💻", name: "Tech" },
  { id: "collabs", emoji: "🤝", name: "Collaborations" },
  { id: "questions", emoji: "📚", name: "School questions" },
  { id: "opps", emoji: "📢", name: "Campus opportunities" },
  { id: "events", emoji: "🎉", name: "Events" },
];

interface CampusMsg {
  author: string;
  initials: string;
  gradient: string;
  avatar?: string | null;
  time: string;
  text: string;
  /** inline creator card — the ecosystem moment */
  creatorCard?: string;
}

const channelMessages: Record<string, CampusMsg[]> = {
  main: [
    {
      author: "Maya R.",
      initials: "M",
      gradient: "from-rose-500 to-pink-600",
      time: "2:14 PM",
      text: "Does anybody know somebody who does nails on campus? 💅",
    },
    {
      author: "Toni A.",
      initials: "T",
      gradient: "from-amber-500 to-orange-600",
      time: "2:16 PM",
      text: "Yeah! @Ava does nails between shoots. Here's her profile 👇",
      creatorCard: "ava",
    },
    {
      author: "Maya R.",
      initials: "M",
      gradient: "from-rose-500 to-pink-600",
      time: "2:19 PM",
      text: "Just booked her for Friday. This app is dangerous 😭",
    },
  ],
  music: [
    {
      author: "K. Boateng",
      initials: "K",
      gradient: "from-emerald-500 to-teal-600",
      time: "11:02 AM",
      text: "Studio in the media building is free Thursday nights — who wants to run a session? Need a vocalist and someone on keys.",
    },
    {
      author: "Devon P.",
      initials: "D",
      gradient: "from-sky-500 to-indigo-600",
      time: "11:20 AM",
      text: "I'm in on keys. Posting it in #collabs so it counts on our portfolios 📁",
    },
  ],
  collabs: [
    {
      author: "Sasha G.",
      initials: "S",
      gradient: "from-violet-500 to-fuchsia-600",
      time: "9:41 AM",
      text: "Photographer + model needed for a fashion-class final. Split the gallery, both portfolios. Weekend shoot on the quad.",
    },
  ],
  opps: [
    {
      author: "Campus Bookstore",
      initials: "B",
      gradient: "from-zinc-600 to-zinc-800",
      time: "Yesterday",
      text: "Paid gig: we need a student videographer for our back-to-school promo. $250, weekend shoot. Posted on Opportunities — apply through UpNova so it's protected.",
    },
  ],
  questions: [
    {
      author: "Devon P.",
      initials: "D",
      gradient: "from-sky-500 to-indigo-600",
      time: "8:15 AM",
      text: "Anybody taken Prof. Okafor's digital media class? Is the final a project or an exam?",
    },
  ],
  events: [
    {
      author: "Student Activities",
      initials: "S",
      gradient: "from-lime-500 to-emerald-700",
      time: "Mon",
      text: "Homecoming creative showcase applications open Friday. Performers, designers, photographers — this is the one to be at. 🎉",
    },
  ],
};

export default function CampusPage() {
  const [plan, setPlanState] = useState<"free" | "college" | "pro">("free");
  const [channel, setChannel] = useState("main");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const sync = () => setPlanState(getPlan());
    sync();
    window.addEventListener(PRO_EVENT, sync);
    return () => window.removeEventListener(PRO_EVENT, sync);
  }, []);

  const ava = creators.find((c) => c.id === "ava")!;
  const messages = channelMessages[channel] ?? [];
  const activeChannel = channels.find((c) => c.id === channel)!;

  /* ---------------- locked: verify first ---------------- */
  if (plan !== "college") {
    return (
      <div className="mx-auto max-w-md pt-12 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-400/10">
          <Lock className="h-7 w-7 text-violet-400" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">
          Your campus network is waiting
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
          School communities are a verified digital campus — campus chat, creative channels,
          collabs, campus gigs, and events. Verify your student status to enter.
        </p>
        <Link
          href="/pro"
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-violet-400 px-6 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet"
        >
          <GraduationCap className="h-4 w-4" /> Verify Student Status · $4.99/mo
        </Link>
        <p className="mt-3 text-[10px] text-zinc-600">
          Alumni keep their campus community after graduation — you never lose what you built.
        </p>
      </div>
    );
  }

  /* ---------------- the campus ---------------- */
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-400">
          <GraduationCap className="h-3.5 w-3.5" /> verified campus network
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
              Bowie State University
            </h1>
            <p className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> 1,284 members
              </span>
              <span className="flex items-center gap-1 text-violet-400">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse-dot" /> 116 online
              </span>
              <span className="rounded-full border border-violet-400/40 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-violet-300">
                students + alumni
              </span>
            </p>
          </div>
        </div>
      </header>

      <div className="card-people flex h-[520px] overflow-hidden">
        {/* channels */}
        <nav className="hidden w-52 shrink-0 overflow-y-auto border-r border-line-soft p-2 sm:block" aria-label="Campus channels">
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => setChannel(c.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${
                channel === c.id
                  ? "bg-white/10 font-semibold text-zinc-50"
                  : "text-zinc-400 hover:bg-card-raised hover:text-zinc-200"
              }`}
            >
              <span aria-hidden>{c.emoji}</span>
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </nav>

        {/* channel chat */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-line-soft px-4 py-3 sm:hidden">
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="input-dark py-2">
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
              ))}
            </select>
          </div>
          <div className="hidden items-center gap-2 border-b border-line-soft px-4 py-3 sm:flex">
            <span aria-hidden>{activeChannel.emoji}</span>
            <p className="text-sm font-semibold text-zinc-100">{activeChannel.name}</p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="pt-10 text-center text-xs text-zinc-600">
                Quiet in here — start the conversation.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Avatar src={m.avatar} initials={m.initials} gradient={m.gradient} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className="font-semibold text-zinc-100">{m.author}</span>{" "}
                    <span className="text-zinc-600">{m.time}</span>
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-zinc-300">{m.text}</p>

                  {/* the ecosystem moment: a profile shared in chat is hireable */}
                  {m.creatorCard === "ava" && (
                    <div className="card-people mt-2 max-w-sm p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar src={ava.avatar} initials={ava.initials} gradient={ava.gradient} size="sm" className="ring-1 ring-line" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-zinc-100">{ava.name}</p>
                          <p className="truncate text-xs text-zinc-500">
                            Nails + photography · ⭐ {ava.rating} · on campus
                          </p>
                        </div>
                      </div>
                      <div className="mt-2.5 flex gap-1.5">
                        <FollowButton id={ava.id} size="xs" />
                        <Link href="/messages" className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-600">
                          <MessageSquare className="h-3 w-3" /> Message
                        </Link>
                        <Link href={`/creator/${ava.id}`} className="rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-zinc-600">
                          View Services
                        </Link>
                        <Link href="/services" className="flex items-center gap-1 rounded-full bg-lime-400 px-2.5 py-1 text-[11px] font-bold text-zinc-950 transition hover:bg-lime-300">
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
            <button className="icon-btn h-9 w-9" aria-label="Attach">
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${activeChannel.name}…`}
              className="input-dark rounded-full"
              onKeyDown={(e) => e.key === "Enter" && setDraft("")}
            />
            <button onClick={() => setDraft("")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-950 transition hover:bg-white" aria-label="Send">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* graduation → alumni */}
      <section className="rounded-xl border border-line p-4">
        <p className="text-sm font-semibold text-zinc-200">🎓 After graduation</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          When your verified student status ends, this community becomes your{" "}
          <span className="font-semibold text-zinc-300">Alumni Community</span> — you keep your
          relationships, followers, portfolio, projects, and history. Entering grad school? Hold
          both at once:
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="chip px-2.5 py-1 text-[11px]">🎓 Bowie State Alumni</span>
          <span className="chip border-violet-400/40 px-2.5 py-1 text-[11px] text-violet-300">
            🎓 Current Graduate Student · Morgan State
          </span>
        </div>
        <p className="mt-2.5 border-t border-line-soft pt-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-600">
          school → community → skills → collabs → paid work → portfolio → alumni network → career
        </p>
      </section>
    </div>
  );
}
