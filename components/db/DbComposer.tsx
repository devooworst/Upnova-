"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import { useSession } from "@/lib/session";
import { FEED_EVENT } from "./DbFeed";

/** Unboxed composer — posts as the authenticated user, straight to the DB. */
export default function DbComposer() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const submit = async () => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    setBusy(false);
    if (res.ok) {
      setBody("");
      setOpen(false);
      window.dispatchEvent(new Event(FEED_EVENT));
    }
  };

  return (
    <section className="border-y border-line-soft py-3">
      <div className="flex items-center gap-3">
        <Avatar src={user.profile.avatarUrl} initials={user.profile.displayName.charAt(0)} size="sm" />
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="min-w-0 flex-1 truncate rounded-full border border-line bg-card px-4 py-2 text-left text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-400"
          >
            What&apos;s happening near you?
          </button>
        ) : (
          <div className="min-w-0 flex-1">
            <textarea
              autoFocus
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="What's happening near you?"
              className="w-full resize-none rounded-xl border border-line bg-card px-4 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
            />
            <div className="mt-1.5 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setOpen(false);
                  setBody("");
                }}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!body.trim() || busy}
                className="btn-lime px-4 py-1.5 text-xs disabled:opacity-40"
              >
                Post
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
