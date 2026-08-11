"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Palette, Sparkles, Check, RotateCcw, Eye, ArrowUp, ArrowDown, Lock, FlaskConical } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useSession } from "@/lib/session";
import { Globe2, Monitor, Tablet, Smartphone, Layers, EyeOff, LayoutTemplate, Move, Lock as LockIcon, Image as ImageIcon, Trash2 } from "lucide-react";
import DbCreatorProfile from "@/components/db/DbCreatorProfile";
import {
  BANNERS,
  DECORATIONS,
  COLLEGE_THEMES,
  THEMES,
  FRAMES,
  ACCENTS,
  FONTS,
  EFFECTS,
  SECTION_LABELS,
  DEFAULT_STUDIO,
  DEFAULT_WORLD,
  ENVIRONMENTS,
  WORLD_ELEMENT_IDS,
  WORLD_ELEMENT_LABELS,
  type StudioConfig,
  type WorldConfig,
} from "@/lib/profileStudio";

/* ------------------------------------------------------------------ */
/* Profile Studio (Pro) — appearance-only customization from the       */
/* approved design system. Everything here SAVES for real              */
/* (PATCH /api/me/studio → profiles.studio) and survives refresh,      */
/* logout, and navigation. Downgrading preserves the config; display   */
/* just turns off until Pro is active again.                           */
/* ------------------------------------------------------------------ */

