"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Check,
  Heart,
  MapPin,
  MessageCircle,
  MessageSquare,
  Pin,
  Plus,
  Users,
  Zap,
} from "lucide-react";
import Avatar from "./Avatar";
import FollowButton from "./FollowButton";
import ProfilePreview from "./ProfilePreview";
import OpportunityCard from "./OpportunityCard";
import EventCard from "./EventCard";
import {
  communities,
  communityContent,
  communityAccessInfo,
  communityModeInfo,
  creators,
  currentUser,
} from "@/lib/data";

const tabs = ["Home", "Discussions", "Opportunities", "Events", "Members", "About"] as const;
type Tab = (typeof tabs)[number];

const guidelines = [
  "Be respectful",
  "No spam",
  "No harassment",
  "Keep opportunities legitimate",
  "Respect creators' work",
];

export default function CommunityView({ id }: { id: string }) {
  const community = communities.find((c) => c.id === id)!;
  const content = communityContent[id];
  const [tab, setTab] = useState<Tab>("Home");
  const [joined, setJoined] = useState(!!community.joined);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<(typeof creators)[number] | null>(null);

  const members = (content?.memberIds ?? [])
    .map((mid) => creators.find((c) => c.id === mid))
    .filter(Boolean) as typeof creators;

  const broadcast = community.mode === "broadcast" || community.mode === "announcements";
  const visibleTabs = tabs.filter((t) => {
    if (t === "Discussions") return (content?.discussions ?? []).length > 0;
    if (t === "Opportunities") return (content?.opportunityIds ?? []).length > 0;
    if (t === "Events") return (content?.eventIds ?? []).length > 0;
    if (t === "Members") return members.length > 0;
    return true;
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* header */}
      <header className="card-people overflow-hidden">
        <div className="relative h-32 sm:h-40">
          {community.image ? (
            <>
              <Image src={community.image} alt="" fill sizes="768px" className="object-cover" priority />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-black/20 to-transparent" />
            </>
          ) : (
            <div className={`flex h-full items-center justify-center bg-gradient-to-br text-5xl ${community.gradient}`}>
              {community.emoji}
            </div>
          )}
          <Link
            href="/communities"
            className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-black/70"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Communities
          </Link>
        </div>
        <div className="px-5 pb-4 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{community.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> {community.members} members
                </span>
                <span className="flex items-center gap-1 text-violet-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse-dot" />
                  {community.online} online
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {community.reach.location}
                </span>
                <span title={communityAccessInfo[community.access].desc}>
                  {communityAccessInfo[community.access].label}
                </span>
                <span title={communityModeInfo[community.mode].desc}>
                  {communityModeInfo[community.mode].label}
                </span>
              </p>
            </div>
            <button
              onClick={() => setJoined(!joined)}
              className={
                joined
                  ? "flex items-center gap-1.5 rounded-full border border-violet-400/40 px-4 py-1.5 text-xs font-semibold text-violet-300"
                  : "rounded-full bg-violet-400 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-violet-300 hover:shadow-glow-violet"
              }
            >
              {joined ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Joined
                </>
              ) : (
                "Join"
              )}
            </button>
          </div>
        </div>
        {/* tabs */}
        <nav className="no-scrollbar flex gap-1 overflow-x-auto border-t border-line-soft px-3" aria-label="Community sections">
          {visibleTabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px shrink-0 border-b-2 px-3 py-3 text-sm transition ${
                tab === t
                  ? "border-white font-semibold text-zinc-50"
                  : "border-transparent font-medium text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      {/* ---------------- Home: the community's mini feed ---------------- */}
      {tab === "Home" && (
        <div className="animate-fade-up space-y-4">
          {broadcast ? (
            <p className="rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-2.5 text-xs text-zinc-400">
              🎤 <span className="font-semibold text-amber-300">
                {communityModeInfo[community.mode].label.replace(/^\S+\s/, "")} community.
              </span>{" "}
              Only admins post here — react and save, no noise.
            </p>
          ) : (
            <div className="flex items-center gap-3 border-y border-line-soft py-3">
              <Avatar src={currentUser.avatar} initials={currentUser.initials} size="sm" />
              <button className="min-w-0 flex-1 truncate rounded-full border border-line bg-card px-4 py-2 text-left text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-400">
                What&apos;s happening in {community.name}?
              </button>
            </div>
          )}
          {(content?.posts ?? []).map((post) => (
            <article key={post.id} className="card-people p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => {
                    const author = creators.find((cr) => cr.id === post.authorId);
                    if (author) setPreview(author);
                  }}
                  className="shrink-0"
                  aria-label={`Preview ${post.author}`}
                >
                  <Avatar src={post.authorAvatar} initials={post.initials} gradient={post.gradient} size="md" />
                </button>
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => {
                      const author = creators.find((cr) => cr.id === post.authorId);
                      if (author) setPreview(author);
                    }}
                    className="block text-left"
                  >
                    <p className="text-sm font-semibold text-zinc-100 transition hover:text-violet-300">{post.author}</p>
                    <p className="text-xs text-zinc-500">
                      {post.role} · {post.time}
                    </p>
                  </button>
                </div>
                {post.authorId && <FollowButton id={post.authorId} size="xs" />}
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-zinc-200">{post.text}</p>
              <div className="mt-3 flex items-center gap-5 text-xs text-zinc-500">
                <button
                  onClick={() => setLiked((l) => ({ ...l, [post.id]: !l[post.id] }))}
                  className={`flex items-center gap-1.5 transition ${liked[post.id] ? "text-violet-400" : "hover:text-violet-300"}`}
                >
                  <Heart className={`h-4 w-4 ${liked[post.id] ? "fill-violet-400" : ""}`} />
                  {post.likes + (liked[post.id] ? 1 : 0)}
                </button>
                {!broadcast && (
                  <button className="flex items-center gap-1.5 transition hover:text-zinc-300">
                    <MessageCircle className="h-4 w-4" /> {post.comments}
                  </button>
                )}
                {broadcast && (
                  <button className="flex items-center gap-1.5 transition hover:text-amber-300">
                    🔖 Save
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ---------------- Discussions ---------------- */}
      {tab === "Discussions" && (
        <div className="animate-fade-up space-y-4">
          <div className="flex justify-end">
            <button className="btn-ghost px-4 py-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> New Discussion
            </button>
          </div>
          {(content?.discussions ?? []).some((d) => d.pinned) && (
            <section>
              <h2 className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                pinned
              </h2>
              {(content?.discussions ?? [])
                .filter((d) => d.pinned)
                .map((d) => (
                  <button
                    key={d.id}
                    className="card-people flex w-full items-center gap-3 p-4 text-left transition hover:border-zinc-600"
                  >
                    <Pin className="h-4 w-4 shrink-0 text-amber-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-100">{d.title}</span>
                      <span className="text-xs text-zinc-500">
                        {d.author} · {d.replies} replies · active {d.lastActive} ago
                      </span>
                    </span>
                  </button>
                ))}
            </section>
          )}
          <section>
            <h2 className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
              recent
            </h2>
            <div className="card-people divide-y divide-line-soft overflow-hidden">
              {(content?.discussions ?? [])
                .filter((d) => !d.pinned)
                .map((d) => (
                  <button key={d.id} className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-card-raised">
                    <MessageSquare className="h-4 w-4 shrink-0 text-violet-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-100">{d.title}</span>
                      <span className="text-xs text-zinc-500">
                        {d.author} · {d.replies} replies · active {d.lastActive} ago
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          </section>
        </div>
      )}

      {/* ---------------- Opportunities: the community as a job board ---------------- */}
      {tab === "Opportunities" && (
        <div className="animate-fade-up space-y-4">
          <p className="text-sm text-zinc-500">
            Paid work posted for <span className="font-semibold text-zinc-200">{community.name}</span> members.
          </p>
          {(content?.opportunityIds ?? []).map((oid) => (
            <OpportunityCard key={oid} id={oid} />
          ))}
        </div>
      )}

      {/* ---------------- Events ---------------- */}
      {tab === "Events" && (
        <div className="animate-fade-up grid gap-4 sm:grid-cols-2">
          {(content?.eventIds ?? []).map((eid) => (
            <EventCard key={eid} id={eid} />
          ))}
        </div>
      )}

      {/* ---------------- Members: the talent pool ---------------- */}
      {tab === "Members" && (
        <div className="animate-fade-up card-people divide-y divide-line-soft overflow-hidden">
          {members.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 p-4">
              <Avatar src={m.avatar} initials={m.initials} gradient={m.gradient} size="md" className="ring-1 ring-line" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-100">{m.name}</p>
                <p className="truncate text-xs text-zinc-500">
                  {m.role} · <MapPin className="inline h-3 w-3" /> {m.location.split(",")[0]}
                  {m.distanceMi !== undefined && m.distanceMi <= 40 && (
                    <span className="font-mono font-medium text-zinc-400"> · {m.distanceMi} mi</span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <FollowButton id={m.id} size="xs" />
                <Link href={`/creator/${m.id}`} className="btn-ghost px-3 py-1.5 text-xs">
                  View Profile
                </Link>
                <Link href={`/messages?to=${m.id}`} className="btn-ghost hidden px-3 py-1.5 text-xs sm:flex">
                  <MessageSquare className="h-3.5 w-3.5" />
                </Link>
                {m.startingAt && (
                  <Link href={`/messages?to=${m.id}`} className="btn-lime px-3.5 py-1.5 text-xs">
                    <Zap className="h-3.5 w-3.5" /> Hire
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- About ---------------- */}
      {preview && <ProfilePreview creator={preview} onClose={() => setPreview(null)} />}

      {tab === "About" && (
        <div className="animate-fade-up space-y-4">
          <section className="card-people p-5">
            <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">{community.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{community.description}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line-soft pt-4 text-sm sm:grid-cols-4">
              {[
                ["Location", community.reach.location],
                ["Reach", community.reach.reach],
                ["Members", community.members],
                ["Created", content?.created ?? "2026"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">{k}</dt>
                  <dd className="mt-0.5 font-semibold text-zinc-200">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="card-people p-5">
            <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Community Guidelines</h2>
            <ul className="mt-3 space-y-2">
              {guidelines.map((g) => (
                <li key={g} className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <Check className="h-4 w-4 shrink-0 text-violet-400" /> {g}
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-line-soft pt-3">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                creator-controlled settings
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-1.5 text-xs text-zinc-400">
                {[
                  ["Promote services", community.settings.promotion],
                  ["Post opportunities", community.settings.opportunities],
                  ["Promote events", community.settings.events],
                  ["External links", community.settings.links],
                  ["Posts need approval", community.settings.approval],
                ].map(([label, on]) => (
                  <li key={label as string} className="flex items-center gap-1.5">
                    <span className={on ? "text-lime-400" : "text-zinc-600"}>{on ? "✓" : "✗"}</span>
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-3 border-t border-line-soft pt-3 text-xs text-zinc-500">
              Created by <span className="font-semibold text-zinc-300">{content?.createdBy ?? "UpNova"}</span>
              <span className="text-zinc-600"> · communities follow UpNova&apos;s platform rules — creators control their space, not safety policy</span>
            </p>
          </section>
          {joined && (
            <button
              onClick={() => setJoined(false)}
              className="w-full rounded-xl border border-red-500/30 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
            >
              Leave Community
            </button>
          )}
        </div>
      )}
    </div>
  );
}
