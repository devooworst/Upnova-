"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Undo2,
  Redo2,
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  LayoutTemplate,
  X,
  Paintbrush,
  Image as ImageIcon,
  Trash2,
  Lock,
} from "lucide-react";
import DbCreatorProfile from "@/components/db/DbCreatorProfile";
import { useSession } from "@/lib/session";
import {
  ENVIRONMENTS,
  BANNERS,
  DECORATIONS,
  DEFAULT_STUDIO,
  DEFAULT_WORLD,
  type StudioConfig,
  type WorldConfig,
} from "@/lib/profileStudio";

/* ------------------------------------------------------------------ */
/* MY WORLD — full-screen Edit Mode.                                   */
/*                                                                     */
/* THE RULE: this is the SAME full-size profile composition the owner  */
/* sees on their profile and visitors see publicly — same renderer,    */
/* same saved config, same banner — with editing controls layered on.  */
/* Click a card → handles appear → drag/resize directly. No abstract   */
/* canvas, no diagram, no second representation.                       */
/* ------------------------------------------------------------------ */

export default function MyWorldEditor() {
  const { user } = useSession();
  const router = useRouter();

  const [cfg, setCfg] = useState<StudioConfig | null>(null);
  const [cover, setCover] = useState<{ url: string | null; pos: number; touched: boolean } | null>(null);
  const [selected, setSelected] = useState("hero");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [preview, setPreview] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ isPro: boolean; demoBypass: boolean } | null>(null);

  // undo/redo — snapshots of the whole studio config
  const undoStack = useRef<StudioConfig[]>([]);
  const redoStack = useRef<StudioConfig[]>([]);
  const pushHistory = (current: StudioConfig) => {
    undoStack.current = [...undoStack.current.slice(-39), JSON.parse(JSON.stringify(current))];
    redoStack.current = [];
  };
  const undo = () => {
    if (!cfg || undoStack.current.length === 0) return;
    redoStack.current.push(JSON.parse(JSON.stringify(cfg)));
    setCfg(undoStack.current.pop()!);
    setDirty(true);
  };
  const redo = () => {
    if (!cfg || redoStack.current.length === 0) return;
    undoStack.current.push(JSON.parse(JSON.stringify(cfg)));
    setCfg(redoStack.current.pop()!);
    setDirty(true);
  };

  useEffect(() => {
    if (!user) return;
    fetch("/api/me/studio", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const base: StudioConfig = d.studio ?? DEFAULT_STUDIO;
        setCfg({ ...base, world: { ...(base.world ?? DEFAULT_WORLD), enabled: true } });
        setMeta({ isPro: d.isPro, demoBypass: d.demoBypass });
      })
      .catch(() => {});
    fetch(`/api/users/${user.handle}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCover({ url: d.user?.coverUrl ?? null, pos: d.user?.coverPos ?? 50, touched: false }))
      .catch(() => setCover({ url: null, pos: 50, touched: false }));
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps

  const world: WorldConfig = cfg?.world ?? DEFAULT_WORLD;
  const mutate = (fn: (c: StudioConfig) => StudioConfig, recordHistory = true) => {
    setCfg((c) => {
      if (!c) return c;
      if (recordHistory) pushHistory(c);
      return fn(c);
    });
    setDirty(true);
    setMsg(null);
  };
  // element geometry changes: history once per gesture (on pointerdown via onSelect timing is unreliable) —
  // record on the FIRST change of a gesture using a flag reset on pointerup (approximated per change batch)
  const gestureOpen = useRef(false);
  const patchEl = (id: string, patch: Record<string, unknown>) => {
    setCfg((c) => {
      if (!c) return c;
      if (!gestureOpen.current) {
        pushHistory(c);
        gestureOpen.current = true;
        setTimeout(() => (gestureOpen.current = false), 400);
      }
      const w = c.world ?? DEFAULT_WORLD;
      return { ...c, world: { ...w, elements: { ...w.elements, [id]: { ...w.elements[id], ...patch } } } };
    });
    setDirty(true);
  };

  const save = async () => {
    if (!cfg) return;
    setBusy(true);
    setMsg(null);
    try {
      if (cover?.touched) {
        const cres = await fetch("/api/me/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coverUrl: cover.url, coverPos: cover.pos }),
        });
        if (!cres.ok) throw new Error("banner save failed");
        setCover((c) => (c ? { ...c, touched: false } : c));
      }
      const res = await fetch("/api/me/studio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studio: cfg }),
      });
      const d = await res.json();
      if (!res.ok) setMsg(d.error || "Save failed");
      else {
        setDirty(false);
        setMsg(d.active ? "Saved — this is exactly what visitors see." : "Saved — displays when your plan allows it.");
      }
    } catch {
      setMsg("Save failed — nothing was lost, try again.");
    }
    setBusy(false);
  };

  /* Default Layout = the standard UpNova arrangement, applied to the SAVED
     profile (not just this editor). Confirm, reset, persist immediately. */
  const defaultLayout = async () => {
    if (!cfg) return;
    if (!window.confirm("Restore the default UpNova profile arrangement? Your environment, theme, banner, and decorations stay — the layout resets and saves immediately.")) return;
    pushHistory(cfg);
    const next: StudioConfig = { ...cfg, world: { ...world, elements: JSON.parse(JSON.stringify(DEFAULT_WORLD.elements)) } };
    setCfg(next);
    setBusy(true);
    const res = await fetch("/api/me/studio", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studio: next }),
    });
    setBusy(false);
    setDirty(false);
    setMsg(res.ok ? "Default layout restored and saved." : "Could not save the reset — try Save.");
  };

  const pickCover = (file: File | null) => {
    if (!file) return;
    if (file.size > 1_100_000) {
      setMsg("Banner image too large — keep it under ~1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCover((c) => ({ url: String(reader.result), pos: c?.pos ?? 50, touched: true }));
      setDirty(true);
    };
    reader.readAsDataURL(file);
  };

  if (user === undefined || (user && (!cfg || !cover)))
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink"><div className="h-8 w-48 animate-pulse rounded bg-card-raised" /></div>;
  if (user === null)
    return (
      <div className="mx-auto max-w-md pt-12 text-center">
        <h1 className="text-xl font-bold text-zinc-50">My World</h1>
        <p className="mt-2 text-sm text-zinc-500">Sign in to edit your world.</p>
        <Link href="/login" className="btn-lime mt-4 inline-flex px-6 py-2 text-sm">Sign in</Link>
      </div>
    );

  const demoUnrestricted = user.testerMode !== "simulation" && !!user.demoTools;
  if (meta && !(user.plan === "pro" || demoUnrestricted))
    return (
      <div className="mx-auto max-w-md pt-12 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/30 bg-lime-400/10"><Paintbrush className="h-7 w-7 text-lime-400" /></span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">My World is Pro</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">The full-screen world editor comes with UpNova Pro. Any design you saved before is preserved.</p>
        <Link href="/pro" className="btn-lime mt-5 inline-flex rounded-md px-6 py-2.5 text-sm">Upgrade to Pro</Link>
      </div>
    );

  const widths = { desktop: "max-w-5xl", tablet: "max-w-3xl", mobile: "max-w-sm" } as const;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink">
      {/* floating toolbar — minimal, per the spec */}
      <div className="sticky top-3 z-[60] mx-auto flex w-fit max-w-[96vw] items-center gap-1 rounded-full border border-line bg-card/95 px-2 py-1.5 shadow-2xl backdrop-blur">
        <button onClick={undo} disabled={undoStack.current.length === 0} className="icon-btn h-8 w-8 disabled:opacity-30" title="Undo" aria-label="Undo"><Undo2 className="h-4 w-4" /></button>
        <button onClick={redo} disabled={redoStack.current.length === 0} className="icon-btn h-8 w-8 disabled:opacity-30" title="Redo" aria-label="Redo"><Redo2 className="h-4 w-4" /></button>
        <span className="mx-1 h-5 w-px bg-line" />
        {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
          <button key={d} onClick={() => setDevice(d)} className={`icon-btn h-8 w-8 ${device === d ? "bg-lime-400/15 text-lime-300" : ""}`} title={d} aria-label={`${d} preview`}><Icon className="h-4 w-4" /></button>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        <button onClick={() => setPreview(!preview)} className={`icon-btn h-8 w-8 ${preview ? "bg-lime-400/15 text-lime-300" : ""}`} title="Preview — exactly what visitors see" aria-label="Preview"><Eye className="h-4 w-4" /></button>
        <button onClick={() => setDrawer(!drawer)} className={`icon-btn h-8 w-8 ${drawer ? "bg-lime-400/15 text-lime-300" : ""}`} title="Design — environment, banner, decorations" aria-label="Design panel"><Paintbrush className="h-4 w-4" /></button>
        <button onClick={defaultLayout} disabled={busy} className="icon-btn h-8 w-8 disabled:opacity-40" title="Default Layout — restore the standard UpNova arrangement (saves)" aria-label="Default layout"><LayoutTemplate className="h-4 w-4" /></button>
        <span className="mx-1 h-5 w-px bg-line" />
        <button onClick={save} disabled={busy || !dirty} className="rounded-full bg-lime-400 px-4 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-lime-300 disabled:opacity-40">
          {busy ? "Saving…" : dirty ? "Save" : "Saved"}
        </button>
        <button onClick={() => (dirty && !window.confirm("Leave with unsaved changes?") ? null : router.push("/profile"))} className="icon-btn h-8 w-8" title="Exit to profile" aria-label="Exit">
          <X className="h-4 w-4" />
        </button>
      </div>

      {msg && <p className="mx-auto mt-2 w-fit rounded-full border border-line bg-card px-4 py-1.5 text-[11px] text-zinc-300">{msg}</p>}
      {!preview && (
        <p className="mx-auto mt-2 flex w-fit items-center gap-1.5 rounded-full bg-card/60 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
          <Lock className="h-2.5 w-2.5" /> identity · actions · trust locked inside the profile card — everything else: grab it, move it, resize it
        </p>
      )}

      {/* THE WORLD — your actual profile, full size, in Edit Mode */}
      <div className={`mx-auto mt-3 px-3 pb-24 ${widths[device]}`}>
        <DbCreatorProfile
          handle={user.handle}
          edit={
            preview
              ? undefined
              : {
                  studio: cfg!,
                  selected,
                  device,
                  onSelect: setSelected,
                  onChange: (id, patch) => patchEl(id, patch as Record<string, unknown>),
                  coverUrl: cover?.touched ? cover.url : undefined,
                  coverPos: cover?.touched ? cover.pos : undefined,
                }
          }
        />
        {preview && (
          <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-600">
            preview — exactly what visitors see{dirty ? " after you save" : ""}
          </p>
        )}
      </div>

      {/* design drawer — scene, banner, decorations (the creative layer) */}
      {drawer && !preview && (
        <aside className="fixed bottom-0 right-0 top-0 z-[55] w-80 max-w-[90vw] overflow-y-auto border-l border-line bg-card p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-100">Design</h2>
            <button onClick={() => setDrawer(false)} className="icon-btn h-7 w-7" aria-label="Close design panel"><X className="h-3.5 w-3.5" /></button>
          </div>

          <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Environment</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {Object.entries(ENVIRONMENTS).map(([id, env]) => (
              <button key={id} onClick={() => mutate((c) => ({ ...c, world: { ...(c.world ?? DEFAULT_WORLD), environment: id } }))} className={`overflow-hidden rounded-lg border text-left ${world.environment === id ? "border-lime-400/60" : "border-line hover:border-zinc-600"}`}>
                <span className="block h-10 w-full" style={{ backgroundImage: env.css }} />
                <span className="block px-2 py-1 text-[10px] font-semibold text-zinc-200">{env.label}</span>
              </button>
            ))}
          </div>

          <p className="mt-5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500"><ImageIcon className="h-3 w-3" /> Banner / cover</p>
          <div className="mt-2 overflow-hidden rounded-lg border border-line">
            {cover?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.url} alt="Banner" className="h-20 w-full object-cover" style={{ objectPosition: `center ${cover.pos}%` }} />
            ) : (
              <div className="flex h-20 items-center justify-center bg-card-raised text-[10px] text-zinc-600">No banner</div>
            )}
          </div>
          <label className="btn-ghost mt-2 inline-flex cursor-pointer px-3 py-1.5 text-[11px]">
            <ImageIcon className="h-3 w-3" /> {cover?.url ? "Replace" : "Upload"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pickCover(e.target.files?.[0] ?? null)} />
          </label>
          {cover?.url && (
            <>
              <label className="mt-2 block text-[10px] text-zinc-500">
                Position — {cover.pos}%
                <input type="range" min={0} max={100} value={cover.pos} onChange={(e) => { setCover((c) => (c ? { ...c, pos: Number(e.target.value), touched: true } : c)); setDirty(true); }} className="mt-1 w-full accent-lime-400" />
              </label>
              <button onClick={() => { setCover({ url: null, pos: 50, touched: true }); setDirty(true); }} className="mt-2 flex items-center gap-1 rounded-full border border-red-500/30 px-2.5 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/10">
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </>
          )}

          <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Banner strip</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {Object.entries(BANNERS).map(([id, b]) => (
              <button key={id} onClick={() => mutate((c) => ({ ...c, banner: id }))} className={`overflow-hidden rounded border text-[9px] font-semibold text-zinc-300 ${(cfg!.banner ?? "none") === id ? "border-lime-400/60" : "border-line"}`}>
                <span className="block h-3 w-full" style={b.css ? { backgroundImage: b.css } : { background: "#27272a" }} />
                <span className="block px-1 py-0.5">{b.label}</span>
              </button>
            ))}
          </div>

          <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Decorations (max 3)</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(DECORATIONS).map(([id, d]) => {
              const on = (cfg!.decorations ?? []).includes(id);
              return (
                <button key={id} onClick={() => mutate((c) => ({ ...c, decorations: on ? (c.decorations ?? []).filter((x) => x !== id) : (c.decorations ?? []).length >= 3 ? c.decorations : [...(c.decorations ?? []), id] }))} className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${on ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400"}`}>
                  {d.label}
                </button>
              );
            })}
          </div>

          <p className="mt-5 border-t border-line-soft pt-3 text-[9px] leading-relaxed text-zinc-600">
            Themes, accents, fonts, frames, and section stacking (non-world) live in{" "}
            <Link href="/profile/studio" className="text-lime-300 hover:underline">Profile Studio</Link>.
          </p>
        </aside>
      )}
    </div>
  );
}