export default function ProfileStudioPage() {
  const { user } = useSession();
  const [cfg, setCfg] = useState<StudioConfig>(DEFAULT_STUDIO);
  const [meta, setMeta] = useState<{ isPro: boolean; active: boolean; demoBypass: boolean; saved: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch("/api/me/studio", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.studio) setCfg(d.studio);
        setMeta({ isPro: d.isPro, active: d.active, demoBypass: d.demoBypass, saved: d.saved });
      })
      .catch(() => {});
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof StudioConfig>(k: K, v: StudioConfig[K]) => {
    setCfg((c) => ({ ...c, [k]: v }));
    setDirty(true);
    setMsg(null);
  };
  const moveSection = (id: string, dir: -1 | 1) => {
    setCfg((c) => {
      const arr = [...c.sections];
      const i = arr.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return c;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...c, sections: arr };
    });
    setDirty(true);
  };

  /* ---------------- MY WORLD editor ---------------- */
  const world: WorldConfig = cfg.world ?? DEFAULT_WORLD;
  const setWorld = (patch: Partial<WorldConfig>) => {
    setCfg((c) => ({ ...c, world: { ...(c.world ?? DEFAULT_WORLD), ...patch } }));
    setDirty(true);
    setMsg(null);
  };
  const patchEl = (id: string, patch: Partial<WorldConfig["elements"][string]>) => {
    setCfg((c) => {
      const w = c.world ?? DEFAULT_WORLD;
      return { ...c, world: { ...w, elements: { ...w.elements, [id]: { ...w.elements[id], ...patch } } } };
    });
    setDirty(true);
  };
  const [selected, setSelected] = useState<string>("hero");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  /* ---- banner/cover: the SAME profiles.coverUrl the profile renders.
     Loaded from the same public payload; saved through the same
     /api/me/profile PATCH Edit Profile uses. No second banner system. ---- */
  const [cover, setCover] = useState<{ url: string | null; pos: number; touched: boolean } | null>(null);
  useEffect(() => {
    if (!user) return;
    fetch(`/api/users/${user.handle}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCover({ url: d.user?.coverUrl ?? null, pos: d.user?.coverPos ?? 50, touched: false }))
      .catch(() => setCover({ url: null, pos: 50, touched: false }));
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickCover = (file: File | null) => {
    if (!file) return;
    if (file.size > 1_100_000) {
      setMsg({ kind: "err", text: "Banner image is too large — keep it under ~1 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCover((c) => ({ url: String(reader.result), pos: c?.pos ?? 50, touched: true }));
      setDirty(true);
    };
    reader.readAsDataURL(file);
  };

  const resetLayout = () => {
    setWorld({ elements: { ...DEFAULT_WORLD.elements } });
    setMsg({ kind: "ok", text: "Layout back to the default arrangement — environment and styling kept. Save to persist." });
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      // banner/cover first — same endpoint Edit Profile uses (profiles table)
      if (cover?.touched) {
        const cres = await fetch("/api/me/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coverUrl: cover.url, coverPos: cover.pos }),
        });
        if (!cres.ok) {
          const cd = await cres.json().catch(() => ({} as { error?: string }));
          setMsg({ kind: "err", text: (cd as { error?: string }).error || "Banner save failed — nothing else was changed." });
          setBusy(false);
          return;
        }
        setCover((c) => (c ? { ...c, touched: false } : c));
      }
      const res = await fetch("/api/me/studio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studio: cfg }),
      });
      const d = await res.json();
      if (!res.ok) setMsg({ kind: "err", text: d.error || "Save failed" });
      else {
        setDirty(false);
        setMsg({ kind: "ok", text: d.worldNote ? `Saved. ${d.worldNote}` : d.active ? "Saved — live on your public profile." : "Saved — will display as soon as Pro is active. Nothing was lost." });
        setMeta((m) => (m ? { ...m, saved: true, active: d.active } : m));
      }
    } catch {
      setMsg({ kind: "err", text: "Network error — nothing was saved." });
    }
    setBusy(false);
  };

  const reset = async () => {
    if (!window.confirm("Reset your profile to the standard Mavyn design? Your customization is deleted.")) return;
    setBusy(true);
    const res = await fetch("/api/me/studio", { method: "DELETE" });
    if (res.ok) {
      setCfg(DEFAULT_STUDIO);
      setDirty(false);
      setMsg({ kind: "ok", text: "Back to the standard Mavyn design." });
      setMeta((m) => (m ? { ...m, saved: false, active: false } : m));
    }
    setBusy(false);
  };

  if (user === undefined)
    return <div className="mx-auto max-w-4xl pt-10" aria-busy="true"><div className="h-8 w-56 animate-pulse rounded bg-card-raised" /><div className="mt-4 h-48 animate-pulse rounded-xl bg-card-raised" /></div>;
  if (user === null)
    return (
      <div className="mx-auto max-w-md pt-12 text-center">
        <h1 className="text-xl font-bold text-zinc-50">Profile Studio</h1>
        <p className="mt-2 text-sm text-zinc-500">Sign in to customize your profile.</p>
        <Link href="/login" className="btn-lime mt-4 inline-flex px-6 py-2 text-sm">Sign in</Link>
      </div>
    );

  const isPro = ["pro", "business_pro", "agency"].includes(user.plan ?? ""); // My World / Business World tiers
  const isCollege = user.plan === "college";
  const demoUnrestricted = user.testerMode !== "simulation" && !!user.demoTools;
  // College+ = "decorate the room" (student themes, frames, accents,
  // banners, decorations); Pro = "design the house" (all themes, layout,
  // My World). Backend enforces the same rules — this gate is UX only.
  const canEdit = isPro || isCollege || demoUnrestricted;
  const canWorld = isPro || demoUnrestricted;

  // SIMULATION MODE + not Pro → the real gate, config preserved
  if (meta && !canEdit)
    return (
      <div className="mx-auto max-w-md pt-12 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-400/30 bg-lime-400/10">
          <Palette className="h-7 w-7 text-lime-400" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">Profile Studio</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
          Full visual customization of your profile — themes, frames, accents, and section layout —
          is an <span className="font-semibold text-lime-300">Mavyn Pro</span> feature.
          {meta.saved && (
            <span className="mt-2 block text-zinc-400">
              Your previously saved customization is <span className="font-semibold text-zinc-200">preserved</span> and
              will display again the moment Pro is active.
            </span>
          )}
        </p>
        <Link href="/pro" className="btn-lime mt-5 inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-sm">
          <Sparkles className="h-4 w-4" /> Upgrade to Pro
        </Link>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-zinc-600">
          <Lock className="h-3 w-3" /> Appearance only — identity, verification, and safety are never customizable.
        </p>
      </div>
    );

  const theme = THEMES[cfg.theme];
  const accent = ACCENTS[cfg.accent];
  const frame = FRAMES[cfg.frame];
  const font = FONTS[cfg.font];
  const effect = EFFECTS[cfg.effect];
  const pickBtn = (active: boolean) =>
    `rounded-lg border p-2.5 text-left transition ${active ? "border-lime-400/50 bg-lime-400/10" : "border-line hover:border-zinc-600 hover:bg-card-raised"}`;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-lime-400">
            <Sparkles className="h-3.5 w-3.5" /> mavyn pro
          </p>
          <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
            <Palette className="h-6 w-6 text-lime-400" /> Profile Studio
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Make your profile yours — themes, frames, accents, and section order from the approved
            design system. Appearance only: navigation, messaging, payments, verification, and
            safety always stay standard Mavyn.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/creator/${user.handle}`} className="btn-ghost px-4 py-2 text-xs">
            <Eye className="h-3.5 w-3.5" /> Preview profile
          </Link>
          <button onClick={reset} disabled={busy} className="btn-ghost px-4 py-2 text-xs disabled:opacity-50">
            <RotateCcw className="h-3.5 w-3.5" /> Reset to default
          </button>
          <button onClick={save} disabled={busy || !dirty} data-guide="studio-save" className="btn-lime rounded-md px-5 py-2 text-xs disabled:opacity-50">
            {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </header>

      {!isPro && demoUnrestricted && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/5 px-4 py-2.5 text-[11px] leading-relaxed text-zinc-400">
          <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span><span className="font-semibold text-amber-300">DEMO MODE</span> — you can test every Studio option and save; only YOU see the preview on your profile until Pro is actually active. Simulation Mode enforces the real Pro gate.</span>
        </p>
      )}
      {msg && (
        <p className={`rounded-md border px-3 py-2 text-xs ${msg.kind === "ok" ? "border-lime-400/30 bg-lime-400/5 text-lime-300" : "border-red-500/30 bg-red-500/5 text-red-300"}`}>
          {msg.text}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {/* theme */}
          <section className="card p-5">
            <h2 className="text-sm font-bold text-zinc-100">Theme</h2>
            {isCollege && !demoUnrestricted && (
              <p className="mt-1 text-[10px] text-zinc-500">
                College+ — student preset themes. The full set (and My World) comes with Pro.
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(THEMES)
                .filter(([id]) => canWorld || (COLLEGE_THEMES as readonly string[]).includes(id))
                .map(([id, t]) => (
                <button key={id} onClick={() => set("theme", id)} className={pickBtn(cfg.theme === id)}>
                  <span className={`block h-2 w-full rounded-full ${t.deco || "bg-zinc-800"}`} />
                  <span className="mt-2 block text-xs font-semibold text-zinc-100">{t.label}</span>
                  <span className="block text-[10px] text-zinc-500">{t.desc}</span>
                  {cfg.theme === id && <Check className="mt-1 h-3 w-3 text-lime-400" />}
                </button>
              ))}
            </div>
          </section>

          {/* frame + accent + font + effect */}
          <section className="card grid gap-5 p-5 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Profile-picture frame</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(FRAMES).map(([id, f]) => (
                  <button key={id} onClick={() => set("frame", id)} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${cfg.frame === id ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Accent color</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(ACCENTS).map(([id, a]) => (
                  <button key={id} onClick={() => set("accent", id)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${cfg.accent === id ? "border-lime-400/50 bg-lime-400/10 text-zinc-100" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${a.bar}`} /> {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Heading font</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(FONTS).map(([id, f]) => (
                  <button key={id} onClick={() => set("font", id)} className={`rounded-full border px-3 py-1.5 text-xs transition ${f.cls} ${cfg.font === id ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-zinc-600">Approved, readability-tested families only.</p>
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Cosmetic effect</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(EFFECTS).map(([id, e]) => (
                  <button key={id} onClick={() => set("effect", id)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${cfg.effect === id ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* THE banner/cover — the real profile image behind your world */}
          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
              <ImageIcon className="h-4 w-4 text-lime-400" /> Profile banner / cover
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              The real cover image on your profile — the same one Edit Profile manages. In My World
              it becomes the top of your environment; on the standard profile it sits across the
              header. Saved with everything else when you press Save.
            </p>
            <div className="mt-3 flex flex-wrap items-start gap-4">
              <div className="w-full max-w-xs overflow-hidden rounded-lg border border-line">
                {cover?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover.url} alt="Current banner" className="h-24 w-full object-cover" style={{ objectPosition: `center ${cover.pos}%` }} />
                ) : (
                  <div className="flex h-24 w-full items-center justify-center bg-card-raised text-[11px] text-zinc-600">No banner yet</div>
                )}
              </div>
              <div className="min-w-[12rem] flex-1 space-y-3">
                <label className="btn-ghost inline-flex cursor-pointer px-4 py-2 text-xs">
                  <ImageIcon className="h-3.5 w-3.5" /> {cover?.url ? "Replace banner" : "Upload banner"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pickCover(e.target.files?.[0] ?? null)} />
                </label>
                {cover?.url && (
                  <>
                    <label className="block text-[10px] text-zinc-500">
                      Vertical position — {cover.pos}%
                      <input
                        type="range" min={0} max={100} value={cover.pos}
                        onChange={(e) => { setCover((c) => (c ? { ...c, pos: Number(e.target.value), touched: true } : c)); setDirty(true); }}
                        className="mt-1 w-full accent-lime-400"
                      />
                    </label>
                    <button
                      onClick={() => { setCover((c) => (c ? { url: null, pos: 50, touched: true } : c)); setDirty(true); }}
                      className="flex items-center gap-1.5 rounded-full border border-red-500/30 px-3 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3 w-3" /> Remove banner
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* banner + decorations — the "decorate your room" layer */}
          <section className="card grid gap-5 p-5 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Banner</h2>
              <p className="mt-0.5 text-[10px] text-zinc-600">An approved color strip across the top of your profile card.</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {Object.entries(BANNERS).map(([id, b]) => (
                  <button key={id} onClick={() => set("banner", id)} className={`overflow-hidden rounded-lg border text-left transition ${(cfg.banner ?? "none") === id ? "border-lime-400/60" : "border-line hover:border-zinc-600"}`}>
                    <span className="block h-4 w-full" style={b.css ? { backgroundImage: b.css } : { background: "#27272a" }} />
                    <span className="block px-2 py-1 text-[10px] font-semibold text-zinc-300">{b.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">Decorations</h2>
              <p className="mt-0.5 text-[10px] text-zinc-600">Up to three ornaments on your profile card — stars, hearts, vines…</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(DECORATIONS).map(([id, d]) => {
                  const on = (cfg.decorations ?? []).includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        const cur = cfg.decorations ?? [];
                        set("decorations", on ? cur.filter((x) => x !== id) : cur.length >= 3 ? cur : [...cur, id]);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* MY WORLD — the owner-designed environment */}
          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
                  <Globe2 className="h-4 w-4 text-lime-400" /> My World
                </h2>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-500">
                  Turn your profile into your own environment: pick a scene, then move, rotate,
                  layer, and hide approved elements. Visitors on phones always get a clean stacked
                  version — your world never breaks mobile.
                </p>
              </div>
              {canWorld ? (
                <button
                  onClick={() => setWorld({ enabled: !world.enabled })}
                  className={`rounded-full border px-4 py-1.5 text-xs font-bold transition ${world.enabled ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}
                >
                  {world.enabled ? "My World is ON" : "Turn on My World"}
                </button>
              ) : (
                <Link href="/pro" className="flex items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/5 px-4 py-1.5 text-xs font-bold text-lime-300 hover:bg-lime-400/15">
                  <Lock className="h-3 w-3" /> My World is Pro — upgrade
                </Link>
              )}
            </div>

            {world.enabled && canWorld && (
              <div className="mt-4 rounded-xl border border-lime-400/25 bg-lime-400/5 p-4">
                <p className="text-xs leading-relaxed text-zinc-400">
                  <span className="font-semibold text-lime-300">Your world is edited full-screen, on the real thing.</span>{" "}
                  The editor opens your actual profile — same components, same banner, same data
                  visitors see — and you grab, drag, and resize the cards directly. No abstract
                  canvas.
                </p>
                <Link
                  href="/profile/studio/world"
                  className="btn-lime mt-3 inline-flex rounded-md px-5 py-2 text-xs"
                >
                  Open My World editor — full screen →
                </Link>
              </div>
            )}
          </section>

          {/* layout — Pro designs the house; College+ keeps the structure */}
          {!canWorld ? (
            <section className="card p-5">
              <h2 className="text-sm font-bold text-zinc-100">Section layout</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Reordering sections (and My World) is part of the full Pro Studio — College+ keeps
                the standard Mavyn structure while you decorate it.
              </p>
              <Link href="/pro" className="btn-lime mt-3 inline-flex rounded-md px-4 py-1.5 text-xs">Upgrade to Pro</Link>
            </section>
          ) : (
          <section className="card p-5">
            <h2 className="text-sm font-bold text-zinc-100">Section layout</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Reorder your profile&apos;s content sections. The header (name, identity, actions) is fixed —
              that&apos;s Mavyn&apos;s, always.
            </p>
            <ul className="mt-3 space-y-1.5">
              {cfg.sections.map((id, i) => (
                <li key={id} className="flex items-center gap-2 rounded-lg border border-line bg-card-raised px-3 py-2">
                  <span className="font-mono text-[10px] text-zinc-600">{i + 1}</span>
                  <span className="flex-1 text-sm text-zinc-200">{SECTION_LABELS[id] ?? id}</span>
                  <button onClick={() => moveSection(id, -1)} disabled={i === 0} className="icon-btn h-7 w-7 disabled:opacity-30" aria-label={`Move ${SECTION_LABELS[id]} up`}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => moveSection(id, 1)} disabled={i === cfg.sections.length - 1} className="icon-btn h-7 w-7 disabled:opacity-30" aria-label={`Move ${SECTION_LABELS[id]} down`}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
          )}
        </div>

        {/* live preview */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Live preview</p>
          <div className={`rounded-2xl ${theme.wash} ${theme.wash ? "p-2" : ""}`}>
            {theme.deco && <div className={`mb-2 h-1 rounded-full ${theme.deco}`} aria-hidden />}
            <div className={`card p-4 ${theme.card} ${theme.headerRing} ${effect.cls}`}>
              <div className="flex items-center gap-3">
                <span className={`inline-flex ${frame.cls}`}>
                  <Avatar src={user.profile.avatarUrl} initials={user.profile.displayName.charAt(0)} size="md" />
                </span>
                <div>
                  <p className={`text-sm font-bold text-zinc-50 ${font.cls}`}>{user.profile.displayName}</p>
                  <p className="text-xs text-zinc-500">@{user.handle}</p>
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-xs text-zinc-400">{user.profile.bio || "Your bio"}</p>
            </div>
            <div className={`card mt-2 p-4 ${theme.card} ${effect.cls}`}>
              <p className={`text-xs font-bold ${accent.text} ${font.cls}`}>{SECTION_LABELS[cfg.sections[0]]}</p>
              <div className="mt-2 h-2 w-3/4 rounded bg-zinc-800" />
              <div className="mt-1.5 h-2 w-1/2 rounded bg-zinc-800" />
            </div>
            <div className={`card mt-2 p-4 ${theme.card} ${effect.cls}`}>
              <p className={`text-xs font-bold ${accent.text} ${font.cls}`}>{SECTION_LABELS[cfg.sections[1]]}</p>
              <div className="mt-2 h-2 w-2/3 rounded bg-zinc-800" />
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
            Save, then open your public profile — what you see there is what every visitor sees
            {isPro ? "" : " once Pro is active"}.
          </p>
        </aside>
      </div>
    </div>
  );
}
