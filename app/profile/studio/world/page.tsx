"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
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
  WORLD_ELEMENT_IDS,
  type StudioConfig,
  type WorldConfig,
  type WorldDevice,
  type WorldDeviceLayout, WORLD_DEVICE_WIDTHS } from "@/lib/profileStudio";

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
  const [device, setDevice] = useState<WorldDevice>("desktop");
  const [preview, setPreview] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [defaultOpen, setDefaultOpen] = useState(false);
  const [imgUrl, setImgUrl] = useState("");
  const [bgUrl, setBgUrl] = useState("");
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

  /* ---------- THREE INDEPENDENT DEVICE LAYOUTS ----------
     desktop lives in world.elements/world.images (unchanged);
     tablet/phone live in world.tablet / world.phone. Every edit routes
     ONLY to the device being edited — the others are never touched. */
  const deviceLayoutOf = (w: WorldConfig, d: WorldDevice): { elements: WorldConfig["elements"]; images: NonNullable<WorldConfig["images"]> } => {
    if (d !== "desktop" && w[d]) return { elements: w[d]!.elements, images: w[d]!.images ?? {} };
    return { elements: w.elements, images: w.images ?? {} };
  };
  const activeLayout = deviceLayoutOf(world, device);
  const deviceIsCustom = device === "desktop" || !!world[device];

  /** first switch to tablet/phone seeds an INDEPENDENT copy so the
      canvas is immediately editable — from then on the layouts diverge */
  const seedFor = (w: WorldConfig, d: Exclude<WorldDevice, "desktop">): WorldDeviceLayout => {
    if (d === "tablet") {
      // start from the desktop design, stretched vertically (720 vs 960
      // design px → content runs ~4/3 taller)
      const elements: WorldConfig["elements"] = {};
      for (const [id, el] of Object.entries(w.elements)) elements[id] = { ...el, y: Math.round(el.y * 4 / 3) };
      const images: NonNullable<WorldConfig["images"]> = {};
      for (const [id, im] of Object.entries(w.images ?? {})) images[id] = { ...im, y: Math.round(im.y * 4 / 3) };
      return { elements, images };
    }
    // phone: the clean full-width stack (what phone visitors saw before),
    // now fully editable — heights are generous estimates at 390 px
    const est: Record<string, number> = { hero: 700, trust: 480, posts: 620, services: 540, reviews: 480, experience: 480 };
    const orderedIds = [...WORLD_ELEMENT_IDS].filter((id) => w.elements[id]).sort((a, b) => w.elements[a].y - w.elements[b].y);
    const elements: WorldConfig["elements"] = {};
    let yCur = 0;
    for (const id of orderedIds) {
      const el = w.elements[id];
      elements[id] = { ...el, x: 0, w: 100, y: el.hidden && id !== "hero" ? yCur : yCur, rotate: 0 };
      if (!el.hidden || id === "hero") yCur += (est[id] ?? 480) + 32;
    }
    const images: NonNullable<WorldConfig["images"]> = {};
    for (const [id, im] of Object.entries(w.images ?? {})) images[id] = { ...im, y: Math.round(im.y * 1.6), w: Math.max(im.w, 24) };
    return { elements, images };
  };
  const switchDevice = (d: WorldDevice) => {
    setDevice(d);
    setSelected("hero");
    if (d === "desktop") return;
    setCfg((c) => {
      if (!c) return c;
      const w = c.world ?? DEFAULT_WORLD;
      if (w[d]) return c; // already customized — NEVER overwrite
      pushHistory(c);
      setDirty(true);
      return { ...c, world: { ...w, [d]: seedFor(w, d) } };
    });
  };
  /** write the active device's layout back into the config */
  const writeActive = (c: StudioConfig, next: { elements?: WorldConfig["elements"]; images?: NonNullable<WorldConfig["images"]> }): StudioConfig => {
    const w = c.world ?? DEFAULT_WORLD;
    if (device === "desktop")
      return { ...c, world: { ...w, ...(next.elements ? { elements: next.elements } : {}), ...(next.images ? { images: next.images } : {}) } };
    const cur = w[device] ?? seedFor(w, device);
    return { ...c, world: { ...w, [device]: { elements: next.elements ?? cur.elements, images: next.images ?? cur.images ?? {} } } };
  };

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
      const lay = deviceLayoutOf(w, device);
      return writeActive(c, { elements: { ...lay.elements, [id]: { ...lay.elements[id], ...patch } } });
    });
    setDirty(true);
  };

  /* ---- free image layers: add / patch / remove (history-aware) ---- */
  /* one tap: Fit (object-fit: contain — whole image, empty space ok) ·
     Fill (object-fit: cover — frame fully covered, edges crop) ·
     Natural (legacy: no frame, image flows at its own aspect).

     THE RENDERING MODEL: the frame is the container and it is FIXED —
     switching Fit/Fill NEVER changes the frame's width or height, and
     the frame is never derived from the image's aspect ratio (that was
     the bug: it made the image its own frame, so the toggle did
     nothing and resizing felt like free-transforming the image).
     Legacy natural images: the first Fit/Fill click freezes the frame
     at the element's CURRENT on-canvas box (offset metrics are design
     units, transform-immune) — pixels don't jump, the mode applies
     immediately, no handle-dragging required. */
  const setImageDisplay = (id: string, mode: "natural" | "fit" | "fill") => {
    const im = deviceLayoutOf(cfg?.world ?? DEFAULT_WORLD, device).images?.[id];
    if (!im) return;
    if (mode === "natural") return patchImage(id, { h: 0 });
    if (im.h && im.h > 0) return patchImage(id, { fit: mode }); // frame untouched — image adapts
    const el = document.querySelector<HTMLElement>(`[data-world-el="img:${id}"]`);
    const h = Math.round(Math.min(3000, Math.max(24, el?.offsetHeight || 240)));
    patchImage(id, { h, fit: mode, posX: 50, posY: 50 });
  };

  /* ---- PAGE BACKGROUND: attached to the canvas itself, the lowest
     visual layer, spanning the whole My World page. Fit/Fill here are
     rendered against the ENTIRE canvas — never a layer rectangle. ---- */
  const setBackground = (src: string) => {
    const clean = src.trim();
    if (!clean) return;
    mutate((c) => ({ ...c, world: { ...(c.world ?? DEFAULT_WORLD), background: { src: clean, fit: "fill" as const, posX: 50, posY: 50, opacity: 1 } } }));
    setBgUrl("");
  };
  const patchBackground = (patch: Record<string, unknown>) => {
    mutate((c) => {
      const w = c.world ?? DEFAULT_WORLD;
      if (!w.background) return c;
      return { ...c, world: { ...w, background: { ...w.background, ...patch } } };
    });
  };
  const removeBackground = () => mutate((c) => ({ ...c, world: { ...(c.world ?? DEFAULT_WORLD), background: undefined } }));
  const pickBackgroundFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 600_000) { setMsg("Image too large — keep backgrounds under ~600 KB."); return; }
    const reader = new FileReader();
    reader.onload = () => setBackground(String(reader.result));
    reader.readAsDataURL(file);
  };

  const patchImage = (id: string, patch: Record<string, unknown>) => {
    setCfg((c) => {
      if (!c) return c;
      if (!gestureOpen.current) {
        pushHistory(c);
        gestureOpen.current = true;
        setTimeout(() => (gestureOpen.current = false), 400);
      }
      const w = c.world ?? DEFAULT_WORLD;
      const imgs = { ...deviceLayoutOf(w, device).images };
      if (!imgs[id]) return c;
      imgs[id] = { ...imgs[id], ...patch };
      return writeActive(c, { images: imgs });
    });
    setDirty(true);
  };
  const addImage = (src: string) => {
    const clean = src.trim();
    if (!clean) return;
    mutate((c) => {
      const w = c.world ?? DEFAULT_WORLD;
      const imgs = { ...deviceLayoutOf(w, device).images };
      if (Object.keys(imgs).length >= 8) {
        setMsg("Up to 8 image layers per device layout.");
        return c;
      }
      const id = Math.random().toString(36).slice(2, 10);
      // THE FRAME IS THE CONTAINER: every image is placed inside a fixed
      // standard frame (4:3 at the default width) and covers it (Fill).
      // The image adapts to the frame — never the other way around.
      // Portrait/landscape/square sources all land in the same clean box;
      // Fit is one tap away and is immediately visible (letterboxing).
      const frameW = 28;
      const frameH = Math.round(((frameW / 100) * WORLD_DEVICE_WIDTHS[device] * 3) / 4);
      imgs[id] = { src: clean, x: 32, y: 120, w: frameW, rotate: 0, opacity: 1, layer: 25, locked: false, h: frameH, fit: "fill", posX: 50, posY: 50 };
      setSelected(`img:${id}`);
      return writeActive(c, { images: imgs });
    });
    setImgUrl("");
  };
  const removeImage = (id: string) => {
    mutate((c) => {
      const w = c.world ?? DEFAULT_WORLD;
      const imgs = { ...deviceLayoutOf(w, device).images };
      delete imgs[id];
      return writeActive(c, { images: imgs });
    });
    setSelected("hero");
  };
  const pickWorldImage = (file: File | null) => {
    if (!file) return;
    if (file.size > 600_000) {
      setMsg("Image too large — keep decorations under ~600 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => addImage(String(reader.result));
    reader.readAsDataURL(file);
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

  /* Default Layout = the ORIGINAL Mavyn profile structure (one full-width
     column, original order and spacing — the canonical DEFAULT_WORLD),
     applied to the SAVED profile, not just this editor. */
  const defaultLayout = async () => {
    if (!cfg) return;
    setDefaultOpen(false);
    pushHistory(cfg);
    const next: StudioConfig =
      device === "desktop"
        ? { ...cfg, world: { ...world, elements: JSON.parse(JSON.stringify(DEFAULT_WORLD.elements)) } }
        : { ...cfg, world: { ...world, [device]: undefined } }; // back to following desktop / clean stack
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
    return <div className="fixed inset-0 z-50 flex items-end justify-center pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-0 bg-ink"><div className="h-8 w-48 animate-pulse rounded bg-card-raised" /></div>;
  if (user === null)
    return (
      <div className="mx-auto max-w-md pt-12 text-center">
        <h1 className="text-xl font-bold text-zinc-50">My World</h1>
        <p className="mt-2 text-sm text-zinc-500">Sign in to edit your world.</p>
        <Link href="/login" className="btn-lime mt-4 inline-flex px-6 py-2 text-sm">Sign in</Link>
      </div>
    );

  const demoUnrestricted = user.testerMode !== "simulation" && !!user.demoTools;
  if (meta && !(["pro", "business_pro", "agency"].includes(user.plan ?? "") || demoUnrestricted))
    return (
      <div className="mx-auto max-w-md pt-12 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/30 bg-lime-400/10"><Paintbrush className="h-7 w-7 text-lime-400" /></span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">My World is Pro</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">The full-screen world editor comes with Mavyn Pro. Any design you saved before is preserved.</p>
        <Link href="/pro" className="btn-lime mt-5 inline-flex rounded-md px-6 py-2.5 text-sm">Upgrade to Pro</Link>
      </div>
    );

  // large screens use the space — the edit view matches the real profile scale
  const widths: Record<WorldDevice, string> = { desktop: "max-w-5xl 2xl:max-w-6xl", tablet: "max-w-3xl", phone: "max-w-sm" };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink">
      {/* floating toolbar — minimal, per the spec */}
      <div className="sticky top-3 z-[60] mx-auto flex w-fit max-w-[96vw] items-center gap-1 rounded-full border border-line bg-card/95 px-2 py-1.5 shadow-2xl backdrop-blur">
        <button
          onClick={() => (dirty ? setLeaveOpen(true) : router.push("/profile"))}
          className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-card-raised"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Profile
        </button>
        <span className="mx-1 h-5 w-px bg-line" />
        <span className={`rounded-full px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${preview ? "bg-sky-400/15 text-sky-300" : "bg-lime-400/15 text-lime-300"}`}>
          {preview ? "Preview mode" : "Edit mode"}
        </span>
        <span className="mx-1 h-5 w-px bg-line" />
        <button onClick={undo} disabled={undoStack.current.length === 0} className="icon-btn h-8 w-8 disabled:opacity-30" title="Undo" aria-label="Undo"><Undo2 className="h-4 w-4" /></button>
        <button onClick={redo} disabled={redoStack.current.length === 0} className="icon-btn h-8 w-8 disabled:opacity-30" title="Redo" aria-label="Redo"><Redo2 className="h-4 w-4" /></button>
        <span className="mx-1 h-5 w-px bg-line" />
        {([["desktop", Monitor], ["tablet", Tablet], ["phone", Smartphone]] as const).map(([d, Icon]) => (
          <button key={d} onClick={() => switchDevice(d)} className={`icon-btn h-8 w-8 ${device === d ? "bg-lime-400/15 text-lime-300" : ""}`} title={`Edit the ${d} layout — independent from the others`} aria-label={`Edit ${d} layout`}><Icon className="h-4 w-4" /></button>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        <button onClick={() => setPreview(!preview)} className={`icon-btn h-8 w-8 ${preview ? "bg-lime-400/15 text-lime-300" : ""}`} title="Preview — exactly what visitors see" aria-label="Preview"><Eye className="h-4 w-4" /></button>
        <button
          onClick={() => setDrawer(!drawer)}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition ${drawer ? "bg-lime-400/15 text-lime-300" : "text-zinc-300 hover:bg-card-raised"}`}
          title="Theme & Decorations — change backgrounds, colors, decorations and visual effects."
          aria-label="Theme and decorations"
        >
          <Paintbrush className="h-3.5 w-3.5" /> Theme
        </button>
        <button onClick={() => setDefaultOpen(true)} disabled={busy} className="icon-btn h-8 w-8 disabled:opacity-40" title="Default Layout — restore the original Mavyn profile arrangement" aria-label="Default layout"><LayoutTemplate className="h-4 w-4" /></button>
        <span className="mx-1 h-5 w-px bg-line" />
        <button onClick={save} disabled={busy || !dirty} className="rounded-full bg-lime-400 px-4 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-lime-300 disabled:opacity-40">
          {busy ? "Saving…" : dirty ? "Save" : "Saved"}
        </button>
        <button onClick={() => (dirty ? setLeaveOpen(true) : router.push("/profile"))} className="icon-btn h-8 w-8" title="Exit to profile" aria-label="Exit">
          <X className="h-4 w-4" />
        </button>
      </div>

      {msg && <p className="mx-auto mt-2 w-fit rounded-full border border-line bg-card px-4 py-1.5 text-[11px] text-zinc-300">{msg}</p>}
      {!preview && (
        <>
          <p className="mx-auto mt-2 flex w-fit items-center gap-1.5 rounded-full bg-card/60 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
            <Lock className="h-2.5 w-2.5" /> identity · actions · trust locked inside the profile card — everything else is freeform: rose guides appear when edges, centers, or spacing line up · hold Alt to bypass snapping
          </p>
          <p className="mx-auto mt-1.5 flex w-fit items-center gap-1.5 rounded-full border border-line bg-card/80 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-lime-300">
            Editing the {device} layout
            <span className="font-normal text-zinc-500">
              — independent per device ·{" "}
              {device === "desktop"
                ? "shown to desktop visitors"
                : deviceIsCustom
                  ? `custom ${device} design — shown to ${device} visitors`
                  : device === "tablet"
                    ? "currently follows desktop until you edit here"
                    : "currently the clean stacked flow until you edit here"}
            </span>
          </p>
        </>
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
                  onImageChange: (id, patch) => patchImage(id, patch as Record<string, unknown>),
                  onImageRemove: removeImage,
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

      {/* unsaved changes — Save & Leave / Leave Without Saving / Cancel */}
      {leaveOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setLeaveOpen(false)}>
          <div className="card w-full max-w-xs p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-bold tracking-tight text-zinc-50">Unsaved changes</p>
            <p className="mt-1.5 text-xs text-zinc-500">Save before leaving?</p>
            <div className="mt-4 space-y-2">
              <button
                onClick={async () => { await save(); setLeaveOpen(false); router.push("/profile"); }}
                disabled={busy}
                className="btn-lime w-full rounded-md py-2 text-xs disabled:opacity-50"
              >
                Save &amp; Leave
              </button>
              <button onClick={() => { setLeaveOpen(false); router.push("/profile"); }} className="w-full rounded-full border border-red-500/30 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10">
                Leave Without Saving
              </button>
              <button onClick={() => setLeaveOpen(false)} className="btn-ghost w-full py-2 text-xs">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* default layout confirm */}
      {defaultOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setDefaultOpen(false)}>
          <div className="card w-full max-w-xs p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-bold tracking-tight text-zinc-50">Restore default layout?</p>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              {device === "desktop"
                ? "This resets your DESKTOP arrangement to the original Mavyn profile — full-width sections in the original order and spacing. Tablet and phone layouts are untouched."
                : device === "tablet"
                  ? "This removes your custom TABLET arrangement — tablet visitors go back to seeing your desktop design, scaled. Desktop and phone layouts are untouched."
                  : "This removes your custom PHONE arrangement — phone visitors go back to the clean stacked flow. Desktop and tablet layouts are untouched."}{" "}
              Your environment, theme, banner, and decorations stay. Saves immediately.
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setDefaultOpen(false)} className="btn-ghost flex-1 py-2 text-xs">Cancel</button>
              <button onClick={defaultLayout} disabled={busy} className="btn-lime flex-1 rounded-md py-2 text-xs disabled:opacity-50">Restore Default</button>
            </div>
          </div>
        </div>
      )}

      {/* design drawer — scene, banner, decorations (the creative layer) */}
      {drawer && !preview && (
        <aside className="fixed bottom-0 right-0 top-0 z-[55] w-80 max-w-[90vw] overflow-y-auto border-l border-line bg-card p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-100">Design</h2>
            <button onClick={() => setDrawer(false)} className="icon-btn h-7 w-7" aria-label="Close design panel"><X className="h-3.5 w-3.5" /></button>
          </div>

          <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Page background</p>
          <p className="mt-1 text-[9px] leading-relaxed text-zinc-600">
            A wallpaper behind your ENTIRE world — every card, post, and section, top to bottom.
            It grows with the page and sits below everything. Fill covers the whole page;
            Fit shows the complete image with the environment through the gaps.
          </p>
          <div data-guide="world-background-panel">
            {world.background ? (
              <div className="mt-2 rounded-lg border border-line p-2">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={world.background.src} alt="" className="h-9 w-14 shrink-0 rounded object-cover" />
                  <div className="flex min-w-0 flex-1 gap-1">
                    {(["fit", "fill"] as const).map((m2) => (
                      <button
                        key={m2}
                        onClick={() => patchBackground({ fit: m2 })}
                        title={m2 === "fill" ? "Cover the whole page — no empty area, edges crop" : "Whole image visible — never cropped, gaps allowed"}
                        className={`flex-1 rounded-md border px-2 py-1.5 text-[10px] font-semibold capitalize transition ${world.background!.fit === m2 ? "border-lime-400/60 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}
                      >
                        {m2}
                      </button>
                    ))}
                  </div>
                  <button onClick={removeBackground} className="icon-btn h-7 w-7" title="Remove background"><Trash2 className="h-3.5 w-3.5 text-zinc-500 hover:text-rose-300" /></button>
                </div>
                {world.background.fit === "fill" && (
                  <div className="mt-2 flex items-center gap-3">
                    <div>
                      <p className="mb-1 text-[9px] text-zinc-600">Position</p>
                      <div className="grid w-16 grid-cols-3 gap-0.5" data-guide="world-background-position">
                        {[0, 50, 100].map((py) =>
                          [0, 50, 100].map((px) => (
                            <button
                              key={`${px}-${py}`}
                              aria-label={`Background position ${px}% ${py}%`}
                              onClick={() => patchBackground({ posX: px, posY: py })}
                              className={`h-4 rounded-sm border transition ${world.background!.posX === px && world.background!.posY === py ? "border-lime-400 bg-lime-400/40" : "border-line bg-card-raised hover:border-zinc-600"}`}
                            />
                          ))
                        )}
                      </div>
                    </div>
                    <label className="min-w-0 flex-1">
                      <span className="mb-1 block text-[9px] text-zinc-600">Opacity · {Math.round(world.background.opacity * 100)}%</span>
                      <input type="range" min={5} max={100} value={Math.round(world.background.opacity * 100)} onChange={(e) => patchBackground({ opacity: Number(e.target.value) / 100 })} className="w-full accent-lime-400" />
                    </label>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-2 flex gap-1.5">
                <input
                  value={bgUrl}
                  onChange={(e) => setBgUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setBackground(bgUrl)}
                  placeholder="Background image URL…"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-card-raised px-3 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
                />
                <button onClick={() => setBackground(bgUrl)} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">Set</button>
                <label className="btn-ghost shrink-0 cursor-pointer px-3 py-1.5 text-xs">
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pickBackgroundFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            )}
            {!world.background && (
              <p className="mt-1 text-[9px] text-zinc-600">…or select an image layer below and tap &quot;Set as page background&quot;.</p>
            )}
          </div>

          <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Images &amp; layers</p>
          <p className="mt-1 text-[9px] leading-relaxed text-zinc-600">
            Free decorative layers — put them behind cards, between cards, or in front (select one on the
            canvas for layer, opacity, lock, rotate, and delete controls). They never break the card layout.
          </p>
          <div className="mt-2 flex gap-1.5">
            <input
              value={imgUrl}
              onChange={(e) => setImgUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addImage(imgUrl)}
              placeholder="Paste an image URL…"
              className="min-w-0 flex-1 rounded-lg border border-line bg-card-raised px-3 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
            />
            <button onClick={() => addImage(imgUrl)} className="btn-ghost shrink-0 px-3 py-1.5 text-xs">Add</button>
          </div>
          <label className="btn-ghost mt-1.5 flex w-full cursor-pointer justify-center py-1.5 text-xs">
            <ImageIcon className="h-3.5 w-3.5" /> Upload image (≤600 KB)
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pickWorldImage(e.target.files?.[0] ?? null)} />
          </label>
          {Object.keys(activeLayout.images).length > 0 && (
            <ul className="mt-2 space-y-1">
              {Object.entries(activeLayout.images).map(([iid, im]) => (
                <li key={iid} className={`rounded-lg border px-2 py-1.5 ${selected === `img:${iid}` ? "border-sky-400/50 bg-sky-400/5" : "border-line"}`}>
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.src} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
                    <button onClick={() => setSelected(`img:${iid}`)} className="min-w-0 flex-1 truncate text-left text-[10px] text-zinc-300 hover:text-zinc-100">
                      z {im.layer} · {Math.round(im.opacity * 100)}%{im.locked ? " · locked" : ""}
                    </button>
                    <button onClick={() => patchImage(iid, { locked: !im.locked })} className="icon-btn h-6 w-6" title={im.locked ? "Unlock" : "Lock"}><Lock className={`h-3 w-3 ${im.locked ? "text-sky-300" : "text-zinc-600"}`} /></button>
                    <button onClick={() => removeImage(iid)} className="icon-btn h-6 w-6" title="Delete"><Trash2 className="h-3 w-3 text-zinc-500 hover:text-rose-300" /></button>
                  </div>
                  {selected === `img:${iid}` && (
                    /* ---- Image Display: Natural | Fit | Fill (+ Position).
                       Fit = contain (whole image, no crop) · Fill = cover
                       (frame covered, edges crop) — standard object-fit,
                       aspect ratio preserved in every mode, NEVER stretched.
                       The canvas beside this panel is the live preview.
                       Saved per element; survives leave-and-return. ---- */
                    <div className="mt-1.5 border-t border-line-soft pt-1.5" data-guide="world-image-display">
                      <p className="mb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Image display</p>
                      <div className="flex gap-1">
                        {([
                          ["natural", "Natural", "Own aspect, no frame"],
                          ["fit", "Fit", "Whole image, no cropping"],
                          ["fill", "Fill", "Cover the frame, edges crop"],
                        ] as const).map(([mode, label, hint]) => {
                          const active = mode === "natural" ? !im.h : im.h && (im.fit ?? "fill") === mode;
                          return (
                            <button
                              key={mode}
                              title={hint}
                              onClick={() => setImageDisplay(iid, mode)}
                              className={`flex-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition ${active ? "border-sky-400/60 bg-sky-400/10 text-sky-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {!!im.h && (im.fit ?? "fill") === "fill" && (
                        <div className="mt-1.5">
                          <p className="mb-1 text-[9px] text-zinc-600">Position — which part stays visible</p>
                          <div className="grid w-16 grid-cols-3 gap-0.5" data-guide="world-image-position">
                            {[0, 50, 100].map((py) =>
                              [0, 50, 100].map((px) => (
                                <button
                                  key={`${px}-${py}`}
                                  aria-label={`Position ${px}% ${py}%`}
                                  onClick={() => patchImage(iid, { posX: px, posY: py })}
                                  className={`h-4 rounded-sm border transition ${ (im.posX ?? 50) === px && (im.posY ?? 50) === py ? "border-sky-400 bg-sky-400/40" : "border-line bg-card-raised hover:border-zinc-600"}`}
                                />
                              ))
                            )}
                          </div>
                        </div>
                      )}
                      <p className="mt-1 text-[9px] leading-relaxed text-zinc-600">
                        The frame stays fixed — the image adapts to it. Handles resize the frame,
                        never stretch the image.
                      </p>
                      <button
                        onClick={() => { setBackground(im.src); removeImage(iid); }}
                        data-guide="world-make-background"
                        className="mt-1.5 w-full rounded-md border border-lime-400/40 bg-lime-400/5 px-2 py-1.5 text-[10px] font-semibold text-lime-300 transition hover:bg-lime-400/15"
                      >
                        Set as page background
                      </button>
                      <p className="mt-1 text-[9px] leading-relaxed text-zinc-600">
                        Wallpaper mode: covers the WHOLE world page behind everything — not this frame.
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">World headline</p>
          <input
            value={world.title ?? ""}
            onChange={(e) => mutate((c) => ({ ...c, world: { ...(c.world ?? DEFAULT_WORLD), title: e.target.value.slice(0, 80) } }), false)}
            placeholder={`${user.profile.displayName}'s world`}
            className="mt-1.5 w-full rounded-lg border border-line bg-card-raised px-3 py-2 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50"
          />
          <label className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] text-zinc-500">Show the headline (and the &quot;built on Mavyn&quot; mark)</span>
            <input type="checkbox" checked={world.showTitle !== false} onChange={(e) => mutate((c) => ({ ...c, world: { ...(c.world ?? DEFAULT_WORLD), showTitle: e.target.checked } }))} className="h-4 w-4 accent-lime-400" />
          </label>
          <p className="mt-1 text-[9px] leading-relaxed text-zinc-600">
            Say what your world is — &quot;welcome to my studio&quot;, &quot;the print shop&quot;, anything (plain text).
            Hide it entirely and the top of the canvas is all yours.
          </p>

          <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Environment</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {Object.entries(ENVIRONMENTS).map(([id, env]) => (
              <button key={id} onClick={() => mutate((c) => ({ ...c, world: { ...(c.world ?? DEFAULT_WORLD), environment: id } }))} className={`overflow-hidden rounded-lg border text-left ${world.environment === id ? "border-lime-400/60" : "border-line hover:border-zinc-600"}`}>
                <span className="block h-10 w-full" style={{ backgroundImage: env.css }} />
                <span className="block px-2 py-1 text-[10px] font-semibold text-zinc-200">{env.label}</span>
              </button>
            ))}
          </div>

          <p className="mt-5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500"><ImageIcon className="h-3 w-3" /> Profile banner (header image)</p>
          <p className="mt-0.5 text-[9px] leading-relaxed text-zinc-600">Sits on your profile card, exactly as visitors see it. The Environment above is the separate canvas background behind everything.</p>
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
