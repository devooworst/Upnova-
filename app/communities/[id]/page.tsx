"use client";

/* ------------------------------------------------------------------ */
/*  Community home — discussion with a per-post identity selector.      */
/*                                                                      */
/*  · "Post as:" real profile / alias / anonymous (per community rules) */
/*  · masked authors are masked SERVER-SIDE — this page never receives  */
/*    a userId for an alias/anonymous post                              */
/*  · Request Reveal on masked posts → private mutual reveal            */
/*  · moderation: pin, lock, remove, approvals, mute/ban (mod log'd)    */
/* ------------------------------------------------------------------ */

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Users, Heart, MessageSquare, Pin, Lock, Trash2, Shield,
  UserRound, VenetianMask, Search, Flag, Ban, Eye, Send, GraduationCap, Link2,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import TrustReportModal from "@/components/TrustReportModal";
import { useSession } from "@/lib/session";
import { promptJoin } from "@/components/GuestGate";
import { identityModeLabel } from "@/lib/communityIdentity";

/* ---------------- types mirroring the API shapes ---------------- */

interface MaskedAuthor {
  kind: "real" | "alias" | "anonymous";
  isYou: boolean;
  user?: { id: string; handle: string; displayName: string; avatarUrl: string | null; verified: boolean } | null;
  label?: string;
  knownAs?: { handle: string; displayName: string; avatarUrl: string | null } | null;
  canRequestReveal?: boolean;
}

interface CPost {
  id: string;
  author: MaskedAuthor;
  identity: string;
  body: string;
  removed: boolean;
  removedReason: string | null;
  ref: { type: string; label: string; title: string; href: string } | null;
  pinned: boolean;
  locked: boolean;
  reactions: number;
  viewerReacted: boolean;
  comments: number;
  createdAt: string;
  canModerate: boolean;
}

interface CComment {
  id: string;
  author: MaskedAuthor;
  identity: string;
  body: string;
  removed: boolean;
  createdAt: string;
}

interface Community {
  id: string;
  slug: string;
  name: string;
  description: string;
  access: string;
  kind: string;
  category: string;
  rules: string[];
  identityModes: string[];
  whoCanPost: string;
  whoCanInvite: string;
  campusId: string | null;
  members: number;
  activeMembers: number;
  viewer: { role: string; status: string; alias: string | null; anonCode: string | null; lastIdentity: string; isMod: boolean } | null;
  pendingJoins?: number;
}

interface Member {
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  mutedUntil: string | null;
}

const ago = (d: string) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

/* ---------------- author line: the identity, as the crowd sees it ---------------- */

function AuthorLine({ a, when }: { a: MaskedAuthor; when: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {a.kind === "real" && a.user ? (
        <>
          <Link href={`/creator/${a.user.handle}`} className="shrink-0">
            <Avatar src={a.user.avatarUrl} initials={a.user.displayName.slice(0, 2).toUpperCase()} size="sm" />
          </Link>
          <div className="min-w-0">
            <Link href={`/creator/${a.user.handle}`} className="block truncate text-sm font-semibold text-zinc-200 hover:text-violet-300">
              {a.user.displayName}
              {a.isYou && <span className="ml-1.5 font-mono text-[9px] tracking-[0.1em] text-zinc-500">YOU</span>}
            </Link>
            <span className="font-mono text-[10px] text-zinc-600">@{a.user.handle} · {when}</span>
          </div>
        </>
      ) : a.kind === "alias" ? (
        <>
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-violet-400/10">
            <UserRound className="h-4 w-4 text-violet-300" />
          </span>
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-violet-200">
              {a.label}
              {a.isYou && <span className="ml-1.5 font-mono text-[9px] tracking-[0.1em] text-zinc-500">YOU</span>}
            </span>
            <span className="font-mono text-[10px] text-zinc-600">alias · {when}</span>
          </div>
        </>
      ) : (
        <>
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-zinc-800">
            <VenetianMask className="h-4 w-4 text-zinc-400" />
          </span>
          <div className="min-w-0">
            <span className="block truncate font-mono text-[13px] font-semibold tracking-[0.06em] text-zinc-300">
              {a.label}
              {a.isYou && <span className="ml-1.5 font-mono text-[9px] tracking-[0.1em] text-violet-300">YOU</span>}
            </span>
            <span className="font-mono text-[10px] text-zinc-600">anonymous · {when}</span>
          </div>
        </>
      )}
      {a.knownAs && (
        <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-violet-400/20 bg-violet-400/5 px-2 py-0.5 font-mono text-[9px] tracking-[0.06em] text-violet-300" title="Only you can see this — you've mutually revealed identities">
          <Eye className="h-2.5 w-2.5" /> YOU KNOW: {a.knownAs.displayName.toUpperCase()}
        </span>
      )}
    </div>
  );
}

