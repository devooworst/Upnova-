"use client";

/* ------------------------------------------------------------------ */
/*  Applicant review — the poster side of Opportunities.               */
/*  Shortlist → Select → a real Project is created automatically       */
/*  between poster (client) and applicant (creator), attached to a     */
/*  fresh conversation. "Need to check my schedule" answers surface    */
/*  as amber flags exactly where the decision happens.                 */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Star } from "lucide-react";
import Avatar from "@/components/Avatar";

interface Applicant {
  id: string;
  message: string;
  availability: "yes" | "need_check";
  status: "submitted" | "shortlisted" | "selected" | "declined";
  createdAt: string;
  applicant: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    roleLine: string;
    city: string | null;
    state: string | null;
    trustLevel: string;
  };
}

interface Payload {
  opportunity: { id: string; title: string; budget: number | null; status: string };
  applications: Applicant[];
}

export default function ApplicantsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/opportunities/${id}/applications`, { cache: "no-store" });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Not available");
      return;
    }
    setData(d);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (appId: string, action: "shortlist" | "select" | "decline") => {
    const res = await fetch(`/api/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await res.json();
    if (res.ok && action === "select" && d.conversationId) setSelectedConv(d.conversationId);
    load();
  };

  if (error)
    return (
      <div className="mx-auto max-w-2xl py-10 text-center">
        <p className="text-sm font-semibold text-zinc-200">{error}</p>
        <p className="mt-1 text-xs text-zinc-500">Only the poster of an opportunity can review its applicants.</p>
        <button onClick={() => router.push("/opportunities")} className="btn-ghost mt-4 px-4 py-1.5 text-xs">
          Back to Opportunities
        </button>
      </div>
    );

  if (!data)
    return <div className="mx-auto max-w-2xl animate-pulse py-10"><div className="card h-32" /></div>;

  const { opportunity, applications } = data;
  const order = { submitted: 1, shortlisted: 0, selected: -1, declined: 2 };
  const sorted = [...applications].sort((a, b) => order[a.status] - order[b.status]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/opportunities" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Opportunities
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-50">Applicants</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {opportunity.title}
          {opportunity.budget != null && (
            <span className="ml-2 font-mono text-sm font-medium tracking-[0.08em] text-lime-300">
              ${opportunity.budget}
            </span>
          )}
          {opportunity.status === "filled" && (
            <span className="ml-2 rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime-300">
              Filled
            </span>
          )}
        </p>
      </div>

      {selectedConv && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-lime-400/40 bg-lime-400/5 px-4 py-3">
          <p className="text-sm text-zinc-200">
            <span className="font-semibold text-lime-300">Project created.</span> A conversation with your
            selected creator is ready.
          </p>
          <Link href={`/messages?c=${selectedConv}`} className="btn-lime shrink-0 px-4 py-1.5 text-xs">
            Open conversation
          </Link>
        </div>
      )}

      {sorted.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm font-semibold text-zinc-200">No applications yet</p>
          <p className="mt-1 text-xs text-zinc-500">Applicants will appear here the moment they apply.</p>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((a) => (
          <article
            key={a.id}
            className={`card p-4 ${a.status === "declined" ? "opacity-50" : ""} ${
              a.status === "selected" ? "border-lime-400/40" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <Link href={`/creator/${a.applicant.handle}`}>
                <Avatar src={a.applicant.avatarUrl} initials={a.applicant.displayName.charAt(0)} size="md" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-100">
                  <Link href={`/creator/${a.applicant.handle}`} className="hover:text-violet-300">
                    {a.applicant.displayName}
                  </Link>
                  {a.availability === "yes" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold text-lime-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> Available on date
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Needs to check schedule
                    </span>
                  )}
                  {a.status !== "submitted" && (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        a.status === "selected"
                          ? "border-lime-400/40 text-lime-300"
                          : a.status === "shortlisted"
                            ? "border-violet-400/40 text-violet-300"
                            : "border-line text-zinc-500"
                      }`}
                    >
                      {a.status}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {a.applicant.roleLine}
                  {a.applicant.city ? ` · ${a.applicant.city}${a.applicant.state ? `, ${a.applicant.state}` : ""}` : ""}
                </p>
                {a.message && <p className="mt-2 text-xs leading-relaxed text-zinc-300">{a.message}</p>}
              </div>
            </div>

            {opportunity.status !== "filled" && a.status !== "declined" && a.status !== "selected" && (
              <div className="mt-3 flex items-center gap-2 border-t border-line-soft pt-3">
                {a.status === "submitted" && (
                  <button
                    onClick={() => act(a.id, "shortlist")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 px-3.5 py-1.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-400/10"
                  >
                    <Star className="h-3.5 w-3.5" /> Shortlist
                  </button>
                )}
                <button
                  onClick={() => act(a.id, "select")}
                  className="btn-lime inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs"
                >
                  <Check className="h-3.5 w-3.5" /> Select — create project
                </button>
                <button
                  onClick={() => act(a.id, "decline")}
                  className="ml-auto rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:text-rose-300"
                >
                  Decline
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-600">
        Selecting an applicant closes the opportunity, notifies everyone, and creates a project in{" "}
        <span className="text-zinc-400">draft</span> — the full lifecycle (offer → payment → delivery → review)
        continues in Messages.
      </p>
    </div>
  );
}
