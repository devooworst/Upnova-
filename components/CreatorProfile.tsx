"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Clock, Flag, MapPin, MessageSquare, Star, Users, Zap } from "lucide-react";
import ReportModal from "./ReportModal";
import Avatar from "./Avatar";
import VerifiedBadge from "./VerifiedBadge";
import FollowButton from "./FollowButton";
import FollowListModal from "./FollowListModal";
import ProfilePreview from "./ProfilePreview";
import OpportunityCard from "./OpportunityCard";
import AiPolicyBadge from "./AiPolicyBadge";
import {
  creators,
  serviceCatalog,
  opportunities,
  communities,
  communityContent,
  type Creator,
} from "@/lib/data";
import { useFollow, formatCount } from "@/lib/follow";

/* The complete public profile for any creator: Portfolio · Services ·
   Opportunities · About — plus followers/following and communities. */

const tabs = ["Portfolio", "Services", "Opportunities", "About"] as const;
type Tab = (typeof tabs)[number];

export default function CreatorProfile({ id }: { id: string }) {
  const creator = creators.find((c) => c.id === id)!;
  const { followerCount, followingCount } = useFollow();
  const [tab, setTab] = useState<Tab>("Portfolio");
  const [listOpen, setListOpen] = useState<"followers" | "following" | null>(null);
  const [preview, setPreview] = useState<Creator | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const services = serviceCatalog.filter((s) => s.creatorId === id);
  const originalWork = services.some((s) => s.aiPolicy === "no-ai");
  const posted = opportunities.filter((o) => o.poster === creator.name);
  const memberOf = communities.filter((c) =>
    communityContent[c.id]?.memberIds.includes(id)
  );
  const followingDisplay = Math.max(40, Math.round(creator.followers / 22));

  const portfolioTiles = [
    { id: "w1", emoji: creator.emoji, label: "Latest work", gradient: creator.gradient },
    { id: "w2", emoji: "🎬", label: "Client project", gradient: "from-zinc-700 to-zinc-900" },
    { id: "w3", emoji: "⭐", label: `${creator.reviews} reviews`, gradient: "from-amber-500/60 to-orange-900" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* header */}
      <header className="card-people overflow-hidden">
        <div className={`h-28 bg-gradient-to-br sm:h-36 ${creator.gradient} opacity-60`} />
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between">
            <span className="-mt-10 inline-block rounded-full bg-card p-1 sm:-mt-12">
              <Avatar src={creator.avatar} initials={creator.initials} gradient={creator.gradient} size="xl" />
            </span>
            <div className="flex items-center gap-2 pb-1">
              <FollowButton id={creator.id} />
              <Link href="/messages" className="btn-ghost px-3.5 py-1.5 text-xs">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Message</span>
              </Link>
              {creator.startingAt && (
                <Link href="/services" className="btn-lime px-4 py-1.5 text-xs">
                  <Zap className="h-4 w-4" /> Hire Me
                </Link>
              )}
              <button
                onClick={() => setReportOpen(true)}
                className="icon-btn h-8 w-8"
                aria-label={`Report ${creator.name}`}
                title="Report / Get Help"
              >
                <Flag className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50">
              {creator.name}
              {creator.verified && <VerifiedBadge className="h-5 w-5" />}
            </h1>
            <p className="text-sm text-zinc-500">@{creator.handle}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-300">
              <span>{creator.emoji} {creator.role}</span>
              {originalWork && (
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-card-raised px-2 py-0.5 text-[10px] font-semibold text-zinc-200">
                  🎨 Original Work Available
                </span>
              )}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {creator.location}
                {creator.distanceMi !== undefined && creator.distanceMi <= 40 && (
                  <span className="font-mono font-medium text-zinc-400">· {creator.distanceMi} mi</span>
                )}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {creator.rating} ({creator.reviews} reviews)
              </span>
            </p>
          </div>

          {/* follower stats — clickable */}
          <div className="mt-4 flex gap-5 border-t border-line-soft pt-3.5 text-sm">
            <button onClick={() => setListOpen("followers")} className="transition hover:text-zinc-100">
              <span className="font-bold text-zinc-50">{formatCount(followerCount(creator))}</span>{" "}
              <span className="text-zinc-500">Followers</span>
            </button>
            <button onClick={() => setListOpen("following")} className="transition hover:text-zinc-100">
              <span className="font-bold text-zinc-50">{followingDisplay}</span>{" "}
              <span className="text-zinc-500">Following</span>
            </button>
          </div>
        </div>

        {/* tabs */}
        <nav className="flex border-t border-line-soft" aria-label="Profile sections">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex-1 px-2 py-3 text-sm font-semibold transition ${
                tab === t ? "text-zinc-50" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t}
              {tab === t && <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-white" />}
            </button>
          ))}
        </nav>
      </header>

      {/* Portfolio */}
      {tab === "Portfolio" && (
        <div className="animate-fade-up grid gap-4 sm:grid-cols-3">
          {portfolioTiles.map((t) => (
            <div key={t.id} className={`flex aspect-[4/3] flex-col items-center justify-center rounded-2xl border border-line bg-gradient-to-br text-4xl ${t.gradient}`}>
              <span aria-hidden>{t.emoji}</span>
              <span className="mt-2 text-xs font-semibold text-white/90">{t.label}</span>
            </div>
          ))}
          <p className="col-span-full text-center text-xs text-zinc-500">
            {creator.name.split(" ")[0]}&apos;s full portfolio — completed work, client projects, releases.
          </p>
        </div>
      )}

      {/* Services */}
      {tab === "Services" && (
        <div className="animate-fade-up grid gap-4 sm:grid-cols-2">
          {services.map((svc) => (
            <article key={svc.id} className="card-people flex flex-col p-5">
              <h3 className="text-base font-bold tracking-tight text-zinc-50">{svc.title}</h3>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-zinc-400">{svc.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="chip px-2 py-0.5 text-[11px]"><Clock className="h-3 w-3" /> {svc.delivery}</span>
                <span className="chip border-lime-400/25 px-2 py-0.5 text-[11px] text-lime-300">
                  <Check className="h-3 w-3" /> {creator.availability}
                </span>
                <AiPolicyBadge policy={svc.aiPolicy} />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-3.5">
                <p className="text-xs text-zinc-500">
                  Starting at{" "}
                  <span className="text-lg font-extrabold tracking-tight tabular-nums text-lime-400">${svc.startingAt}</span>
                </p>
                <Link href="/services" className="btn-lime px-4 py-1.5 text-xs">
                  <Zap className="h-3.5 w-3.5" /> Hire Me
                </Link>
              </div>
            </article>
          ))}
          {services.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-zinc-500">
              No published services yet. You can still message {creator.name.split(" ")[0]}.
            </p>
          )}
        </div>
      )}

      {/* Opportunities */}
      {tab === "Opportunities" && (
        <div className="animate-fade-up space-y-4">
          {posted.map((o) => (
            <OpportunityCard key={o.id} id={o.id} />
          ))}
          {posted.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-500">
              {creator.name.split(" ")[0]} hasn&apos;t posted any opportunities.
            </p>
          )}
        </div>
      )}

      {/* About */}
      {tab === "About" && (
        <div className="animate-fade-up space-y-4">
          <section className="card-people p-5">
            <h3 className="text-sm font-bold text-zinc-100">About</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-zinc-300">
              {creator.bio ??
                `${creator.role} based in ${creator.location}. ${creator.activity ?? ""}`}
            </p>
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {creator.skills.map((s) => (
                <span key={s} className="chip">{s}</span>
              ))}
            </div>
            <p className="mt-3.5 border-t border-line-soft pt-3 text-xs text-zinc-500">
              Reach: <span className="font-semibold text-zinc-300">{creator.reach.reach}</span> ·{" "}
              {creator.reach.location}
            </p>
          </section>
          {memberOf.length > 0 && (
            <section className="card-people p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
                <Users className="h-4 w-4 text-violet-400" /> Communities
              </h3>
              <ul className="mt-3 space-y-1">
                {memberOf.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/communities/${c.id}`}
                      className="-mx-2 flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-card-raised hover:text-zinc-100"
                    >
                      <span aria-hidden>{c.emoji}</span> {c.name}
                      <span className="ml-auto text-xs text-zinc-500">{c.members}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {reportOpen && (
        <ReportModal context={`Profile · ${creator.name}`} onClose={() => setReportOpen(false)} />
      )}
      {listOpen && (
        <FollowListModal mode={listOpen} ownerName={creator.name.split(" ")[0]} onClose={() => setListOpen(null)} />
      )}
      {preview && <ProfilePreview creator={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
