"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  CalendarCheck,
  ShoppingBag,
  Briefcase,
  FolderKanban,
  MessageSquare,
  Check,
  RefreshCw,
} from "lucide-react";
import { useSession } from "@/lib/session";

/* ------------------------------------------------------------------ */
/* Activity — the centralized live view of everything in motion:       */
/* service bookings, purchases, projects, and opportunity              */
/* applications, each with its own stage chain. Compact progress in    */
/* the row; click a row to open the full timeline. Data comes from     */
/* /api/activity (the same records the product writes) and refreshes   */
/* live — nothing here is static UI.                                   */
/* ------------------------------------------------------------------ */

interface Item {
  kind: "booking" | "purchase" | "project" | "application";
  id: string;
  title: string;
  myRole: string;
  with: { id: string; handle: string; displayName: string };
  status: string;
  stageIndex: number;
  stages: string[];
  startsAt?: string;
  amount: number | null;
  paymentStatus: string | null;
  conversationId: string | null;
  href: string;
  events?: { label: string; at: string }[];
  updatedAt: string;
}
interface Payload {
  bookings: Item[];
  purchases: Item[];
  projects: Item[];
  applications: Item[];
  paymentSummary: { heldOut: number; heldIn: number; releasedIn: number; releasedOut: number };
}

const KIND_META = {
  booking: { label: "Bookings & Services", icon: CalendarCheck, color: "text-lime-400" },
  project: { label: "Projects", icon: FolderKanban, color: "text-lime-400" },
  purchase: { label: "Purchases", icon: ShoppingBag, color: "text-sky-400" },
  application: { label: "Opportunities", icon: Briefcase, color: "text-amber-400" },
} as const;

const timeAgo = (iso: string) => {
  const sec = (Date.now() - Date.parse(iso)) / 1000;
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
};
/** the operational question: does this need YOUR next move right now? */
const attentionFor = (i: Item): string | null => {
  if (i.kind === "booking") {
    if (i.status === "accepted" && i.myRole === "client") return "Pay to confirm";
    if (i.status === "pending" && i.myRole === "provider") return "Respond to request";
    if (i.status === "reschedule_requested") return "Reschedule proposed";
  }
  if (i.kind === "purchase") {
    if (i.status === "placed" && i.myRole === "buyer") return "Pay to start";
    if (i.status === "paid" && i.myRole === "seller") return "Prepare & ship";
    if (i.status === "delivered" && i.myRole === "buyer") return "Confirm received";
  }
  if (i.kind === "project") {
    if (i.status === "submitted" && i.myRole === "client") return "Review delivery";
    if (i.status === "offer_sent" && i.myRole === "client") return "Review offer";
    if (i.status === "extension_requested" && i.myRole === "client") return "Extension requested";
  }
  return null;
};

const doneIndex = (i: Item) => i.stages.length - 1;
const isDone = (i: Item) => i.stageIndex >= doneIndex(i);
const isCancelled = (i: Item) => i.stageIndex < 0;
const isUpcoming = (i: Item) =>
  i.kind === "booking" && !isDone(i) && !isCancelled(i) && !!i.startsAt && Date.parse(i.startsAt) > Date.now();

