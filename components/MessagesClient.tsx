"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send, ChevronLeft, Briefcase, Flag, Paperclip, Plus, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import ProjectDrawer, { type ProjectStage, type ExtensionState } from "@/components/ProjectDrawer";
import ProjectBar from "@/components/ProjectBar";
import ReportModal from "@/components/ReportModal";
import { conversations as baseConversations, creators, serviceCatalog, type Conversation } from "@/lib/data";

/* ------------------------------------------------------------------ */
/* Fully dynamic messaging: every conversation has its own ID and      */
/* participant, and its own project/payment/extension state. Nothing   */
/* is hardcoded to a specific creator. Hire Me / Message anywhere      */
/* deep-links here with ?to=<creatorId> — if no conversation exists,   */
/* one is created for that creator on the spot.                        */
/* ------------------------------------------------------------------ */

interface ExtraMsg {
  from: "me" | "them";
  text: string;
}

/** everything a conversation's project needs, keyed by conversation id */
interface ProjectState {
  stage: ProjectStage;
  amount: number;
  extension: ExtensionState;
  extras: ExtraMsg[];
  discussing: boolean;
}

const freshProject = (startingAt: number): ProjectState => ({
  stage: "idle",
  amount: startingAt,
  extension: "none",
  extras: [],
  discussing: false,
});

/** synthesize a conversation for any creator we haven't talked to yet */
function conversationFor(creatorId: string): Conversation | null {
  const c = creators.find((x) => x.id === creatorId);
  if (!c) return null;
  const svc = serviceCatalog.find((s) => s.creatorId === c.id);
  return {
    id: c.id,
    creatorId: c.id,
    service: svc?.title ?? c.role,
    startingAt: svc?.startingAt ?? c.startingAt ?? 100,
    name: c.name,
    role: c.role,
    avatar: c.avatar,
    initials: c.initials,
    gradient: c.gradient,
    lastMessage: "New conversation",
    time: "now",
    unread: 0,
    online: !!c.online,
    messages: [
      {
        from: "me",
        text: `Hi ${c.name.split(" ")[0]}! I'm interested in your ${svc?.title ?? c.role} service.`,
        time: "now",
      },
    ],
  };
}

