"use client";

import { useState } from "react";
import { Send, ChevronLeft, Briefcase, Flag, Paperclip, Plus } from "lucide-react";
import Avatar from "@/components/Avatar";
import ProjectDrawer, { type ProjectStage } from "@/components/ProjectDrawer";
import ProjectBar from "@/components/ProjectBar";
import ReportModal from "@/components/ReportModal";
import { conversations, creators } from "@/lib/data";

/* Messages: the chat stays a chat. Hiring lives behind "+ Create
   Project" (deliberate action, top right) which opens a side drawer —
   the conversation stays visible. Once an offer exists, a slim project
   bar sits above the thread. No boxes inside the conversation. */

interface ExtraMsg {
  from: "me" | "them";
  text: string;
}

export default function MessagesPage() {
  const [activeId, setActiveId] = useState<string>(conversations[0].id);
  const [draft, setDraft] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [stage, setStage] = useState<ProjectStage>("idle");
  const [projectAmount, setProjectAmount] = useState(250);
  const [extras, setExtras] = useState<ExtraMsg[]>([]);

  const active = conversations.find((c) => c.id === activeId);
  const ava = creators.find((c) => c.id === "ava")!;
  const offPlatform = /cash\s?app|venmo|zelle|paypal\.me|wire\s?transfer/i.test(draft);
  const hasProject = !["idle", "form", "review"].includes(stage);

  const addMessage = (from: "me" | "them", text: string) => setExtras((m) => [...m, { from, text }]);

  const openProject = () => {
    if (stage === "idle") setStage("form");
    setDrawerOpen(true);
  };

  return (
    <div className="card flex h-[calc(100dvh-12rem)] min-h-[480px] overflow-hidden md:h-[calc(100vh-8.5rem)]">
      {/* conversation list */}
      <div
        className={`w-full shrink-0 overflow-y-auto border-line sm:w-72 sm:border-r ${
          active ? "hidden sm:block" : "block"
        }`}
      >
        <div className="border-b border-line-soft p-4">
          <h1 className="text-lg font-bold text-zinc-50">Messages</h1>
          <p className="text-xs text-zinc-500">Creators, clients, brands, and communities.</p>
        </div>
        <ul>
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-card-raised ${
                  c.id === activeId ? "bg-card-raised" : ""
                }`}
              >
                <span className="relative">
                  <Avatar src={c.avatar} initials={c.initials} gradient={c.gradient} size="md" />
                  {c.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-violet-400" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-100">{c.name}</span>
                    <span className="shrink-0 text-[10px] text-zinc-500">{c.time}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-xs text-zinc-500">{c.lastMessage}</span>
                    {c.unread > 0 && (
                      <span className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-400 text-[9px] font-bold text-zinc-950">
                        {c.unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* chat */}
      {active && (
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
            <button
              onClick={() => setReportOpen(true)}
              className="icon-btn h-9 w-9"
              aria-label="Report or get help"
              title="Report / Get Help"
            >
              <Flag className="h-4 w-4" />
            </button>
            {active.id === "ava" && (
              <button
                onClick={openProject}
                className="btn-ghost px-3 py-1.5 text-xs"
                title="Turn this conversation into a project"
              >
                {hasProject ? <Briefcase className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{hasProject ? "View Project" : "Create Project"}</span>
              </button>
            )}
          </div>

          {/* project status bar — the project is structured; the chat is not */}
          {active.id === "ava" && hasProject && (
            <ProjectBar
              title="Creator Meetup Photography"
              amount={projectAmount}
              stage={stage}
              onOpen={() => setDrawerOpen(true)}
            />
          )}

          {/* the conversation — nothing interrupts it */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {active.messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.from === "me"
                      ? "rounded-br-md bg-zinc-100 text-zinc-950"
                      : "rounded-bl-md border border-line bg-card-raised text-zinc-200"
                  }`}
                >
                  {m.text}
                  <span className={`mt-1 block text-[10px] ${m.from === "me" ? "text-zinc-950/60" : "text-zinc-500"}`}>
                    {m.time}
                  </span>
                </div>
              </div>
            ))}
            {active.id === "ava" &&
              extras.map((m, i) => (
                <div key={`x-${i}`} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.from === "me"
                        ? "rounded-br-md bg-zinc-100 text-zinc-950"
                        : "rounded-bl-md border border-line bg-card-raised text-zinc-200"
                    }`}
                  >
                    {m.text}
                    <span className={`mt-1 block text-[10px] ${m.from === "me" ? "text-zinc-950/60" : "text-zinc-500"}`}>
                      now
                    </span>
                  </div>
                </div>
              ))}
          </div>

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
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${active.name}…`}
              className="input-dark rounded-full"
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) {
                  if (active.id === "ava") addMessage("me", draft.trim());
                  setDraft("");
                }
              }}
            />
            <button
              onClick={() => {
                if (draft.trim() && active.id === "ava") addMessage("me", draft.trim());
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

      {/* the project drawer — conversation stays visible on desktop */}
      <ProjectDrawer
        creatorName={ava.name}
        creatorAvatar={ava.avatar}
        creatorInitials={ava.initials}
        creatorGradient={ava.gradient}
        service="Event Photography"
        startingAt={ava.startingAt ?? 250}
        open={drawerOpen}
        stage={stage}
        setStage={setStage}
        onClose={() => setDrawerOpen(false)}
        onMessage={addMessage}
        onAmount={setProjectAmount}
      />

      {reportOpen && active && (
        <ReportModal context={`Conversation · ${active.name}`} onClose={() => setReportOpen(false)} />
      )}
    </div>
  );
}
