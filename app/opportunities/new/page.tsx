"use client";

/* ------------------------------------------------------------------ */
/*  Post an opportunity — and decide what applicants must provide.     */
/*  Availability is added automatically when the gig has a date;       */
/*  profile + portfolio always attach automatically. The poster only   */
/*  controls what's genuinely theirs to ask.                           */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Briefcase, Plus, X, Users } from "lucide-react";
import type { OppRole } from "@/lib/opportunityRoles";

const inputCls =
  "w-full rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-lime-400/50";

export default function NewOpportunityPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [paid, setPaid] = useState(true);
  const [budget, setBudget] = useState("");
  const [location, setLocation] = useState("");
  const [remote, setRemote] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [applyBy, setApplyBy] = useState("");
  const [studentFriendly, setStudentFriendly] = useState(false);
  // applicant requirements — poster-controlled
  const [requireMessage, setRequireMessage] = useState(true);
  const [question, setQuestion] = useState("");
  // TEAM & OPENINGS — roles are configuration, not a separate system
  const [roles, setRoles] = useState<OppRole[]>([]);
  const [selection, setSelection] = useState<"manual" | "shortlist">("manual");
  const [notifyUnselected, setNotifyUnselected] = useState(true);
  const newRole = () =>
    setRoles((r) => [...r, { id: Math.random().toString(36).slice(2, 10), title: "", count: 1, pay: null }]);
  const patchRole = (id: string, patch: Partial<OppRole>) =>
    setRoles((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const rmRole = (id: string) => setRoles((r) => r.filter((x) => x.id !== id));
  const totalComp = roles.reduce((sum, r) => sum + (r.pay ?? 0) * r.count, 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      setError("Give it a title");
      return;
    }
    const activeRoles = roles.filter((r) => r.title.trim());
    if (roles.some((r) => !r.title.trim())) {
      setError("Every role needs a title — or remove the empty row");
      return;
    }
    if (paid && activeRoles.length === 0 && (!budget || Number(budget) < 1)) {
      setError("Set the budget — or switch to Collaboration");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        // with roles, the budget is the sum of role compensation
        budget: paid ? (activeRoles.length ? totalComp || Number(budget) || null : Number(budget)) : null,
        roles: activeRoles,
        selection,
        notifyUnselected,
        type: paid ? "gig" : "collab",
        location,
        remote,
        eventDate: eventDate || undefined,
        applyBy: applyBy || undefined,
        studentFriendly,
        requireMessage,
        question: question.trim() || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not post");
      if (res.status === 401) router.push("/login");
      return;
    }
    router.push("/opportunities");
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <Link href="/opportunities" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Opportunities
        </Link>
        <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
            <Briefcase className="h-5 w-5 text-lime-400" />
          </span>
          Post an opportunity
        </h1>
      </div>

      <section className="card space-y-3 p-5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title — e.g. Drone Operator — Music Video" className={inputCls} maxLength={80} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What's the work, and what does a great applicant look like?" className={`${inputCls} resize-none`} />

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPaid(true)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${paid ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400"}`}
          >
            Paid
          </button>
          <button
            onClick={() => setPaid(false)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${!paid ? "border-violet-400/50 bg-violet-400/10 text-violet-300" : "border-line text-zinc-400"}`}
          >
            Collaboration
          </button>
          {paid && (
            <div className="relative w-32">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
              <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Budget" className={`${inputCls} py-1.5 pl-7`} />
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location — e.g. Baltimore, MD" className={inputCls} disabled={remote} />
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="accent-lime-400" />
            Remote
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">When (event/gig date, optional)</p>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Apply by (optional)</p>
            <input type="date" value={applyBy} onChange={(e) => setApplyBy(e.target.value)} className={inputCls} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={studentFriendly} onChange={(e) => setStudentFriendly(e.target.checked)} className="accent-violet-400" />
          Student-friendly — flexible with class schedules
        </label>
      </section>

      {/* TEAM & OPENINGS — one opportunity, multiple roles. Universal:
          a shoot needs Photographer×1 + Models×3; a concert needs
          Security×6 + Stagehands×4. Same form. */}
      <section className="card p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-zinc-100">
          <Users className="h-4 w-4 text-amber-300" /> Team &amp; openings
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Looking for more than one kind of person? Add roles — applicants pick which role they&apos;re
          applying for. Skip this for a single-role opportunity.
        </p>
        <div className="mt-3 space-y-2">
          {roles.map((r) => (
            <div key={r.id} className="rounded-xl border border-line p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={r.title}
                  onChange={(e) => patchRole(r.id, { title: e.target.value })}
                  placeholder="Role — e.g. Photographer, Model, Makeup Artist"
                  className={`${inputCls} min-w-[180px] flex-1 py-1.5 text-xs`}
                  maxLength={40}
                />
                <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                  Openings
                  <input
                    value={r.count}
                    onChange={(e) => patchRole(r.id, { count: Math.max(1, Number(e.target.value.replace(/[^0-9]/g, "")) || 1) })}
                    className={`${inputCls} w-14 py-1.5 text-center text-xs`}
                  />
                </label>
                {paid && (
                  <label className="flex items-center gap-1 text-xs text-zinc-400">
                    $
                    <input
                      value={r.pay ?? ""}
                      onChange={(e) => patchRole(r.id, { pay: e.target.value ? Number(e.target.value.replace(/[^0-9]/g, "")) || 0 : null })}
                      placeholder="each"
                      className={`${inputCls} w-20 py-1.5 text-xs`}
                    />
                  </label>
                )}
                <button onClick={() => rmRole(r.id)} className="rounded-md p-1 text-zinc-500 hover:text-rose-300" aria-label="Remove role">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                value={r.description ?? ""}
                onChange={(e) => patchRole(r.id, { description: e.target.value })}
                placeholder="One line about this role (optional)"
                className={`${inputCls} mt-2 py-1.5 text-xs`}
                maxLength={200}
              />
            </div>
          ))}
          <button onClick={newRole} className="btn-ghost w-full justify-center py-2 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add {roles.length ? "another role" : "a role"}
          </button>
          {paid && roles.some((r) => r.title.trim()) && totalComp > 0 && (
            <p className="text-right font-mono text-xs tracking-[0.08em] text-lime-300">
              Total compensation: ${totalComp}
            </p>
          )}
        </div>

        {roles.some((r) => r.title.trim()) && (
          <div className="mt-4 space-y-2.5 border-t border-line-soft pt-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">How will applicants be selected?</p>
              <div className="mt-1.5 flex gap-1.5">
                {([["manual", "Select manually"], ["shortlist", "Applications + shortlist"]] as const).map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setSelection(v)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selection === v ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-start gap-2 text-xs text-zinc-400">
              <input type="checkbox" checked={notifyUnselected} onChange={(e) => setNotifyUnselected(e.target.checked)} className="mt-0.5 accent-lime-400" />
              <span>
                Notify applicants who weren&apos;t selected when I close applications
                <span className="block text-zinc-600">A professional update — never a harsh &quot;declined&quot;.</span>
              </span>
            </label>
          </div>
        )}
      </section>

      {/* applicant requirements — the poster decides what to ask */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100">What applicants provide</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Ask what you actually need — not everything you could. Their profile, skills, portfolio,
          ratings, and verification attach automatically.
        </p>
        <div className="mt-3 space-y-2.5">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
            <span className="text-sm text-zinc-200">
              Short message — &ldquo;why are you a good fit?&rdquo;
              <span className="block text-xs text-zinc-500">Required by default; make it optional for quick gigs.</span>
            </span>
            <input type="checkbox" checked={requireMessage} onChange={(e) => setRequireMessage(e.target.checked)} className="accent-lime-400" />
          </label>
          {eventDate && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-card-raised/50 px-3.5 py-2.5 opacity-80">
              <span className="text-sm text-zinc-400">
                Availability on {new Date(eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                <span className="block text-xs text-zinc-600">Added automatically because your gig has a date.</span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">auto</span>
            </div>
          )}
          <div className="rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
            <p className="text-sm text-zinc-200">One extra question <span className="text-xs text-zinc-500">(optional)</span></p>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder='e.g. "Do you own a licensed drone?"'
              className={`${inputCls} mt-1.5 py-2 text-xs`}
              maxLength={160}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-card-raised/50 px-3.5 py-2.5 opacity-80">
            <span className="text-sm text-zinc-400">
              Profile, portfolio, ratings, verification
              <span className="block text-xs text-zinc-600">Always attached — applicants never re-type what UpNova knows.</span>
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">auto</span>
          </div>
        </div>
      </section>

      {error && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pb-8">
        <Link href="/opportunities" className="btn-ghost px-4 py-2 text-sm">Cancel</Link>
        <button onClick={submit} disabled={busy} className="btn-lime px-5 py-2 text-sm disabled:opacity-50">
          {busy ? "Posting…" : "Post opportunity"}
        </button>
      </div>
    </div>
  );
}
