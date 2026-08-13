"use client";

/* ------------------------------------------------------------------ */
/*  ShareSheet — post-publish sharing for every publishable type.      */
/*  The Mavyn URL is permanent and canonical: sharing drives people   */
/*  BACK to the real post/opportunity/service/product/work — never a   */
/*  disconnected copy. Native device sharing where available           */
/*  (navigator.share), universal web intents + copy-link everywhere    */
/*  else. No one has to leave Mavyn to get their link.                */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { Share2, Link2, Check, Mail, MessageCircle } from "lucide-react";

/* Callers truncate user text with String.slice(), which can cut an emoji
   (surrogate pair) in half. A lone surrogate makes encodeURIComponent
   throw "URI malformed" and crash the whole page render — so every
   string leaving this component gets scrubbed to well-formed Unicode. */
const wellFormed = (s: string) =>
  typeof (s as unknown as { toWellFormed?: () => string }).toWellFormed === "function"
    ? (s as unknown as { toWellFormed: () => string }).toWellFormed().replace(/\uFFFD+$/, "").trimEnd()
    : s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "").replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "$1").trimEnd();

export default function ShareSheet({
  path,
  title,
  text,
  compact = false,
}: {
  /** site-relative permanent URL, e.g. /services/abc123 */
  path: string;
  title: string;
  text?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [canNative, setCanNative] = useState(false);
  const [url, setUrl] = useState(path);

  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
    setCanNative(typeof navigator !== "undefined" && !!navigator.share);
  }, [path]);

  const safeTitle = wellFormed(title);
  const safeText = text ? wellFormed(text) : "";
  const message = safeText ? `${safeTitle} — ${safeText}` : safeTitle;

  const native = async () => {
    try {
      await navigator.share({ title: safeTitle, text: message, url });
    } catch {
      /* user dismissed — nothing to handle */
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const intents = [
    { label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  ];

  return (
    <div className={compact ? "flex flex-wrap items-center gap-1.5" : "flex flex-wrap items-center justify-center gap-1.5"}>
      {canNative && (
        <button onClick={native} className="btn-lime px-3.5 py-1.5 text-xs">
          <Share2 className="h-3.5 w-3.5" /> Share…
        </button>
      )}
      <button onClick={copy} className={canNative ? "btn-ghost px-3 py-1.5 text-xs" : "btn-lime px-3.5 py-1.5 text-xs"}>
        {copied ? <Check className="h-3.5 w-3.5 text-lime-300" /> : <Link2 className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>
      {intents.map((i) => (
        <a key={i.label} href={i.href} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-1.5 text-xs">
          {i.label === "WhatsApp" ? <MessageCircle className="h-3.5 w-3.5" /> : null}
          {i.label}
        </a>
      ))}
      <a
        href={`mailto:?subject=${encodeURIComponent(safeTitle)}&body=${encodeURIComponent(`${message}\n\n${url}`)}`}
        className="btn-ghost px-3 py-1.5 text-xs"
      >
        <Mail className="h-3.5 w-3.5" /> Email
      </a>
    </div>
  );
}

/* Dismissible "just published" banner for detail pages reached with
   ?published=1 — the item is live; here's how to tell people. */
export function PublishedBanner({ path, title, text }: { path: string; title: string; text?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("published")) {
      setShow(true);
      window.history.replaceState(null, "", window.location.pathname); // one-shot
    }
  }, []);
  if (!show) return null;
  return (
    <div className="rounded-2xl border border-lime-400/40 bg-lime-400/5 p-4">
      <p className="text-sm font-bold text-lime-300">Published — it&apos;s live.</p>
      <p className="mt-0.5 text-xs text-zinc-400">
        This page is its permanent link. Share it anywhere — people land right here.
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <ShareSheet path={path} title={title} text={text} compact />
        <button onClick={() => setShow(false)} className="ml-auto rounded-full px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          Dismiss
        </button>
      </div>
    </div>
  );
}