/* ---------------- identity picker for the composer ---------------- */

function IdentityPicker({
  community, value, alias, onChange, onAlias,
}: {
  community: Community;
  value: string;
  alias: string;
  onChange: (v: string) => void;
  onAlias: (v: string) => void;
}) {
  const v = community.viewer;
  const preview =
    value === "real" ? "your profile" : value === "alias" ? (alias || v?.alias || "set an alias") : v?.anonCode ? `Anonymous • ${v.anonCode}` : "Anonymous • (number assigned on your first anonymous post)";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] tracking-[0.14em] text-zinc-500">POST AS:</span>
        {community.identityModes.map((m) => (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={`rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] transition ${value === m ? "bg-violet-400 font-bold text-zinc-950" : "border border-zinc-800 text-zinc-400 hover:border-violet-400/40"}`}
          >
            {identityModeLabel(m).toUpperCase()}
          </button>
        ))}
        <span className="font-mono text-[10px] text-zinc-600">→ appears as: <span className="text-zinc-400">{preview}</span></span>
      </div>
      {value === "alias" && !v?.alias && (
        <input
          value={alias}
          onChange={(e) => onAlias(e.target.value)}
          placeholder="Pick your alias for this community (stays yours here)"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-400/40"
        />
      )}
    </div>
  );
}

/* ================================ page ================================ */

