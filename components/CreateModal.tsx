"use client";

import { useEffect, useState } from "react";
import {
  X,
  FileText,
  Briefcase,
  Sparkles,
  Users,
  Calendar,
  BarChart2,
  Radio,
  MapPin,
  Check,
} from "lucide-react";
import { CREATE_MODAL_EVENT, openCreateModal } from "./CreateModalTrigger";
import { reachOptions, type Reach } from "@/lib/data";
import Avatar from "./Avatar";
import { currentUser } from "@/lib/data";

const createOptions = [
  { kind: "Post", icon: FileText, desc: "Share something with the community." },
  { kind: "Opportunity", icon: Briefcase, desc: "Find someone for a job/project." },
  { kind: "Service", icon: Sparkles, desc: "Offer your skills for money." },
  { kind: "Community", icon: Users, desc: "Create a local community." },
  { kind: "Event", icon: Calendar, desc: "Create something happening in your area." },
  { kind: "Poll", icon: BarChart2, desc: "Ask your audience." },
  { kind: "Live", icon: Radio, desc: "Go live." },
];

export default function CreateModal() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string | null>(null);
  const [reach, setReach] = useState<Reach>("Local");
  const [text, setText] = useState("");
  const [posted, setPosted] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      setKind((e as CustomEvent).detail ?? null);
      setPosted(false);
      setOpen(true);
    };
    window.addEventListener(CREATE_MODAL_EVENT, handler);
    return () => window.removeEventListener(CREATE_MODAL_EVENT, handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  const reset = () => {
    setOpen(false);
    setKind(null);
    setText("");
    setPosted(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={reset} />
      <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-card p-5 shadow-card animate-fade-up sm:max-w-lg sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-50">
            {kind ? `Create ${kind}` : "Create on UpNova"}
          </h2>
          <button onClick={reset} className="icon-btn -mr-2" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {posted ? (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lime-400/15">
              <Check className="h-7 w-7 text-lime-400" />
            </span>
            <p className="mt-4 text-base font-semibold text-zinc-100">
              {kind} published 🎉
            </p>
            <p className="mt-1 max-w-xs text-sm text-zinc-400">
              Shared with <span className="text-lime-300">{reach}</span> reach. In the full build
              this goes straight to your followers and discovery.
            </p>
            <button onClick={reset} className="btn-ghost mt-6">
              Done
            </button>
          </div>
        ) : !kind ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {createOptions.map((opt) => (
              <button
                key={opt.kind}
                onClick={() => setKind(opt.kind)}
                className="group flex items-start gap-3 rounded-2xl border border-line bg-card-raised p-4 text-left transition hover:border-lime-400/40 hover:bg-card-hover"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-400/10 text-lime-400 transition group-hover:bg-lime-400 group-hover:text-zinc-950">
                  <opt.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-zinc-100">{opt.kind}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                    {opt.desc}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar src={currentUser.avatar} initials={currentUser.initials} size="sm" />
              <div>
                <p className="text-sm font-semibold text-zinc-100">{currentUser.name}</p>
                <p className="text-xs text-zinc-500">{currentUser.location}</p>
              </div>
            </div>

            <input
              className="input-dark"
              placeholder={
                kind === "Service"
                  ? "e.g. Music Production, starting at $300"
                  : kind === "Event"
                  ? "Event name"
                  : `Give your ${kind.toLowerCase()} a title…`
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <textarea
              className="input-dark min-h-24 resize-none"
              placeholder="Add details…"
              rows={3}
            />

            {/* Reach selector — the defining UpNova feature */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <MapPin className="h-3.5 w-3.5 text-lime-400" /> Visibility / Reach
              </p>
              <div className="flex flex-wrap gap-1.5">
                {reachOptions.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setReach(r.value)}
                    title={r.hint}
                    className={`chip ${reach === r.value ? "border-white/50 bg-white/10 text-zinc-100" : "hover:border-zinc-600"}`}
                  >
                    {r.label}
                    <span className="hidden text-[10px] text-zinc-500 sm:inline">
                      {r.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button onClick={() => setKind(null)} className="text-sm text-zinc-500 transition hover:text-zinc-300">
                ← Back
              </button>
              <button onClick={() => setPosted(true)} className="btn-lime px-6">
                Publish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
