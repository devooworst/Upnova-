"use client";

/* ------------------------------------------------------------------ */
/*  Database-backed feed. Tab = what to rank, scope = where to look.   */
/*  Every post, author, like and comment is a real DB record owned by  */
/*  a real account. No hardcoded users anywhere.                       */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import DbPostCard, { type FeedPost } from "./DbPostCard";
import OpportunityList from "./OpportunityList";
import Avatar from "@/components/Avatar";
import { Zap } from "lucide-react";
import { useSession } from "@/lib/session";
import type { FeedScope } from "@/components/Feed";

export type FeedTab = "For You" | "Following" | "Opportunities" | "Trending";
const tabs: FeedTab[] = ["For You", "Following", "Opportunities", "Trending"];

export const FEED_EVENT = "mavyn:feed-changed";

const scopeParam: Record<FeedScope, string> = {
  foryou: "for-you",
  "5": "5mi",
  "25": "25mi",
  city: "city",
  county: "county",
  state: "state",
  country: "country",
  global: "global",
  school: "school",
};

const tabParam: Record<FeedTab, string> = {
  "For You": "for-you",
  Following: "following",
  Opportunities: "opportunities",
  Trending: "trending",
};

function Skeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="card-people animate-pulse p-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-card-raised" />
            <div className="space-y-2">
              <div className="h-3 w-32 rounded bg-card-raised" />
              <div className="h-2.5 w-48 rounded bg-card-raised" />
            </div>
          </div>
          <div className="mt-4 h-3 w-4/5 rounded bg-card-raised" />
          <div className="mt-2 h-3 w-3/5 rounded bg-card-raised" />
        </div>
      ))}
    </div>
  );
}

interface Props {
  scope: FeedScope;
  tab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  isStudent: boolean;
}

