"use client";

/* Unboxed composer — posts as the authenticated user, straight to the DB.
   A post is anything worth sharing: work, behind the scenes, an
   announcement, a promotion. Category/subcategory are optional and
   creator-defined — they become the filters on your profile grid. */

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X, ShieldCheck } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useSession } from "@/lib/session";
import { DISCLOSURES, type DisclosureType } from "@/lib/trust";
import { FEED_EVENT } from "./DbFeed";
import ShareSheet from "@/components/ShareSheet";
import Link from "next/link";

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
  // trust & authenticity — disclosure replaces a bare "original work" claim
  const [disclosure, setDisclosure] = useState<string>("unspecified");
  const [credit, setCredit] = useState("");
  const [attested, setAttested] = useState(false);
  const [workLink, setWorkLink] = useState(""); // "project:id" | "booking:id"
  const [myWork, setMyWork] = useState<{ kind: string; id: string; title: string; with: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  // post-publish share moment: the permanent /posts/<id> link, right here
  const [justPosted, setJustPosted] = useState<{ id: string; body: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // fetch completed transactions once the trust panel becomes relevant
  const showTrustPanel = kind === "work" || !!image;
  useEffect(() => {
    if (open && showTrustPanel && myWork === null)
      fetch("/api/me/work", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { work: [] }))
        .then((d) => setMyWork(d.work ?? []));
  }, [open, showTrustPanel, myWork]);

  if (!user) return null;

  const reset = () => {
    setOpen(false);
    setBody("");
    setKind("post");
    setCategory("");
    setSubcategory("");
    setImage(null);
    setDisclosure("unspecified");
    setCredit("");
    setAttested(false);
    setWorkLink("");
  };

  const submit = async () => {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    const [linkKind, linkId] = workLink.split(":");
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: text,
        kind,
        category,
        subcategory,
        imageUrl: image,
        disclosure,
        credit,
        attested,
        projectId: linkKind === "project" ? linkId : undefined,
        bookingId: linkKind === "booking" ? linkId : undefined,
      }),
    });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      setJustPosted({ id: d.id, body: text.slice(0, 80) });
      reset();
      window.dispatchEvent(new Event(FEED_EVENT));
    }
  };

  return (
    <section className="border-y border-line-soft py-3">
      {justPosted && (
        <div className="mb-3 rounded-2xl border border-lime-400/40 bg-lime-400/5 p-3.5">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold text-lime-300">Posted.</span>
            <span className="text-xs text-zinc-400">It&apos;s in the feed and on your profile — want to share it further?</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <ShareSheet path={`/posts/${justPosted.id}`} title={`${user?.profile.displayName ?? "New post"} on UpNova`} text={justPosted.body} compact />
            <Link href={`/posts/${justPosted.id}`} className="btn-ghost px-3 py-1.5 text-xs">View post</Link>
            <button onClick={() => setJustPosted(null)} className="ml-auto rounded-full px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300">Dismiss</button>
          </div>
        </div>
      )}
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

            {/* ---- trust & context — appears when you're showing work ---- */}
            {showTrustPanel && (
              <div className="mt-2 rounded-xl border border-line-soft bg-card-raised/50 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  <ShieldCheck className="h-3 w-3" /> Content disclosure
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(Object.keys(DISCLOSURES) as DisclosureType[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDisclosure(d)}
                      title={DISCLOSURES[d].hint}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                        disclosure === d
                          ? "border-violet-400/50 bg-violet-400/10 text-violet-300"
                          : "border-line text-zinc-500 hover:border-zinc-600"
                      }`}
                    >
                      {DISCLOSURES[d].label}
                    </button>
                  ))}
                </div>
                {disclosure === "credited" && (
                  <input
                    value={credit}
                    onChange={(e) => setCredit(e.target.value)}
                    placeholder="Who made it? (e.g. Photography: Ava Chen)"
                    maxLength={80}
                    className="mt-2 w-full rounded-full border border-line bg-card px-3 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
                  />
                )}

                <label className="mt-2.5 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-400">
                  <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-0.5 accent-lime-400" />
                  <span>
                    I have the right to publish this and I&apos;m not presenting someone else&apos;s work as my
                    own. <span className="text-zinc-600">Shown as &quot;Creator Attested&quot; — your claim, labeled as one.</span>
                  </span>
                </label>

                {myWork && myWork.length > 0 && (
                  <div className="mt-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Link to completed UpNova work (optional)</p>
                    <select
                      value={workLink}
                      onChange={(e) => setWorkLink(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-violet-400/50"
                    >
                      <option value="">No link</option>
                      {myWork.map((w) => (
                        <option key={`${w.kind}:${w.id}`} value={`${w.kind}:${w.id}`}>
                          {w.title} — with {w.with}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">
                      Adds a <span className="text-lime-300">Verified Work</span> label (UpNova checked the
                      transaction). {workLink ? "The client will be asked to confirm it happened — that adds Client Confirmed." : ""}
                    </p>
                  </div>
                )}
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
