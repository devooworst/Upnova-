"use client";

/* ------------------------------------------------------------------ */
/*  /live/[id] — the live room.                                        */
/*                                                                     */
/*  Viewer: big stage, LIVE badge, title, host card, viewer count,     */
/*  follow, share, reactions, real-time chat (2.5s poll), report.      */
/*  Host: end stream, live toggles, pin/delete messages, mute/block,   */
/*  moderators, guest invites, viewer list.                            */
/*  Guests: invited → banner to join; active → split-screen stage.     */
/*  Ended: host gets the replay decision panel; viewers get the        */
/*  replay (if saved) or an honest "this live has ended".              */
/*                                                                     */
/*  Transport note: chat/presence/reactions poll the real APIs — a     */
/*  refresh or reconnect simply resumes the heartbeat. The person on   */
/*  stage (host / active guest) gets REAL local camera+mic capture     */
/*  (LiveCameraStage · getUserMedia) as a self-view; remote video      */
/*  DELIVERY still needs media infrastructure (WebRTC SFU or a         */
/*  provider like Cloudflare Stream/LiveKit) and the UI says so        */
/*  honestly until it exists.                                          */
/* ------------------------------------------------------------------ */

import {
  Radio, Eye, Share2, Flag, Heart, Flame, Hand, Star, Smile, Pin, Trash2, MicOff, Ban,
  Shield, UserPlus, X, Loader2, Send, Users, Video, Bookmark, Sparkles, ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import LiveCameraStage from "@/components/LiveCameraStage";

type Detail = {
  stream: {
    id: string; title: string; category: string; categoryLabel: string; audience: string; status: string;
    startedAt: string; replayStatus: string; replayHighlight: boolean; viewerCount: number | null; peakViewers: number;
    host: { id?: string; handle: string; displayName: string; avatarUrl: string | null; locationLabel: string | null };
    campusName: string | null; communityName: string | null; isMine: boolean;
    chatEnabled: boolean; reactionsEnabled: boolean; sharingEnabled: boolean; guestsEnabled: boolean; saveReplay: boolean;
  };
  guests: { id: string; userId: string; handle: string; displayName: string; avatarUrl: string | null; status: string }[];
  moderators: { userId: string; handle: string; displayName: string }[];
  pinnedMessage: { id: string; body: string; displayName: string } | null;
  reactionCounts: Record<string, number>;
  me: { isHost: boolean; isModerator: boolean; guestStatus: string | null; muted: boolean; following: boolean };
};
type Msg = { id: string; userId: string; handle: string; displayName: string; avatarUrl: string | null; body: string; kind: string; isHost: boolean; at: number };

const REACTIONS = [
  ["heart", Heart, "text-rose-400"],
  ["fire", Flame, "text-orange-400"],
  ["clap", Hand, "text-amber-300"],
  ["wow", Star, "text-sky-300"],
  ["laugh", Smile, "text-lime-300"],
] as const;

function uptime(startedAt: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

export default function LiveStreamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const [data, setData] = useState<Detail | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatErr, setChatErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<{ userId: string; handle: string; displayName: string; isHost: boolean; isModerator: boolean; muted: boolean; blocked: boolean }[]>([]);
  const [inviteHandle, setInviteHandle] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [shared, setShared] = useState(false);
  const [tick, setTick] = useState(0); // uptime re-render
  const lastMsgAt = useRef(0);
  const chatBoxRef = useRef<HTMLDivElement>(null);

  /* ---------- detail + presence + chat polling ---------- */
  const loadDetail = useCallback(async () => {
    const res = await fetch(`/api/live/${id}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setDenied(d.error || "This live isn't available");
    setDenied(null);
    setData(d);
  }, [id]);

  useEffect(() => {
    loadDetail();
    const iv = setInterval(loadDetail, 8000);
    return () => clearInterval(iv);
  }, [loadDetail]);

  useEffect(() => {
    if (!data || data.stream.status !== "live" || denied) return;
    const beat = () => fetch(`/api/live/${id}/presence`, { method: "POST" }).catch(() => {});
    beat();
    const iv = setInterval(beat, 15_000);
    return () => clearInterval(iv);
  }, [id, data?.stream.status, denied]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadChat = useCallback(async () => {
    const res = await fetch(`/api/live/${id}/chat?after=${lastMsgAt.current}`);
    if (!res.ok) return;
    const d = await res.json();
    if (d.messages?.length) {
      setMsgs((cur) => {
        const seen = new Set(cur.map((m) => m.id));
        const next = [...cur, ...d.messages.filter((m: Msg) => !seen.has(m.id))].slice(-150);
        return next;
      });
      lastMsgAt.current = Math.max(lastMsgAt.current, ...d.messages.map((m: Msg) => m.at));
      setTimeout(() => chatBoxRef.current?.scrollTo({ top: chatBoxRef.current.scrollHeight }), 30);
    }
  }, [id]);

  useEffect(() => {
    if (denied) return;
    loadChat();
    const iv = setInterval(loadChat, 2500);
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => { clearInterval(iv); clearInterval(t); };
  }, [loadChat, denied]);

  /* ---------- actions ---------- */
  const act = async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/live/${id}${path}`, { method: path === "" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setChatErr(j.error || "That didn't work");
    else setChatErr(null);
    await loadDetail();
    return res.ok;
  };

  const sendChat = async () => {
    const text = chatText.trim();
    if (!text || busy) return;
    setBusy(true);
    const res = await fetch(`/api/live/${id}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setChatErr(j.error || "Couldn't send that");
    setChatErr(null);
    setChatText("");
    loadChat();
  };

  const share = async () => {
    const url = `${window.location.origin}/live/${id}`;
    try { await navigator.clipboard.writeText(url); } catch {}
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  const follow = async () => {
    if (!data?.stream.host) return;
    const hostUser = await fetch(`/api/users/${data.stream.host.handle}`).then((r) => r.json()).catch(() => null);
    const hostId = hostUser?.user?.id ?? hostUser?.id;
    if (!hostId) return;
    await fetch(`/api/follow/${hostId}`, { method: data.me.following ? "DELETE" : "POST" });
    loadDetail();
  };

  const openViewers = async () => {
    setShowViewers(true);
    const res = await fetch(`/api/live/${id}/viewers`);
    if (res.ok) setViewers((await res.json()).viewers ?? []);
  };

  /* ================================ render ============================= */
  if (denied)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Radio size={32} className="mx-auto text-zinc-700" />
        <p className="mt-4 text-sm font-semibold text-zinc-300">{denied}</p>
        <Link href="/live" className="mt-4 inline-block rounded-full border border-line px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-600">
          Back to Live
        </Link>
      </div>
    );
  if (!data)
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="aspect-video animate-pulse rounded-2xl border border-line-soft bg-card" />
      </div>
    );

  const { stream, me } = data;
  const live = stream.status === "live";
  const activeGuests = data.guests.filter((g) => g.status === "active");
  const stageCount = 1 + activeGuests.length;

  /* -------- ended states -------- */
  const endedPanel = !live && me.isHost && (
    <div className="rounded-2xl border border-line bg-card p-6 text-center" data-guide="live-ended-panel">
      <p className="text-lg font-bold text-zinc-100">Your live has ended.</p>
      <p className="mt-1 text-xs text-zinc-500">
        {stream.peakViewers} peak viewer{stream.peakViewers === 1 ? "" : "s"} · {stream.categoryLabel}
        {stream.replayStatus === "saved" && " · replay saved"}
        {stream.replayStatus === "deleted" && " · replay deleted"}
        {stream.replayStatus === "none" && " · replay not saved"}
      </p>
      <p className="mt-1 text-[10px] text-zinc-600">
        Replays keep the chat transcript and stream record. Video isn't recorded yet — your camera was a local preview only until Mavyn's media transport ships.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {stream.replayStatus !== "saved" && stream.replayStatus !== "deleted" && (
          <button onClick={() => act("/replay", { action: "save" })} data-guide="live-replay-save" className="flex items-center gap-1.5 rounded-full bg-lime-400 px-4 py-2 text-xs font-bold text-black hover:bg-lime-300">
            <Bookmark size={13} /> Save replay
          </button>
        )}
        {stream.replayStatus === "saved" && !stream.replayHighlight && (
          <button onClick={() => act("/replay", { action: "highlight" })} className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-xs font-bold text-amber-300 hover:border-amber-300">
            <Sparkles size={13} /> Create highlight
          </button>
        )}
        {stream.replayStatus === "saved" && (
          <button onClick={share} className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-600">
            <Share2 size={13} /> {shared ? "Link copied" : "Share replay"}
          </button>
        )}
        {stream.replayStatus !== "deleted" && (
          <button onClick={() => act("/replay", { action: "delete" })} data-guide="live-replay-delete" className="flex items-center gap-1.5 rounded-full border border-rose-400/40 px-4 py-2 text-xs font-semibold text-rose-300 hover:border-rose-300">
            <Trash2 size={13} /> Delete replay
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      {/* after the live ends, a plain way back to Live — client-side
          navigation, session and state untouched */}
      {!live && (
        <Link
          href="/live"
          data-guide="live-back"
          className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600"
        >
          <ArrowLeft size={13} /> Back to Live
        </Link>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* ============================ STAGE ============================ */}
        <div className="min-w-0">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-zinc-900 via-[#141019] to-zinc-900">
            <div className={`grid aspect-[4/3] sm:aspect-video ${stageCount > 1 ? (stageCount > 2 ? "grid-cols-2 grid-rows-2" : "grid-cols-2") : ""}`}>
              {[{ handle: stream.host.handle, displayName: stream.host.displayName, avatarUrl: stream.host.avatarUrl, role: "Host", isMe: me.isHost },
                ...activeGuests.map((g) => ({ handle: g.handle, displayName: g.displayName, avatarUrl: g.avatarUrl, role: "Guest", isMe: !!user && g.userId === user.id }))].map((p) => (
                <div key={p.handle} className="relative flex flex-col items-center justify-center border border-line-soft/40">
                  {live && p.isMe ? (
                    /* the person broadcasting sees their REAL camera here */
                    <LiveCameraStage displayName={p.displayName} />
                  ) : (
                    <>
                      <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-xl font-bold text-zinc-300 ring-2 ring-red-400/30">
                        {p.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          p.displayName.slice(0, 1)
                        )}
                      </span>
                      <p className="mt-2 text-sm font-semibold text-zinc-200">{p.displayName}</p>
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{p.role}</p>
                      {live && (
                        <span className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] text-zinc-500">
                          <Video size={11} /> on stage
                        </span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="absolute left-3 top-3 flex items-center gap-2">
              {live ? (
                <span className="flex items-center gap-1.5 rounded-md bg-red-500 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live · {uptime(stream.startedAt)}
                </span>
              ) : (
                <span className="rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-300">
                  {stream.replayStatus === "saved" ? "Replay" : "Ended"}
                </span>
              )}
              {live && (
                <span className="flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-zinc-100" data-guide="live-viewer-count">
                  <Eye size={11} /> {stream.viewerCount ?? 0} watching
                </span>
              )}
            </div>
            {live && !(me.isHost || me.guestStatus === "active") && (
              <p className="absolute bottom-2 left-3 max-w-[70%] text-[10px] text-zinc-600">
                Video transmission isn't live yet — presence, chat, and reactions are real-time; the host sees their own camera locally.
              </p>
            )}
          </div>

          {/* title + host row */}
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-zinc-100">{stream.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="rounded-full border border-line px-2 py-0.5">{stream.categoryLabel}</span>
                {stream.campusName && <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-violet-300">{stream.campusName}</span>}
                {stream.communityName && <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-violet-300">{stream.communityName}</span>}
                <span className="text-zinc-600">Audience: {stream.audience}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {stream.sharingEnabled && (
                <button onClick={share} data-guide="live-share" className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600">
                  <Share2 size={13} /> {shared ? "Copied" : "Share"}
                </button>
              )}
              {!me.isHost && (
                <button onClick={() => setShowReport(true)} data-guide="live-report" className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:border-rose-400/50 hover:text-rose-300">
                  <Flag size={13} /> Report
                </button>
              )}
            </div>
          </div>

          <Link href={`/creator/${stream.host.handle}`} className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-card p-3 transition hover:border-zinc-600">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-sm font-bold text-zinc-300">
              {stream.host.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stream.host.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                stream.host.displayName.slice(0, 1)
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-100">{stream.host.displayName}</p>
              <p className="truncate text-xs text-zinc-500">@{stream.host.handle}{stream.host.locationLabel ? ` · ${stream.host.locationLabel}` : ""}</p>
            </div>
            {!me.isHost && user && (
              <button
                onClick={(e) => { e.preventDefault(); follow(); }}
                data-guide="live-follow"
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  me.following ? "border border-line text-zinc-400 hover:border-zinc-600" : "bg-violet-400 text-black hover:bg-violet-300"
                }`}
              >
                {me.following ? "Following" : "Follow"}
              </button>
            )}
          </Link>

          {/* reactions */}
          {live && stream.reactionsEnabled && (
            <div className="mt-3 flex flex-wrap items-center gap-2" data-guide="live-reactions">
              {REACTIONS.map(([type, Icon, tint]) => (
                <button
                  key={type}
                  onClick={() => act("/react", { type })}
                  className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-600 active:scale-95"
                  aria-label={`React ${type}`}
                >
                  <Icon size={14} className={tint} /> {data.reactionCounts[type] ?? 0}
                </button>
              ))}
            </div>
          )}

          {/* guest invite banner (for the invited person) */}
          {live && me.guestStatus === "invited" && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3">
              <p className="text-sm text-zinc-200">{stream.host.displayName} invited you on stage.</p>
              <div className="flex gap-2">
                <button onClick={() => act("/guests", { action: "accept" })} data-guide="live-guest-accept" className="rounded-full bg-red-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-400">Join</button>
                <button onClick={() => act("/guests", { action: "decline" })} className="rounded-full border border-line px-3.5 py-1.5 text-xs text-zinc-400">Not now</button>
              </div>
            </div>
          )}
          {live && me.guestStatus === "active" && !me.isHost && (
            <button onClick={() => act("/guests", { action: "leave" })} className="mt-3 rounded-full border border-line px-3.5 py-1.5 text-xs text-zinc-400 hover:border-zinc-600">
              Leave the stage
            </button>
          )}

          {/* ===================== HOST CONTROLS ===================== */}
          {me.isHost && live && (
            <div className="mt-4 rounded-2xl border border-line bg-card p-4" data-guide="live-host-controls">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Your live controls</p>
                <button
                  onClick={async () => { if (await act("", { action: "end" })) loadDetail(); }}
                  data-guide="live-end"
                  className="rounded-full bg-red-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-400"
                >
                  End stream
                </button>
              </div>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {([["chatEnabled", "Chat"], ["reactionsEnabled", "Reactions"], ["sharingEnabled", "Sharing"], ["guestsEnabled", "Guests"], ["saveReplay", "Save replay at the end"]] as const).map(([k, l]) => (
                  <label key={k} className="flex cursor-pointer items-center justify-between rounded-lg border border-line bg-card-raised px-3 py-2 text-xs text-zinc-300">
                    {l}
                    <input
                      type="checkbox"
                      checked={Boolean(stream[k])}
                      onChange={(e) => act("", { action: "toggle", key: k, value: e.target.checked })}
                      className="accent-red-400"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => setShowInvite(true)} data-guide="live-guest-invite" className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-zinc-600">
                  <UserPlus size={13} /> Invite a guest
                </button>
                <button onClick={openViewers} data-guide="live-viewers-open" className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:border-zinc-600">
                  <Users size={13} /> Viewers
                </button>
              </div>
              {data.guests.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {data.guests.map((g) => (
                    <div key={g.id} className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-1.5 text-xs">
                      <span className="text-zinc-300">{g.displayName} <span className="text-zinc-600">· {g.status === "active" ? "on stage" : "invited"}</span></span>
                      <button onClick={() => act("/guests", { action: "remove", userId: g.userId })} className="text-rose-300 hover:text-rose-200">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!live && endedPanel}
          {!live && !me.isHost && (
            <div className="mt-4 rounded-2xl border border-line bg-card p-5 text-center">
              <p className="text-sm font-semibold text-zinc-300">
                {stream.replayStatus === "saved" ? "You're watching the replay." : "This live has ended."}
              </p>
              {stream.replayStatus === "saved" && (
                <p className="mt-1 text-xs text-zinc-500">Peak {stream.peakViewers} viewer{stream.peakViewers === 1 ? "" : "s"} · chat transcript on the right · video wasn't recorded (media transport pending).</p>
              )}
            </div>
          )}
        </div>

        {/* ============================ CHAT ============================ */}
        <div className="flex h-[70vh] min-h-[420px] flex-col rounded-2xl border border-line bg-card lg:h-auto" data-guide="live-chat">
          <div className="border-b border-line-soft px-3.5 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{live ? "Live chat" : "Chat transcript"}</p>
          </div>
          {data.pinnedMessage && (
            <div className="flex items-start gap-2 border-b border-line-soft bg-amber-400/5 px-3.5 py-2 text-xs" data-guide="live-pinned">
              <Pin size={12} className="mt-0.5 shrink-0 text-amber-300" />
              <p className="text-zinc-300"><span className="font-semibold">{data.pinnedMessage.displayName}:</span> {data.pinnedMessage.body}</p>
              {me.isHost && (
                <button onClick={() => act("", { action: "unpin" })} aria-label="Unpin" className="ml-auto text-zinc-500 hover:text-zinc-300"><X size={12} /></button>
              )}
            </div>
          )}
          <div ref={chatBoxRef} className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
            {msgs.length === 0 && <p className="text-xs text-zinc-600">{live ? "Say hi — you're early." : "No messages in this live."}</p>}
            {msgs.map((m) => (
              <div key={m.id} className="group flex items-start gap-2 text-sm">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-400">
                  {m.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    m.displayName.slice(0, 1)
                  )}
                </span>
                <p className="min-w-0 text-zinc-300">
                  <span className={`mr-1.5 text-xs font-bold ${m.isHost ? "text-red-300" : "text-zinc-400"}`}>
                    {m.displayName}{m.isHost ? " · host" : ""}
                  </span>
                  <span className="break-words text-[13px]">{m.body}</span>
                </p>
                {(me.isHost || me.isModerator) && live && (
                  <span className="ml-auto hidden shrink-0 gap-1 group-hover:flex">
                    {me.isHost && (
                      <button title="Pin" onClick={() => act("", { action: "pin", messageId: m.id })} className="text-zinc-500 hover:text-amber-300"><Pin size={12} /></button>
                    )}
                    <button title="Delete" onClick={() => { act("/moderate", { action: "delete_message", messageId: m.id }); setMsgs((c) => c.filter((x) => x.id !== m.id)); }} className="text-zinc-500 hover:text-rose-300"><Trash2 size={12} /></button>
                    {!m.isHost && (
                      <>
                        <button title="Mute in this live" onClick={() => act("/moderate", { action: "mute", userId: m.userId })} className="text-zinc-500 hover:text-amber-300"><MicOff size={12} /></button>
                        {me.isHost && (
                          <button title="Block from this live" onClick={() => act("/moderate", { action: "block", userId: m.userId })} className="text-zinc-500 hover:text-rose-300"><Ban size={12} /></button>
                        )}
                      </>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
          {live && (
            <div className="border-t border-line-soft p-3">
              {chatErr && <p className="mb-1.5 text-[11px] text-rose-300">{chatErr}</p>}
              {!stream.chatEnabled && !me.isHost ? (
                <p className="text-center text-xs text-zinc-600">The host turned chat off.</p>
              ) : me.muted ? (
                <p className="text-center text-xs text-zinc-600">You're muted in this live.</p>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value.slice(0, 300))}
                    onKeyDown={(e) => e.key === "Enter" && sendChat()}
                    placeholder="Say something…"
                    aria-label="Chat message"
                    data-guide="live-chat-input"
                    className="input-dark flex-1 py-2 text-[13px]"
                  />
                  <button onClick={sendChat} disabled={busy || !chatText.trim()} data-guide="live-chat-send" aria-label="Send" className="rounded-xl bg-red-500 px-3 text-white transition hover:bg-red-400 disabled:opacity-40">
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------- viewers modal (host/mods) ---------- */}
      {showViewers && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-0 bg-black/70 p-4" onClick={() => setShowViewers(false)}>
          <div className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-sm font-bold text-zinc-100">Watching now</p>
            {viewers.length === 0 && <p className="text-xs text-zinc-500">Nobody in the window right now.</p>}
            {viewers.map((v) => (
              <div key={v.userId} className="flex items-center justify-between border-b border-line-soft py-2 text-sm last:border-0">
                <span className="text-zinc-300">
                  {v.displayName}
                  {v.isHost && <span className="ml-1.5 text-[10px] text-red-300">host</span>}
                  {v.isModerator && <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-sky-300"><Shield size={10} /> mod</span>}
                  {v.muted && <span className="ml-1.5 text-[10px] text-amber-300">muted</span>}
                </span>
                {me.isHost && !v.isHost && (
                  <span className="flex gap-2 text-[11px]">
                    <button onClick={() => act("/moderate", { action: v.muted ? "unmute" : "mute", userId: v.userId }).then(openViewers)} className="text-amber-300 hover:text-amber-200">{v.muted ? "Unmute" : "Mute"}</button>
                    <button onClick={() => act("/moderate", { action: v.isModerator ? "remove_mod" : "add_mod", userId: v.userId }).then(openViewers)} className="text-sky-300 hover:text-sky-200">{v.isModerator ? "Remove mod" : "Make mod"}</button>
                    <button onClick={() => act("/moderate", { action: "block", userId: v.userId }).then(openViewers)} className="text-rose-300 hover:text-rose-200">Block</button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- invite modal ---------- */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-0 bg-black/70 p-4" onClick={() => setShowInvite(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-zinc-100">Invite a guest on stage</p>
            <p className="mt-1 text-xs text-zinc-500">Interviews, collabs, tutoring, panels — up to 3 guests.</p>
            <input value={inviteHandle} onChange={(e) => setInviteHandle(e.target.value)} placeholder="@username" aria-label="Guest username" data-guide="live-guest-handle" className="input-dark mt-3" />
            <button
              onClick={async () => { if (await act("/guests", { action: "invite", handle: inviteHandle })) { setShowInvite(false); setInviteHandle(""); } }}
              data-guide="live-guest-send"
              className="mt-3 w-full rounded-full bg-red-500 py-2 text-xs font-bold text-white hover:bg-red-400"
            >
              Send invite
            </button>
          </div>
        </div>
      )}

      {/* ---------- report modal ---------- */}
      {showReport && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-0 bg-black/70 p-4" onClick={() => setShowReport(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-4" onClick={(e) => e.stopPropagation()}>
            {reportDone ? (
              <p className="py-4 text-center text-sm text-zinc-300">Report filed — a human reviews it. Nothing is auto-punished.</p>
            ) : (
              <>
                <p className="text-sm font-bold text-zinc-100">Report this live</p>
                <div className="mt-3 space-y-1.5">
                  {(["safety", "spam", "inappropriate", "impersonation", "privacy", "other"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={async () => {
                        await fetch(`/api/live/${id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target: "stream", category: c }) });
                        setReportDone(true);
                        setTimeout(() => { setShowReport(false); setReportDone(false); }, 1800);
                      }}
                      className="w-full rounded-lg border border-line px-3 py-2 text-left text-xs capitalize text-zinc-300 hover:border-zinc-600"
                    >
                      {c === "privacy" ? "Shares someone's private location/info" : c}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