function CompactBar({ item }: { item: Item }) {
  if (isCancelled(item))
    return <span className="rounded-full border border-red-500/30 px-2 py-0.5 text-[9px] font-bold uppercase text-red-300">{item.status.replace("_", " ")}</span>;
  return (
    <span className="flex items-center gap-0.5" title={`${item.stages[Math.min(item.stageIndex, doneIndex(item))]} (${item.stageIndex + 1}/${item.stages.length})`}>
      {item.stages.map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i < item.stageIndex ? "w-2.5 bg-lime-400/50" : i === item.stageIndex ? "w-4 bg-lime-400" : "w-2.5 bg-zinc-800"
          }`}
        />
      ))}
    </span>
  );
}

function Timeline({ item }: { item: Item }) {
  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      <ol className="space-y-1.5">
        {item.stages.map((label, i) => {
          const done = i < item.stageIndex;
          const current = i === item.stageIndex;
          return (
            <li key={label} className="flex items-center gap-2.5 text-xs">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  done ? "border-lime-400/40 bg-lime-400/15 text-lime-300" : current ? "border-lime-400 bg-lime-400 text-zinc-950" : "border-zinc-700 text-zinc-700"
                }`}
              >
                {done ? <Check className="h-2.5 w-2.5" /> : <span className="h-1 w-1 rounded-full bg-current" />}
              </span>
              <span className={done ? "text-zinc-500" : current ? "font-semibold text-zinc-100" : "text-zinc-600"}>{label}</span>
              {current && <span className="rounded-full bg-lime-400/10 px-1.5 py-px font-mono text-[8px] font-bold uppercase tracking-wide text-lime-300">now</span>}
            </li>
          );
        })}
      </ol>
      {item.events && item.events.length > 0 && (
        <div className="mt-3 rounded-lg border border-line bg-card-raised p-2.5">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Recorded events</p>
          {item.events.map((e, i) => (
            <p key={i} className="mt-1 text-[11px] text-zinc-400">
              <span className="font-mono text-[9px] text-zinc-600">{new Date(e.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>{" "}
              — {e.label}
            </p>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-semibold">
        {item.conversationId && (
          <Link href={`/messages?c=${item.conversationId}`} className="flex items-center gap-1 text-sky-300 hover:underline">
            <MessageSquare className="h-3 w-3" /> Conversation with {item.with.displayName}
          </Link>
        )}
        <Link href={item.href} className="text-zinc-300 hover:underline">Open record →</Link>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const { user } = useSession();
  const [data, setData] = useState<Payload | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [bucket, setBucket] = useState<"active" | "upcoming" | "completed" | "all">("active");

  const load = () =>
    fetch("/api/activity", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.bookings && setData(d))
      .catch(() => {});

  useEffect(() => {
    if (!user) return;
    load();
    const iv = setInterval(load, 10_000); // live refresh
    return () => clearInterval(iv);
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps

  // deep link: /activity?focus=<kind>:<id> opens that timeline
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("focus");
    if (f) {
      setOpen(f);
      setBucket("all");
    }
  }, []);

  if (user === undefined)
    return <div className="mx-auto max-w-3xl pt-10" aria-busy="true"><div className="h-8 w-52 animate-pulse rounded bg-card-raised" /><div className="mt-4 h-40 animate-pulse rounded-xl bg-card-raised" /></div>;
  if (user === null)
    return (
      <div className="mx-auto max-w-md pt-12 text-center">
        <h1 className="text-xl font-bold text-zinc-50">Your activity lives here</h1>
        <p className="mt-2 text-sm text-zinc-500">Bookings, purchases, projects, and applications — sign in to see them.</p>
        <Link href="/login" className="btn-lime mt-4 inline-flex px-6 py-2 text-sm">Sign in</Link>
      </div>
    );

  const groups: { kind: keyof typeof KIND_META; items: Item[] }[] = data
    ? [
        { kind: "booking", items: data.bookings },
        { kind: "project", items: data.projects },
        { kind: "purchase", items: data.purchases },
        { kind: "application", items: data.applications },
      ]
    : [];

  const inBucket = (i: Item) =>
    bucket === "all" ? true
    : bucket === "completed" ? isDone(i) || isCancelled(i)
    : bucket === "upcoming" ? isUpcoming(i)
    : !isDone(i) && !isCancelled(i); // active

  const ps = data?.paymentSummary;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10"><ActivityIcon className="h-5 w-5 text-lime-400" /></span>
            Activity
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            What&apos;s happening right now — live workflows, money in motion, and the next action
            that needs you. (Performance over time lives in Analytics.)
          </p>
        </div>
        <button onClick={load} className="btn-ghost px-3 py-1.5 text-xs"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
      </header>

      {ps && (ps.heldOut > 0 || ps.heldIn > 0 || ps.releasedIn > 0 || ps.releasedOut > 0) && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "secured (paying)", v: ps.heldOut, c: "text-amber-300" },
            { label: "secured (incoming)", v: ps.heldIn, c: "text-amber-300" },
            { label: "released to you", v: ps.releasedIn, c: "text-lime-400" },
            { label: "paid out", v: ps.releasedOut, c: "text-zinc-300" },
          ].map((x) => (
            <div key={x.label} className="card p-3">
              <p className={`text-lg font-extrabold tabular-nums tracking-tight ${x.c}`}>${x.v}</p>
              <p className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-500">{x.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        {(["active", "upcoming", "completed", "all"] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBucket(b)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${
              bucket === b ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {data === null ? (
        <div className="card h-40 animate-pulse" />
      ) : (
        groups.map(({ kind, items }) => {
          const meta = KIND_META[kind];
          const visible = items.filter(inBucket);
          if (visible.length === 0) return null;
          return (
            <section key={kind} className="card overflow-hidden">
              <p className="flex items-center gap-2 border-b border-line-soft px-4 py-2.5 text-sm font-bold text-zinc-100">
                <meta.icon className={`h-4 w-4 ${meta.color}`} /> {meta.label}
                <span className="ml-auto font-mono text-[10px] text-zinc-600">{visible.length}</span>
              </p>
              <ul className="divide-y divide-line-soft">
                {[...visible]
                  .sort((a, b) => (attentionFor(b) ? 1 : 0) - (attentionFor(a) ? 1 : 0))
                  .map((i) => {
                  const key = `${i.kind}:${i.id}`;
                  const expanded = open === key;
                  const attn = attentionFor(i);
                  const lastAt = i.events?.length ? i.events[i.events.length - 1].at : i.updatedAt;
                  return (
                    <li key={key} className="px-4 py-3">
                      <button onClick={() => setOpen(expanded ? null : key)} className="flex w-full items-center gap-3 text-left">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-100">
                            <span className="truncate">{i.title}</span>
                            {attn && (
                              <span className="shrink-0 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
                                {attn}
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                            {i.myRole} · with {i.with.displayName} (@{i.with.handle})
                            {i.startsAt ? ` · ${new Date(i.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                            {i.amount != null ? ` · $${i.amount}` : ""}
                            {i.paymentStatus ? ` · payment ${i.paymentStatus} (test)` : ""}
                            <span className="text-zinc-600"> · updated {timeAgo(lastAt)}</span>
                          </p>
                        </div>
                        <CompactBar item={i} />
                      </button>
                      {expanded && <Timeline item={i} />}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      {data && groups.every((g) => g.items.filter(inBucket).length === 0) && (
        <div className="card p-8 text-center text-sm text-zinc-500">
          Nothing {bucket === "all" ? "yet" : bucket} — book a service, buy something, or apply to an opportunity and it appears here live.
        </div>
      )}
    </div>
  );
}