export default function DbFeed({ scope, tab, onTabChange, isStudent }: Props) {
  const { user } = useSession();
  const guest = user === null;
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [guestTotal, setGuestTotal] = useState(0);
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [promoted, setPromoted] = useState<{
    id: string;
    title: string;
    description: string;
    price: number;
    cta: string;
    owner: { handle: string; displayName: string; avatarUrl: string | null };
  } | null>(null);
  const [suggestedProduct, setSuggestedProduct] = useState<{
    id: string;
    title: string;
    price: number;
    category: string;
    external: boolean;
    image: string | null;
    owner: { handle: string; displayName: string; avatarUrl: string | null };
    reasons: string[];
  } | null>(null);
  const [suggestedWork, setSuggestedWork] = useState<{
    id: string; title: string; kind: string; from: number | null; hasFree: boolean; coverUrl: string | null;
    previewUrl: string | null;
    owner: { handle: string; displayName: string; avatarUrl: string | null }; reasons: string[];
  } | null>(null);
  const [playingWork, setPlayingWork] = useState(false);
  const workAudio = useRef<HTMLAudioElement | null>(null);
  const toggleWorkPreview = (url: string) => {
    if (!workAudio.current) {
      workAudio.current = new Audio(url);
      workAudio.current.onended = () => setPlayingWork(false);
    }
    if (playingWork) workAudio.current.pause();
    else void workAudio.current.play();
    setPlayingWork(!playingWork);
  };
  const [suggestedOpp, setSuggestedOpp] = useState<{
    id: string; title: string; budget: number | null; location: string;
    owner: { handle: string; displayName: string; avatarUrl: string | null }; reasons: string[];
  } | null>(null);
  const [suggested, setSuggested] = useState<{
    id: string;
    title: string;
    price: number;
    category: string;
    cta: string;
    owner: { handle: string; displayName: string; avatarUrl: string | null };
    reasons: string[];
  } | null>(null);
  const [suggestedCommunity, setSuggestedCommunity] = useState<{
    postId: string; body: string;
    author: { kind: string; label?: string; user?: { displayName: string } | null };
    community: { slug: string; name: string; members: number };
    reactions: number; comments: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bookmarks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) =>
        setSavedPosts(new Set((d.items ?? []).filter((i: { type: string }) => i.type === "post").map((i: { id: string }) => i.id)))
      );
  }, []);

  const load = useCallback(async () => {
    if (tab === "Opportunities") return; // handled by OpportunityList
    try {
      const res = await fetch(`/api/feed?tab=${tabParam[tab]}&scope=${scopeParam[scope]}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        setPosts([]);
        setError("signin");
        return;
      }
      const data = await res.json();
      setError(null);
      setPosts(data.items ?? []);
      setGuestTotal(data.totalPublic ?? 0);
      setPromoted(data.promoted ?? null);
      setSuggested(data.suggestedService ?? null);
      setSuggestedProduct(data.suggestedProduct ?? null);
      setSuggestedWork(data.suggestedWork ?? null);
      setSuggestedOpp(data.suggestedOpportunity ?? null);
      setSuggestedCommunity(data.suggestedCommunityPost ?? null);
      // passive view signals for what actually rendered (deduped server-side)
      // — members only; guests have no interaction log to write to
      const viewed = (data.items ?? []).slice(0, 12).map((p: FeedPost) => ({ targetType: "post", targetId: p.id, action: "view" }));
      if (viewed.length && !data.guest)
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: viewed }),
        }).catch(() => {});
    } catch {
      setError("network");
      setPosts([]);
    }
  }, [tab, scope]);

  useEffect(() => {
    setPosts(null);
    load();
    window.addEventListener(FEED_EVENT, load);
    return () => window.removeEventListener(FEED_EVENT, load);
  }, [load]);

  return (
    <>
      {/* feed type — what kind of content. Guests get the public Discover
          set; member tabs (Following, Trending) need a taste to rank with */}
      <div className="flex items-center gap-4 overflow-x-auto border-b border-line-soft pb-0 text-sm no-scrollbar">
        {(guest ? (["For You", "Opportunities"] as FeedTab[]) : tabs).map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={`-mb-px shrink-0 border-b-2 pb-2.5 transition ${
              tab === t
                ? "border-white font-semibold text-zinc-50"
                : "border-transparent font-medium text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {guest && t === "For You" ? "Discover" : t}
          </button>
        ))}
      </div>

      {/* school scope banner */}
      {scope === "school" && (
        <div className="flex items-center gap-3 rounded-xl border border-violet-400/30 bg-violet-400/5 px-4 py-2.5">
          <GraduationCap className="h-4 w-4 shrink-0 text-violet-400" />
          <p className="min-w-0 flex-1 text-xs text-zinc-400">
            <span className="font-semibold text-violet-300">Verified campus scope</span> — students,
            campus creators, orgs, and campus work.
          </p>
          <Link href="/campus" className="shrink-0 text-xs font-semibold text-violet-400 hover:text-violet-300">
            Campus →
          </Link>
        </div>
      )}

      {tab === "Opportunities" ? (
        <OpportunityList scope={scopeParam[scope]} compact />
      ) : error === "signin" ? (
        <div className="card p-8 text-center">
          <p className="text-sm font-semibold text-zinc-200">Sign in to see your feed</p>
          <p className="mt-1 text-xs text-zinc-500">
            Your feed is built from real accounts, follows, and location — it needs to know who you are.
          </p>
          <Link href="/login" className="btn-lime mt-4 inline-flex px-5 py-2 text-sm">
            Sign in
          </Link>
        </div>
      ) : posts === null ? (
        <Skeleton />
      ) : (
        <div key={`${tab}-${scope}`} className="animate-fade-up space-y-4">
          {posts.map((p, i) => (
            <span key={p.id} className="block space-y-4">
              <DbPostCard
                post={p}
                flat
                savedInitial={savedPosts.has(p.id)}
                onHidden={(id) => setPosts((cur) => (cur ?? []).filter((x) => x.id !== id))}
              />
              {/* organic service suggestion — ranked by the same engine as
                  everything else, with its reasons shown. NOT promoted. */}
              {i === 5 && suggested && (
                <aside className="card flex flex-wrap items-center gap-3 p-4">
                  <span className="w-full font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Suggested service{suggested.reasons.length ? ` · ${suggested.reasons.join(" · ")}` : ""}
                  </span>
                  <Avatar src={suggested.owner.avatarUrl} initials={suggested.owner.displayName.charAt(0)} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-zinc-100">{suggested.title}</p>
                    <p className="text-xs text-zinc-500">
                      {suggested.owner.displayName} ·{" "}
                      <span className="font-mono tracking-[0.08em] text-lime-300">from ${suggested.price}</span>
                      <span className="capitalize"> · {suggested.category}</span>
                    </p>
                  </div>
                  <Link href={`/services/${suggested.id}`} className="btn-ghost shrink-0 px-3.5 py-1.5 text-xs">
                    {suggested.cta}
                  </Link>
                </aside>
              )}
              {/* WORK card — License is the action */}
              {i === 3 && suggestedWork && (
                <aside className="card flex flex-wrap items-center gap-3.5 p-4">
                  <span className="flex w-full items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> Work · License
                    {suggestedWork.reasons.length ? ` · ${suggestedWork.reasons.join(" · ")}` : ""}
                  </span>
                  {/* artwork first; the play button IS the preview */}
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-card-raised">
                    {suggestedWork.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={suggestedWork.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-zinc-600">♩</span>
                    )}
                    {suggestedWork.previewUrl && (
                      <button
                        onClick={() => toggleWorkPreview(suggestedWork.previewUrl!)}
                        aria-label={playingWork ? "Pause preview" : "Play preview"}
                        className="absolute inset-0 flex items-center justify-center bg-black/45 text-zinc-50 transition hover:bg-black/30"
                      >
                        {playingWork ? (
                          <span className="flex gap-[3px]" aria-hidden><span className="h-4 w-[3px] rounded bg-current" /><span className="h-4 w-[3px] rounded bg-current" /></span>
                        ) : (
                          <span aria-hidden className="ml-0.5 border-y-[7px] border-l-[11px] border-y-transparent border-l-current" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-zinc-50">{suggestedWork.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {suggestedWork.owner.displayName}
                      <span className="mx-1.5 text-zinc-700">·</span>
                      <span className="font-mono tracking-[0.06em] text-lime-300">
                        {suggestedWork.from != null ? `from $${suggestedWork.from}` : suggestedWork.hasFree ? "free option" : "custom licensing"}
                      </span>
                    </p>
                    {suggestedWork.previewUrl && (
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-600">
                        {playingWork ? "Playing preview" : "Tap artwork to preview"}
                      </p>
                    )}
                  </div>
                  <Link href={`/works/${suggestedWork.id}`} className="btn-ghost shrink-0 px-3.5 py-1.5 text-xs">License</Link>
                </aside>
              )}
              {/* OPPORTUNITY card — Apply is the action */}
              {i === 9 && suggestedOpp && (
                <aside className="card flex flex-wrap items-center gap-3 p-4">
                  <span className="flex w-full items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Opportunity · Apply
                    {suggestedOpp.reasons.length ? ` · ${suggestedOpp.reasons.join(" · ")}` : ""}
                  </span>
                  <Avatar src={suggestedOpp.owner.avatarUrl} initials={suggestedOpp.owner.displayName.charAt(0)} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-zinc-50">{suggestedOpp.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {suggestedOpp.budget != null && (
                        <span className="font-mono text-[13px] font-semibold tracking-[0.04em] text-lime-300">${suggestedOpp.budget}</span>
                      )}
                      {suggestedOpp.budget != null && <span className="mx-1.5 text-zinc-700">·</span>}
                      {suggestedOpp.location}
                      <span className="mx-1.5 text-zinc-700">·</span>
                      {suggestedOpp.owner.displayName}
                    </p>
                  </div>
                  <Link href={`/opportunities/${suggestedOpp.id}`} className="btn-lime shrink-0 px-4 py-1.5 text-xs">Apply</Link>
                </aside>
              )}
              {/* COMMUNITY card — a popular public-community post, author
                  masked exactly as inside the community; click through to
                  the original source */}
              {i === 5 && suggestedCommunity && (
                <aside className="card flex flex-wrap items-center gap-3 p-4">
                  <span className="flex w-full items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> Community · {suggestedCommunity.community.name}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-zinc-200">&ldquo;{suggestedCommunity.body}&rdquo;</p>
                    <p className="mt-1 font-mono text-[10px] tracking-[0.06em] text-zinc-500">
                      {suggestedCommunity.author.kind === "real"
                        ? suggestedCommunity.author.user?.displayName ?? "A member"
                        : suggestedCommunity.author.label}
                      {" · "}
                      {suggestedCommunity.reactions} reactions · {suggestedCommunity.comments} replies · {suggestedCommunity.community.members} members
                    </p>
                  </div>
                  <Link
                    href={`/communities/${suggestedCommunity.community.slug}?post=${suggestedCommunity.postId}`}
                    className="btn-ghost shrink-0 px-3.5 py-1.5 text-xs"
                  >
                    Open
                  </Link>
                </aside>
              )}
              {/* PRODUCT card — the feed knows a product is not a post */}
              {i === 7 && suggestedProduct && (
                <aside className="card flex flex-wrap items-center gap-3 p-4">
                  <span className="flex w-full items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> Product
                    {suggestedProduct.reasons.length ? ` · ${suggestedProduct.reasons.join(" · ")}` : ""}
                  </span>
                  {suggestedProduct.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={suggestedProduct.image} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover" />
                  ) : (
                    <Avatar src={suggestedProduct.owner.avatarUrl} initials={suggestedProduct.owner.displayName.charAt(0)} size="md" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-zinc-50">{suggestedProduct.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      <span className="font-mono text-[13px] font-semibold tracking-[0.04em] text-lime-300">${suggestedProduct.price}</span>
                      <span className="mx-1.5 text-zinc-700">·</span>
                      <span className="capitalize">{suggestedProduct.category}</span>
                      <span className="mx-1.5 text-zinc-700">·</span>
                      {suggestedProduct.owner.displayName}
                    </p>
                  </div>
                  <Link href={`/shop/${suggestedProduct.id}`} className="btn-lime shrink-0 px-4 py-1.5 text-xs">
                    Buy
                  </Link>
                </aside>
              )}
              {/* promoted slot — labeled, separate from organic ranking */}
              {i === 2 && promoted && (
                <aside className="card flex flex-wrap items-center gap-3 border-line p-4">
                  <span className="w-full font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Promoted · not part of your recommendations
                  </span>
                  <Avatar src={promoted.owner.avatarUrl} initials={promoted.owner.displayName.charAt(0)} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-zinc-100">{promoted.title}</p>
                    <p className="text-xs text-zinc-500">
                      {promoted.owner.displayName} ·{" "}
                      <span className="font-mono tracking-[0.08em] text-lime-300">from ${promoted.price}</span>
                    </p>
                  </div>
                  <Link href="/services" className="btn-lime shrink-0 px-3.5 py-1.5 text-xs">
                    <Zap className="h-3.5 w-3.5" /> {promoted.cta}
                  </Link>
                </aside>
              )}
            </span>
          ))}
          {/* guest conversion — INLINE at the end of the preview, after the
              browse, not before it. Never a full-screen trap: the guest can
              scroll past it, navigate anywhere public, or join right here. */}
          {guest && posts.length > 0 && (
            <aside className="card p-6 text-center">
              <p className="text-sm font-bold text-zinc-100">
                {guestTotal > posts.length ? "You've seen the preview." : "You're exploring Mavyn as a guest."}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-zinc-400">
                {guestTotal > posts.length
                  ? `That's ${posts.length} of ${guestTotal} public posts. Create a free Mavyn account to keep exploring — `
                  : "Create a free Mavyn account to keep exploring — "}
                follow creators, save posts, message people, book services, and apply to opportunities.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Link href="/signup" className="btn-lime px-5 py-2 text-sm">Sign Up</Link>
                <Link href="/login" className="btn-ghost px-4 py-2 text-sm">Sign In</Link>
              </div>
            </aside>
          )}
          {posts.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500">
              Nothing here{["5mi", "25mi", "city", "county", "state", "school"].includes(scopeParam[scope]) ? " at this range — widen the scope" : " yet"}.
            </p>
          )}
        </div>
      )}
    </>
  );
}