export default function MessagesClient() {
  const params = useSearchParams();
  const to = params.get("to");

  const [convos, setConvos] = useState<Conversation[]>(baseConversations);
  const [activeId, setActiveId] = useState<string>(baseConversations[0].id);
  const [draft, setDraft] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projects, setProjects] = useState<Record<string, ProjectState>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  /* ?to=creatorId → open (or create) that creator's conversation */
  useEffect(() => {
    if (!to) return;
    setConvos((cur) => {
      const existing = cur.find((c) => c.creatorId === to || c.id === to);
      if (existing) {
        setActiveId(existing.id);
        return cur;
      }
      const made = conversationFor(to);
      if (!made) return cur;
      setActiveId(made.id);
      return [made, ...cur];
    });
  }, [to]);

  const active = convos.find((c) => c.id === activeId);
  const hireable = !!active?.creatorId && !!active?.service;
  const project = active ? projects[active.id] ?? freshProject(active.startingAt ?? 100) : null;

  const patchProject = (convId: string, patch: Partial<ProjectState>) =>
    setProjects((cur) => {
      const conv = convos.find((c) => c.id === convId);
      const base = cur[convId] ?? freshProject(conv?.startingAt ?? 100);
      return { ...cur, [convId]: { ...base, ...patch } };
    });

  const addMessage = (convId: string) => (from: "me" | "them", text: string) =>
    setProjects((cur) => {
      const conv = convos.find((c) => c.id === convId);
      const base = cur[convId] ?? freshProject(conv?.startingAt ?? 100);
      return { ...cur, [convId]: { ...base, extras: [...base.extras, { from, text }] } };
    });

  const offPlatform = /cash\s?app|venmo|zelle|paypal\.me|wire\s?transfer/i.test(draft);
  const hasProject = project && !["idle", "form", "review"].includes(project.stage);

  const openProject = () => {
    if (!active || !hireable) return;
    if ((projects[active.id]?.stage ?? "idle") === "idle") patchProject(active.id, { stage: "form" });
    setDrawerOpen(true);
  };

  return (
    <div className="card flex h-[calc(100dvh-12rem)] min-h-[480px] overflow-hidden md:h-[calc(100vh-8.5rem)]">
      {/* conversation list */}
      <div className={`w-full shrink-0 overflow-y-auto border-line sm:w-72 sm:border-r ${active ? "hidden sm:block" : "block"}`}>
        <div className="border-b border-line-soft p-4">
          <h1 className="text-lg font-bold text-zinc-50">Messages</h1>
          <p className="text-xs text-zinc-500">Creators, clients, brands, and communities.</p>
        </div>
        <ul>
          {convos.map((c) => {
            const p = projects[c.id];
            const inProject = p && !["idle", "form", "review"].includes(p.stage);
            return (
              <li key={c.id}>
                <button
                  onClick={() => {
                    setActiveId(c.id);
                    setDrawerOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-card-raised ${c.id === activeId ? "bg-card-raised" : ""}`}
                >
                  <span className="relative">
                    <Avatar src={c.avatar} initials={c.initials} gradient={c.gradient} size="md" />
                    {c.online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-violet-400" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-zinc-100">{c.name}</span>
                      <span className="shrink-0 text-[10px] text-zinc-500">{c.time}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className="truncate text-xs text-zinc-500">
                        {inProject ? (
                          <span className="font-medium text-lime-400">● Active project · ${p!.amount}</span>
                        ) : (
                          c.lastMessage
                        )}
                      </span>
                      {c.unread > 0 && (
                        <span className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-400 text-[9px] font-bold text-zinc-950">
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* chat */}
      {active && project && (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-line-soft p-3.5">
            <button className="icon-btn -ml-1 sm:hidden" onClick={() => setActiveId("")} aria-label="Back">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <Avatar src={active.avatar} initials={active.initials} gradient={active.gradient} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-100">{active.name}</p>
              <p className="text-xs text-zinc-500">
                {active.role} • {active.online ? <span className="text-lime-400">online</span> : "offline"}
              </p>
            </div>
            <button onClick={() => setReportOpen(true)} className="icon-btn h-9 w-9" aria-label="Report or get help" title="Report / Get Help">
              <Flag className="h-4 w-4" />
            </button>
            {hireable && (
              <button onClick={openProject} className="btn-ghost px-3 py-1.5 text-xs" title="Turn this conversation into a project">
                {hasProject ? <Briefcase className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{hasProject ? "View Project" : "Create Project"}</span>
              </button>
            )}
          </div>

          {/* this conversation's project — never someone else's */}
          {hasProject && (
            <ProjectBar
              title={`${active.service}`}
              amount={project.amount}
              stage={project.stage}
              onOpen={() => setDrawerOpen(true)}
            />
          )}

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {active.messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.from === "me" ? "rounded-br-md bg-zinc-100 text-zinc-950" : "rounded-bl-md border border-line bg-card-raised text-zinc-200"}`}>
                  {m.text}
                  <span className={`mt-1 block text-[10px] ${m.from === "me" ? "text-zinc-950/60" : "text-zinc-500"}`}>{m.time}</span>
                </div>
              </div>
            ))}
            {project.extras.map((m, i) => (
              <div key={`x-${i}`} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.from === "me" ? "rounded-br-md bg-zinc-100 text-zinc-950" : "rounded-bl-md border border-line bg-card-raised text-zinc-200"}`}>
                  {m.text}
                  <span className={`mt-1 block text-[10px] ${m.from === "me" ? "text-zinc-950/60" : "text-zinc-500"}`}>now</span>
                </div>
              </div>
            ))}
          </div>

          {/* discussing an extension: context strip above the composer */}
          {project.discussing && project.extension === "requested" && (
            <div className="flex items-center gap-2 border-t border-amber-400/30 bg-amber-400/5 px-4 py-2">
              <p className="min-w-0 flex-1 truncate text-xs text-amber-300">
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />
                Discussing {active.name.split(" ")[0]}&apos;s extension request (+2 days)
              </p>
              <button
                onClick={() => setDrawerOpen(true)}
                className="shrink-0 rounded-full border border-amber-400/40 px-2.5 py-1 text-[10px] font-semibold text-amber-300"
              >
                Decide
              </button>
              <button onClick={() => patchProject(active.id, { discussing: false })} className="text-zinc-500 hover:text-zinc-300" aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {offPlatform && (
            <div className="border-t border-amber-400/30 bg-amber-400/5 px-4 py-2.5">
              <p className="text-xs leading-relaxed text-amber-300">
                ⚠️ <span className="font-bold">Stay protected.</span> Never send payment outside
                UpNova — outside payments may not be covered by transaction protections.
              </p>
            </div>
          )}
          <div className="flex items-center gap-2 border-t border-line-soft p-3">
            <button className="icon-btn h-9 w-9" aria-label="Attach">
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                project.discussing && project.extension === "requested"
                  ? `Message ${active.name.split(" ")[0]} about this extension…`
                  : `Message ${active.name}…`
              }
              className="input-dark rounded-full"
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  addMessage(active.id)("me", draft.trim());
                  setDraft("");
                }
              }}
            />
            <button
              onClick={() => {
                if (draft.trim()) addMessage(active.id)("me", draft.trim());
                setDraft("");
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-950 transition hover:bg-white"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* one reusable project drawer — keyed per conversation, zero leakage */}
      {active && hireable && project && (
        <ProjectDrawer
          key={active.id}
          creatorName={active.name}
          creatorAvatar={active.avatar}
          creatorInitials={active.initials}
          creatorGradient={active.gradient}
          service={active.service!}
          startingAt={active.startingAt ?? 100}
          open={drawerOpen}
          stage={project.stage}
          setStage={(stage) => patchProject(active.id, { stage })}
          extension={project.extension}
          setExtension={(extension) => patchProject(active.id, { extension })}
          onClose={() => setDrawerOpen(false)}
          onMessage={addMessage(active.id)}
          onAmount={(amount) => patchProject(active.id, { amount })}
          onDiscuss={() => {
            patchProject(active.id, { discussing: true });
            setDrawerOpen(false);
            setTimeout(() => inputRef.current?.focus(), 150);
          }}
        />
      )}

      {reportOpen && active && (
        <ReportModal context={`Conversation · ${active.name}`} onClose={() => setReportOpen(false)} />
      )}
    </div>
  );
}
