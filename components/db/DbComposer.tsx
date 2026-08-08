"use client";

/* Unboxed composer — posts as the authenticated user, straight to the DB.
   A post is anything worth sharing: work, behind the scenes, an
   announcement, a promotion. Category/subcategory are optional and
   creator-defined — they become the filters on your profile grid. */

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useSession } from "@/lib/session";
import { FEED_EVENT } from "./DbFeed";

const KINDS = [
  { id: "post", label: "Post" },
  { id: "work", label: "Work" },
  { id: "bts", label: "Behind the scenes" },
  { id: "announcement", label: "Announcement" },
  { id: "promotion", label: "Promotion" },
] as const;

function readImage(file: File, maxW: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DbComposer() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<string>("post");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const reset = () => {
    setOpen(false);
    setBody("");
    setKind("post");
    setCategory("");
    setSubcategory("");
    setImage(null);
  };

  const submit = async () => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text, kind, category, subcategory, imageUrl: image }),
    });
    setBusy(false);
    if (res.ok) {
      reset();
      window.dispatchEvent(new Event(FEED_EVENT));
    }
  };

  return (
    <section className="border-y border-line-soft py-3">
      <div className="flex items-start gap-3">
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

            {/* what kind of post is this? */}
            <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setKind(k.id)}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    kind === k.id
                      ? "border-violet-400/50 bg-violet-400/10 text-violet-300"
                      : "border-line text-zinc-500 hover:border-zinc-600"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>

            {/* creator-defined category → becomes a profile grid filter */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category (optional — e.g. Hair, Beats)"
                maxLength={30}
                className="w-44 rounded-full border border-line bg-card px-3 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
              />
              {category && (
                <input
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  placeholder="Subcategory (e.g. Knotless Braids)"
                  maxLength={40}
                  className="w-52 rounded-full border border-line bg-card px-3 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
                />
              )}
              <button
                onClick={() => fileInput.current?.click()}
                title="Add a photo"
                className="ml-auto flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
              >
                <ImagePlus className="h-3.5 w-3.5" /> Photo
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setImage(await readImage(f, 1200));
                  e.target.value = "";
                }}
              />
            </div>

            {image && (
              <div className="relative mt-2 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Upload preview" className="max-h-40 rounded-xl border border-line" />
                <button
                  onClick={() => setImage(null)}
                  className="absolute -right-2 -top-2 rounded-full border border-line bg-ink p-1 text-zinc-400 hover:text-rose-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="mt-2 flex items-center justify-end gap-2">
              <button onClick={reset} className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-300">
                Cancel
              </button>
              <button onClick={submit} disabled={!body.trim() || busy} className="btn-lime px-4 py-1.5 text-xs disabled:opacity-40">
                Post
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