function CommunityInner() {
  const { id: idParam } = useParams<{ id: string }>();
  const search = useSearchParams();
  const { user } = useSession();

  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<CPost[] | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [threads, setThreads] = useState<Record<string, CComment[]>>({});
  const [openThread, setOpenThread] = useState<string | null>(search.get("post"));
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notAllowed, setNotAllowed] = useState<string | null>(null);

  // composer
  const [draft, setDraft] = useState("");
  const [identity, setIdentity] = useState("real");
  const [aliasDraft, setAliasDraft] = useState("");
  const [refUrl, setRefUrl] = useState("");
  const [showRef, setShowRef] = useState(false);
  const [busy, setBusy] = useState(false);

  // reply composers
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  // modals
  const [reportTarget, setReportTarget] = useState<{ type: "community_post" | "community_comment"; id: string } | null>(null);
  const [inviteHandle, setInviteHandle] = useState("");
  const [showMembers, setShowMembers] = useState(false);

  const load = useCallback(async () => {
    const cRes = await fetch(`/api/communities/${idParam}`);
    if (!cRes.ok) return setErr("Community not found");
    const cJson = await cRes.json();
    setCommunity(cJson.community);
    const allowed = cJson.community.identityModes as string[];
    setIdentity((prev) => {
      const wanted = cJson.community.viewer?.lastIdentity || prev;
      return allowed.includes(wanted) ? wanted : allowed[0];
    });

    const pRes = await fetch(`/api/communities/${idParam}/posts?q=${encodeURIComponent(q)}`);
    if (pRes.ok) {
      const pJson = await pRes.json();
      setPosts(pJson.posts);
      setNotAllowed(null);
    } else {
      const j = await pRes.json().catch(() => ({}));
      setPosts([]);
      setNotAllowed(j.error || "Members only");
    }
  }, [idParam, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadThread = async (postId: string) => {
    const res = await fetch(`/api/communities/${idParam}/posts/${postId}/comments`);
    if (res.ok) {
      const j = await res.json();
      setThreads((t) => ({ ...t, [postId]: j.comments }));
    }
  };

  useEffect(() => {
    if (openThread) void loadThread(openThread);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openThread]);

  const api = async (path: string, init?: RequestInit): Promise<boolean> => {
    const res = await fetch(path, init);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(j.error || "Something went wrong");
      return false;
    }
    return true;
  };

  const join = async () => {
    if (!user) return promptJoin("comment", `/communities/${idParam}`);
    if (await api(`/api/communities/${idParam}/join`, { method: "POST" })) void load();
  };

  const post = async () => {
    if (!user) return promptJoin("comment", `/communities/${idParam}`);
    setBusy(true);
    const ok = await api(`/api/communities/${idParam}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft, identity, alias: aliasDraft || undefined, refUrl: refUrl || undefined }),
    });
    setBusy(false);
    if (ok) {
      setDraft("");
      setRefUrl("");
      setShowRef(false);
      void load();
    }
  };

  const reply = async (postId: string) => {
    const body = (replyDrafts[postId] || "").trim();
    if (!body) return;
    const ok = await api(`/api/communities/${idParam}/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, identity, alias: aliasDraft || undefined }),
    });
    if (ok) {
      setReplyDrafts((d) => ({ ...d, [postId]: "" }));
      void loadThread(postId);
      void load();
    }
  };

  const react = async (p: CPost) => {
    if (!user) return promptJoin("like", `/communities/${idParam}`);
    if (await api(`/api/communities/${idParam}/posts/${p.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "react" }) }))
      void load();
  };

  const modAction = async (p: CPost, action: string) => {
    if (action === "remove") {
      const reason = p.author.isYou ? undefined : window.prompt("Reason (shown in place of the post):") || "Removed by a moderator";
      if (await api(`/api/communities/${idParam}/posts/${p.id}?reason=${encodeURIComponent(reason || "")}`, { method: "DELETE" })) void load();
      return;
    }
    if (await api(`/api/communities/${idParam}/posts/${p.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }))
      void load();
  };

  const requestReveal = async (p: { id: string }, kind: "post" | "comment") => {
    if (!user) return promptJoin("comment", `/communities/${idParam}`);
    const ok = await api("/api/reveals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ communityId: community?.id, [kind === "post" ? "postId" : "commentId"]: p.id }),
    });
    if (ok) setMsg("Reveal request sent — they'll decide privately. If they accept, you'll both see each other's profiles.");
  };

  const block = async (p: { id: string }, kind: "post" | "comment") => {
    if (!user) return;
    const ok = await api("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ communityId: community?.id, [kind === "post" ? "postId" : "commentId"]: p.id }),
    });
    if (ok) {
      setMsg("Blocked. You won't see their community content, and reveal requests are cut both ways.");
      void load();
    }
  };

  const invite = async () => {
    if (!inviteHandle.trim()) return;
    if (await api(`/api/communities/${idParam}/invite`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle: inviteHandle }) })) {
      setMsg(`Invitation sent to @${inviteHandle.replace(/^@/, "")}`);
      setInviteHandle("");
    }
  };

  const loadMembers = async () => {
    const res = await fetch(`/api/communities/${idParam}/members`);
    if (res.ok) {
      const j = await res.json();
      setMembers(j.members);
      setShowMembers(true);
    }
  };

  const memberAction = async (m: Member, action: string, days?: number) => {
    if (await api(`/api/communities/${idParam}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: m.userId, action, days }) })) {
      void loadMembers();
      void load();
    }
  };

  if (err) return <div className="mx-auto max-w-3xl px-1 py-12 text-center text-sm text-zinc-500">{err}</div>;
  if (!community) return <div className="mx-auto max-w-3xl px-1 py-12 text-center font-mono text-[11px] tracking-[0.1em] text-zinc-600">LOADING…</div>;

  const v = community.viewer;
  const activeMember = v?.status === "active";
  const canPost = activeMember && (community.whoCanPost === "members" || v?.isMod);
  const canInvite = activeMember && (community.whoCanInvite === "members" || v?.isMod);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* ---------------- header ---------------- */}
      <header className="card-people overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-violet-500/25 via-violet-400/10 to-transparent" />
        <div className="space-y-3 p-4 pt-3">
          <Link href="/communities" className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.1em] text-zinc-500 hover:text-violet-300">
            <ArrowLeft className="h-3 w-3" /> COMMUNITIES
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-zinc-50">{community.name}</h1>
              <p className="mt-1 text-sm leading-snug text-zinc-500">{community.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.08em] text-zinc-500">
                <span className="text-zinc-400">{community.category.toUpperCase()}</span>
                <span>{community.access.toUpperCase()}</span>
                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{community.members} MEMBERS</span>
                <span>{community.activeMembers} ACTIVE THIS WEEK</span>
                {community.campusId && <span className="inline-flex items-center gap-1 text-amber-300"><GraduationCap className="h-3 w-3" />CAMPUS</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {community.identityModes.map((m) => (
                  <span key={m} className="rounded-full border border-violet-400/20 bg-violet-400/5 px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] text-violet-300">
                    {identityModeLabel(m).toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {!v && (
                <button onClick={() => void join()} className="rounded-full bg-violet-400 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-violet-300">
                  {community.access === "private" ? "Request to join" : community.access === "invite" ? "Invitation needed" : "Join"}
                </button>
              )}
              {v?.status === "pending" && <span className="font-mono text-[10px] tracking-[0.1em] text-amber-300">REQUEST PENDING</span>}
              {v?.status === "invited" && (
                <button onClick={() => void join()} className="rounded-full bg-violet-400 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-violet-300">
                  Accept invitation
                </button>
              )}
              {v?.isMod && (
                <button onClick={() => (showMembers ? setShowMembers(false) : void loadMembers())} className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:border-violet-400/40">
                  <Shield className="h-3.5 w-3.5" /> Members{community.pendingJoins ? ` · ${community.pendingJoins} pending` : ""}
                </button>
              )}
            </div>
          </div>

          {community.rules.length > 0 && (
            <details className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
              <summary className="cursor-pointer font-mono text-[10px] tracking-[0.14em] text-zinc-400">COMMUNITY RULES ({community.rules.length})</summary>
              <ol className="mt-2 space-y-1 text-xs text-zinc-400">
                {community.rules.map((r, i) => (
                  <li key={i}><span className="font-mono text-zinc-600">{i + 1}.</span> {r}</li>
                ))}
              </ol>
            </details>
          )}

          {canInvite && (
            <div className="flex items-center gap-2">
              <input
                value={inviteHandle}
                onChange={(e) => setInviteHandle(e.target.value)}
                placeholder="Invite by @handle"
                className="flex-1 rounded-full border border-zinc-800 bg-zinc-900/60 px-3.5 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-400/40"
              />
              <button onClick={() => void invite()} className="rounded-full border border-zinc-700 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:border-violet-400/40">
                Invite
              </button>
            </div>
          )}
        </div>
      </header>

      {msg && (
        <div className="rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 py-2.5 text-sm text-violet-200">
          {msg}
          <button onClick={() => setMsg(null)} className="float-right text-violet-300/60 hover:text-violet-200">✕</button>
        </div>
      )}

      {/* ---------------- mod: member management ---------------- */}
      {showMembers && members && (
        <section className="card-people space-y-2 p-4">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Members — moderation</h2>
          <p className="text-[11px] text-zinc-600">
            The roster is a moderation surface: in rooms with alias/anonymous modes a public member list would let anyone correlate masked
            posts with membership. Aliases and anonymous numbers are not shown here — identity reveals go through reported content only, and
            every one is logged.
          </p>
          {members.map((m) => (
            <div key={m.userId} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 p-2.5">
              <Avatar src={m.avatarUrl} initials={m.displayName.slice(0, 2).toUpperCase()} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-200">{m.displayName}</p>
                <p className="font-mono text-[10px] text-zinc-500">
                  @{m.handle} · {m.role.toUpperCase()} · {m.status.toUpperCase()}
                  {m.mutedUntil && new Date(m.mutedUntil) > new Date() && " · MUTED"}
                </p>
              </div>
              {m.status === "pending" && (
                <>
                  <button onClick={() => void memberAction(m, "approve")} className="rounded-full bg-violet-400 px-2.5 py-1 text-[11px] font-bold text-zinc-950">Approve</button>
                  <button onClick={() => void memberAction(m, "decline")} className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300">Decline</button>
                </>
              )}
              {m.status === "active" && m.role !== "owner" && (
                <>
                  {v?.role === "owner" && (
                    <button onClick={() => void memberAction(m, m.role === "moderator" ? "demote" : "promote")} className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-violet-400/40">
                      {m.role === "moderator" ? "Demote" : "Make mod"}
                    </button>
                  )}
                  {m.mutedUntil && new Date(m.mutedUntil) > new Date() ? (
                    <button onClick={() => void memberAction(m, "unmute")} className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300">Unmute</button>
                  ) : (
                    <button onClick={() => void memberAction(m, "mute", 3)} className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300">Mute 3d</button>
                  )}
                  <button onClick={() => void memberAction(m, "remove")} className="rounded-full border border-red-400/30 px-2.5 py-1 text-[11px] text-red-300">Remove</button>
                </>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ---------------- composer ---------------- */}
      {activeMember && canPost && (
        <section className="card-people space-y-3 p-4">
          <IdentityPicker community={community} value={identity} alias={aliasDraft} onChange={setIdentity} onAlias={setAliasDraft} />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder={community.kind === "campus_questions" ? "Ask your campus anything…" : `Say something in ${community.name}…`}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-400/40"
          />
          {showRef ? (
            <input
              value={refUrl}
              onChange={(e) => setRefUrl(e.target.value)}
              placeholder="Paste an UpNova link — service, opportunity, listing, event, product, or work"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-400/40"
            />
          ) : (
            <button onClick={() => setShowRef(true)} className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.1em] text-zinc-500 hover:text-violet-300">
              <Link2 className="h-3 w-3" /> ATTACH AN UPNOVA LINK
            </button>
          )}
          <div className="flex justify-end">
            <button
              disabled={busy || draft.trim().length < 2}
              onClick={() => void post()}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet-400 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-violet-300 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" /> Post
            </button>
          </div>
        </section>
      )}
      {activeMember && !canPost && (
        <p className="px-1 text-center font-mono text-[10px] tracking-[0.1em] text-zinc-600">ONLY MODERATORS POST HERE — YOU CAN STILL REPLY WHERE THREADS ARE OPEN</p>
      )}

      {/* ---------------- search ---------------- */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search this community…"
          className="w-full rounded-full border border-zinc-800 bg-zinc-900/60 py-2 pl-9 pr-4 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-400/40"
        />
      </div>

      {/* ---------------- posts ---------------- */}
      {notAllowed ? (
        <div className="card-people p-8 text-center">
          <Lock className="mx-auto mb-2 h-6 w-6 text-zinc-600" />
          <p className="text-sm text-zinc-400">{notAllowed}</p>
        </div>
      ) : posts === null ? (
        <p className="py-6 text-center font-mono text-[11px] tracking-[0.1em] text-zinc-600">LOADING…</p>
      ) : posts.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-600">No posts yet{activeMember ? " — start the conversation." : "."}</p>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <article key={p.id} className={`card-people p-4 ${search.get("post") === p.id ? "border-violet-400/40" : ""}`}>
              <div className="mb-2 flex items-center gap-2">
                <AuthorLine a={p.author} when={ago(p.createdAt)} />
              </div>
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                {p.pinned && <span className="inline-flex items-center gap-1 rounded bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] text-amber-300"><Pin className="h-2.5 w-2.5" />PINNED</span>}
                {p.locked && <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] text-zinc-400"><Lock className="h-2.5 w-2.5" />LOCKED</span>}
              </div>

              {p.removed ? (
                <p className="text-sm italic text-zinc-600">{p.removedReason}</p>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-zinc-200">{p.body}</p>
                  {p.ref && (
                    <Link href={p.ref.href} className="mt-2 flex items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/5 px-3 py-2 transition hover:border-sky-400/40">
                      <span className="font-mono text-[9px] font-bold tracking-[0.14em] text-sky-300">{p.ref.label}</span>
                      <span className="truncate text-xs text-zinc-300">{p.ref.title}</span>
                    </Link>
                  )}
                </>
              )}

              <div className="mt-3 flex items-center gap-4 border-t border-zinc-800/60 pt-2.5">
                <button onClick={() => void react(p)} className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${p.viewerReacted ? "text-violet-300" : "text-zinc-500 hover:text-violet-300"}`}>
                  <Heart className={`h-3.5 w-3.5 ${p.viewerReacted ? "fill-violet-300" : ""}`} /> {p.reactions}
                </button>
                <button onClick={() => setOpenThread(openThread === p.id ? null : p.id)} className="inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-500 hover:text-violet-300">
                  <MessageSquare className="h-3.5 w-3.5" /> {p.comments}
                </button>
                <div className="ml-auto flex items-center gap-3">
                  {p.author.kind !== "real" && !p.author.isYou && user && (
                    <button onClick={() => void requestReveal(p, "post")} className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.08em] text-zinc-500 hover:text-violet-300" title="Ask to privately reveal identities with this member">
                      <Eye className="h-3 w-3" /> REQUEST REVEAL
                    </button>
                  )}
                  {!p.author.isYou && user && (
                    <>
                      <button onClick={() => setReportTarget({ type: "community_post", id: p.id })} className="text-zinc-600 hover:text-amber-300" title="Report">
                        <Flag className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => void block(p, "post")} className="text-zinc-600 hover:text-red-400" title="Block this member (works on masked posts too — no identity revealed)">
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  {(p.canModerate || p.author.isYou) && (
                    <button onClick={() => void modAction(p, "remove")} className="text-zinc-600 hover:text-red-400" title="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {p.canModerate && (
                    <>
                      <button onClick={() => void modAction(p, p.pinned ? "unpin" : "pin")} className={p.pinned ? "text-amber-300" : "text-zinc-600 hover:text-amber-300"} title={p.pinned ? "Unpin" : "Pin"}>
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => void modAction(p, p.locked ? "unlock" : "lock")} className={p.locked ? "text-zinc-300" : "text-zinc-600 hover:text-zinc-300"} title={p.locked ? "Unlock" : "Lock"}>
                        <Lock className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* ---------- thread ---------- */}
              {openThread === p.id && (
                <div className="mt-3 space-y-3 border-t border-zinc-800/60 pt-3">
                  {(threads[p.id] ?? []).map((cm) => (
                    <div key={cm.id} className="pl-2">
                      <div className="flex items-center gap-2">
                        <AuthorLine a={cm.author} when={ago(cm.createdAt)} />
                        <div className="ml-auto flex items-center gap-2">
                          {cm.author.kind !== "real" && !cm.author.isYou && user && (
                            <button onClick={() => void requestReveal(cm, "comment")} className="text-zinc-600 hover:text-violet-300" title="Request reveal">
                              <Eye className="h-3 w-3" />
                            </button>
                          )}
                          {!cm.author.isYou && user && (
                            <button onClick={() => setReportTarget({ type: "community_comment", id: cm.id })} className="text-zinc-600 hover:text-amber-300" title="Report">
                              <Flag className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className={`mt-1 pl-[44px] text-[13px] leading-relaxed ${cm.removed ? "italic text-zinc-600" : "text-zinc-300"}`}>
                        {cm.removed ? "Removed" : cm.body}
                      </p>
                    </div>
                  ))}
                  {activeMember && (!p.locked || v?.isMod) && (
                    <div className="flex items-center gap-2 pl-2">
                      <input
                        value={replyDrafts[p.id] ?? ""}
                        onChange={(e) => setReplyDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && void reply(p.id)}
                        placeholder={`Reply as ${identity === "real" ? "yourself" : identity === "alias" ? v?.alias || aliasDraft || "your alias" : v?.anonCode ? `Anonymous • ${v.anonCode}` : "Anonymous"}…`}
                        className="flex-1 rounded-full border border-zinc-800 bg-zinc-900/60 px-3.5 py-1.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-400/40"
                      />
                      <button onClick={() => void reply(p.id)} className="rounded-full bg-violet-400 p-2 text-zinc-950 hover:bg-violet-300">
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {!user && (
        <p className="px-1 pb-4 text-center text-xs text-zinc-600">
          You&apos;re browsing as a guest — join UpNova to post, reply, and react.
        </p>
      )}

      {reportTarget && (
        <TrustReportModal
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          targetLabel={reportTarget.type === "community_post" ? "this community post" : "this reply"}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center font-mono text-[11px] tracking-[0.1em] text-zinc-600">LOADING…</p>}>
      <CommunityInner />
    </Suspense>
  );
}
