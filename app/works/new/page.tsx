"use client";

/* ------------------------------------------------------------------ */
/*  Publish a work — YOUR license options, YOUR preview rules.         */
/*  Presets are starting points, never requirements. The original      */
/*  file is never uploaded here: previews stream, delivery happens     */
/*  after licensing, in the conversation.                              */
/* ------------------------------------------------------------------ */

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Disc3, ImagePlus, Music, X, Plus } from "lucide-react";
import { useSession } from "@/lib/session";
import { WORK_KINDS, LICENSE_TYPES, LICENSE_PRESETS, type LicenseOption, type WorkKind } from "@/lib/licensing";

const inputCls =
  "w-full rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-lime-400/50";

export default function NewWorkPage() {
  const router = useRouter();
  const { user } = useSession();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<WorkKind>("beat");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [previewLength, setPreviewLength] = useState("30");
  const [watermarked, setWatermarked] = useState(true);
  const [options, setOptions] = useState<LicenseOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const previewInput = useRef<HTMLInputElement>(null);

  const addPreset = (i: number) =>
    setOptions((o) => [...o, { ...LICENSE_PRESETS[i], id: Math.random().toString(36).slice(2, 10) }]);
  const patch = (id: string, p: Partial<LicenseOption>) =>
    setOptions((o) => o.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const submit = async () => {
    setError(null);
    if (!title.trim()) return setError("Name the work");
    if (options.filter((o) => o.name.trim()).length === 0)
      return setError("Offer at least one license option — your terms, your prices");
    setBusy(true);
    const res = await fetch("/api/works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, kind, description,
        coverUrl: cover, previewUrl: preview,
        previewLength: Number(previewLength) || 30,
        watermarked,
        options: options.filter((o) => o.name.trim()),
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not publish");
      if (res.status === 401) router.push("/login");
      return;
    }
    router.push(`/works/${d.id}`);
  };

  if (!user)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold text-zinc-200">Join UpNova to license your work</p>
        <Link href="/signup?next=%2Fworks%2Fnew" className="btn-lime mt-4 inline-flex px-5 py-2 text-sm">Create free account</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-10">
      <div>
        <Link href="/works" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Works
        </Link>
        <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
            <Disc3 className="h-5 w-5 text-lime-400" />
          </span>
          Publish a work
        </h1>
      </div>

      <section className="card space-y-3 p-5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Title — e.g. "Midnight Run" 140bpm' className={inputCls} maxLength={80} autoFocus />
        <div className="flex flex-wrap gap-1.5">
          {WORK_KINDS.map((k) => (
            <button key={k.id} onClick={() => setKind(k.id)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${kind === k.id ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
              {k.label}
            </button>
          ))}
        </div>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="BPM, key, mood, what it's for…" className={`${inputCls} resize-none`} />
        <div className="flex flex-wrap items-center gap-2">
          {cover ? (
            <span className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt="Cover" className="h-16 w-16 rounded-xl border border-line object-cover" />
              <button onClick={() => setCover(null)} className="absolute -right-1.5 -top-1.5 rounded-full border border-line bg-ink p-0.5 text-zinc-400"><X className="h-3 w-3" /></button>
            </span>
          ) : (
            <button onClick={() => coverInput.current?.click()} className="btn-ghost px-3 py-2 text-xs"><ImagePlus className="h-4 w-4" /> Cover</button>
          )}
          <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setCover(String(r.result)); r.readAsDataURL(f); } e.target.value = ""; }} />
        </div>
      </section>

      {/* preview — streaming, not the source file */}
      <section className="card space-y-3 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Preview</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600">
            People stream a preview — the original file is never posted here. You deliver it after
            licensing, in the conversation. (Previews reduce unauthorized use; nothing makes audio
            impossible to record. Your license terms and records are the real protection.)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => previewInput.current?.click()} className="btn-ghost px-3 py-2 text-xs">
            <Music className="h-4 w-4" /> {previewName || "Upload preview clip (audio/image)"}
          </button>
          <input ref={previewInput} type="file" accept="audio/*,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.size > 650_000) { setError("Preview clip must be under ~650KB — export a short low-bitrate clip"); } else { const r = new FileReader(); r.onload = () => { setPreview(String(r.result)); setPreviewName(f.name); setError(null); }; r.readAsDataURL(f); } } e.target.value = ""; }} />
          <label className="flex items-center gap-1.5 text-xs text-zinc-400">
            Length
            <select value={previewLength} onChange={(e) => setPreviewLength(e.target.value)} className={`${inputCls} w-auto py-1.5`}>
              {[15, 30, 45, 60, 90].map((s) => <option key={s} value={s}>{s}s</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input type="checkbox" checked={watermarked} onChange={(e) => setWatermarked(e.target.checked)} className="accent-lime-400" />
            Tagged / watermarked preview
          </label>
        </div>
      </section>

      {/* license options — the creator's own terms */}
      <section className="card space-y-3 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">License options</p>
          <p className="mt-0.5 text-[11px] text-zinc-600">
            Your terms, your prices. Presets below are starting points — edit everything.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LICENSE_PRESETS.map((p, i) => (
            <button key={p.name} onClick={() => addPreset(i)} className="rounded-full border border-line px-3 py-1.5 text-xs text-zinc-400 transition hover:border-lime-400/40 hover:text-lime-300">
              <Plus className="mr-1 inline h-3 w-3" />{p.name}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {options.map((o) => (
            <div key={o.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input value={o.name} onChange={(e) => patch(o.id, { name: e.target.value })} placeholder="Option name" className={`${inputCls} min-w-[140px] flex-1 py-1.5 text-xs`} maxLength={50} />
                <select value={o.type} onChange={(e) => patch(o.id, { type: e.target.value as LicenseOption["type"] })} className={`${inputCls} w-auto py-1.5 text-xs`}>
                  {LICENSE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <label className="flex items-center gap-1 text-xs text-zinc-400">
                  $<input value={o.price ?? ""} onChange={(e) => patch(o.id, { price: e.target.value === "" ? null : Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })} placeholder="quote" className={`${inputCls} w-20 py-1.5 text-xs`} />
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <input type="checkbox" checked={o.attribution} onChange={(e) => patch(o.id, { attribution: e.target.checked })} className="accent-lime-400" />
                  Attribution
                </label>
                <button onClick={() => setOptions((x) => x.filter((y) => y.id !== o.id))} className="rounded-md p-1 text-zinc-500 hover:text-rose-300"><X className="h-3.5 w-3.5" /></button>
              </div>
              <input value={o.usage} onChange={(e) => patch(o.id, { usage: e.target.value })} placeholder="Permitted usage — what the licensee CAN do" className={`${inputCls} mt-2 py-1.5 text-xs`} maxLength={300} />
              <input value={o.restrictions} onChange={(e) => patch(o.id, { restrictions: e.target.value })} placeholder="Restrictions — what's NOT allowed" className={`${inputCls} mt-1.5 py-1.5 text-xs`} maxLength={300} />
            </div>
          ))}
          {options.length === 0 && (
            <p className="rounded-xl border border-dashed border-line px-3.5 py-3 text-xs text-zinc-500">
              Add options above — e.g. a free demo tier, a commercial lease, an exclusive.
            </p>
          )}
        </div>
      </section>

      {error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Link href="/works" className="btn-ghost px-4 py-2 text-sm">Cancel</Link>
        <button onClick={submit} disabled={busy} className="btn-lime px-5 py-2 text-sm disabled:opacity-50">
          {busy ? "Publishing…" : "Publish work"}
        </button>
      </div>
    </div>
  );
}
