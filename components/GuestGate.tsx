"use client";

/* ------------------------------------------------------------------ */
/*  Guest access system — the CLIENT half.                             */
/*                                                                     */
/*  Three states: Guest → Member → Verified / Professional / Business. */
/*  A guest can LOOK (limited public content, privacy settings intact).*/
/*  A member can PARTICIPATE. Verification adds capabilities on top —  */
/*  and is never granted by a subscription.                            */
/*                                                                     */
/*  This file is UX only. Every create/interact endpoint requires a    */
/*  session server-side (requireUser) — hiding buttons is presentation,*/
/*  never the access control.                                          */
/*                                                                     */
/*  Two pieces:                                                        */
/*   · promptJoin(action) → contextual sign-up modal ("Create an       */
/*     account to book", not a generic wall)                           */
/*   · GuestMeter → after a reasonable amount of browsing, ONE         */
/*     dismissible banner per session. Let them see the product first. */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Sparkles } from "lucide-react";
import { useSession } from "@/lib/session";

export type JoinAction =
  | "book"
  | "hire"
  | "apply"
  | "like"
  | "comment"
  | "save"
  | "follow"
  | "message"
  | "create"
  | "buy"
  | "tickets"
  | "personalize"
  | "report"
  | "explore";

const JOIN_EVENT = "upnova:join-prompt";

/**
 * Open the contextual sign-up prompt from anywhere.
 * `next` is where the user should land AFTER creating an account or
 * signing in — e.g. `/services?book=<id>` resumes the exact booking they
 * attempted. Defaults to the current page.
 */
export function promptJoin(action: JoinAction, next?: string) {
  window.dispatchEvent(new CustomEvent<{ action: JoinAction; next?: string }>(JOIN_EVENT, { detail: { action, next } }));
}

/* contextual copy — the prompt explains WHY an account is needed for
   THIS action, never a generic "sign up" wall */
const COPY: Record<JoinAction, { title: string; body: string }> = {
  book: {
    title: "Create an account to book",
    body: "It's free to join UpNova — and you'll manage your bookings, messages, and payments in one place.",
  },
  hire: {
    title: "Create an account to send a request",
    body: "Project requests open a real conversation with the creator, with terms and payment protected on-platform.",
  },
  apply: {
    title: "Create an account to apply",
    body: "Your UpNova profile becomes your application — you won't have to re-enter the same information every time.",
  },
  like: {
    title: "Create an account to like posts",
    body: "Likes support creators and teach your feed what you're into.",
  },
  comment: {
    title: "Create an account to join the conversation",
    body: "Comments come from real accounts — that's what keeps threads worth reading.",
  },
  save: {
    title: "Create an account to save",
    body: "Bookmarks keep posts, services, and opportunities in one place so you can come back to them.",
  },
  follow: {
    title: "Create an account to follow creators",
    body: "Following builds your own feed — new work from people you choose, in one stream.",
  },
  message: {
    title: "Create an account to message people",
    body: "Messages, bookings, and payments live in one thread — that requires knowing who you are.",
  },
  create: {
    title: "Join UpNova to create",
    body: "Create posts, offer services, publish opportunities, build your profile, and connect with people.",
  },
  buy: {
    title: "Create an account to buy",
    body: "Orders, payments, tracking, and the seller conversation live on your account — with funds held until delivery.",
  },
  tickets: {
    title: "Create an account to get tickets",
    body: "Your tickets live on your account — no lost links, no re-entering details.",
  },
  personalize: {
    title: "Create an account to shape your feed",
    body: "Hide, Not Interested, and For You ranking are built from your own activity — they need an account to belong to.",
  },
  report: {
    title: "Create an account to report",
    body: "Reports go to human review and need an accountable reporter — that protects the people being reported too.",
  },
  explore: {
    title: "You're exploring UpNova as a guest",
    body: "Create a free account to keep exploring, follow creators, save posts, message people, book services, and apply to opportunities.",
  },
};

/** How many page views a guest gets before the one soft banner. */
const BROWSE_BUDGET = 6;

export default function GuestGate() {
  const { user } = useSession();
  const pathname = usePathname();
  const [action, setAction] = useState<JoinAction | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [banner, setBanner] = useState(false);

  /* contextual modal, opened by promptJoin() anywhere in the app */
  useEffect(() => {
    const open = (e: Event) => {
      const detail = (e as CustomEvent<{ action: JoinAction; next?: string }>).detail;
      setAction(detail.action);
      setNext(detail.next ?? null);
    };
    window.addEventListener(JOIN_EVENT, open);
    return () => window.removeEventListener(JOIN_EVENT, open);
  }, []);

  /* soft browse meter — counts guest page views in sessionStorage;
     shows ONE dismissible banner per session, never a hard wall */
  useEffect(() => {
    if (user !== null) return; // signed in or still loading
    if (["/login", "/signup", "/forgot", "/reset", "/welcome"].some((p) => pathname?.startsWith(p))) return;
    try {
      if (sessionStorage.getItem("upnova-guest-banner") === "done") return;
      const n = Number(sessionStorage.getItem("upnova-guest-views") || "0") + 1;
      sessionStorage.setItem("upnova-guest-views", String(n));
      if (n >= BROWSE_BUDGET) setBanner(true);
    } catch {
      /* storage unavailable — never block browsing over it */
    }
  }, [pathname, user]);

  const dismissBanner = useCallback(() => {
    setBanner(false);
    try {
      sessionStorage.setItem("upnova-guest-banner", "done");
    } catch {}
  }, []);

  // the moment a session exists, everything here disappears
  if (user) return null;

  const copy = action ? COPY[action] : null;
  // where auth should return the user: the attempted action's resume URL,
  // else the page they're on right now — never a dead-end at Home
  const returnTo =
    next ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
  const q = `?next=${encodeURIComponent(returnTo)}`;

  return (
    <>
      {/* ---------- contextual join modal ---------- */}
      {copy && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setAction(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-line bg-card p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
                <Sparkles className="h-5 w-5 text-lime-400" />
              </span>
              <button onClick={() => setAction(null)} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="mt-3 text-base font-bold tracking-tight text-zinc-50">{copy.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{copy.body}</p>
            <div className="mt-4 space-y-2">
              <Link href={`/signup${q}`} className="btn-lime w-full justify-center py-2.5 text-sm" onClick={() => setAction(null)}>
                Create free account
              </Link>
              <p className="text-center text-xs text-zinc-500">
                Already have an account?{" "}
                <Link href={`/login${q}`} className="font-semibold text-zinc-300 underline-offset-2 hover:underline" onClick={() => setAction(null)}>
                  Sign in
                </Link>
              </p>
              <p className="text-center text-[10px] text-zinc-600">You&apos;ll come right back to what you were doing.</p>
            </div>
          </div>
        </div>
      )}

      {/* ---------- one soft banner after real browsing ---------- */}
      {banner && !copy && (
        <div className="fixed inset-x-0 bottom-16 z-50 px-3 md:bottom-4">
          <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-card">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-zinc-100">You&apos;re exploring UpNova as a guest.</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                Create a free account to keep exploring, follow creators, save posts, message people, book
                services, and apply to opportunities.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href={`/signup${q}`} className="btn-lime px-4 py-2 text-xs" onClick={dismissBanner}>
                Create account
              </Link>
              <Link href={`/login${q}`} className="btn-ghost px-3.5 py-2 text-xs" onClick={dismissBanner}>
                Sign in
              </Link>
              <button onClick={dismissBanner} className="rounded-md p-1.5 text-zinc-500 hover:text-zinc-200" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
