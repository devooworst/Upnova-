"use client";

/* ------------------------------------------------------------------ */
/*  Post an opportunity — and decide what applicants must provide.     */
/*  Availability is added automatically when the gig has a date;       */
/*  profile + portfolio always attach automatically. The poster only   */
/*  controls what's genuinely theirs to ask.                           */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { sanitizeQuestions, applicationLength, QUESTION_TYPES, MAX_QUESTIONS, type AppQuestion } from "@/lib/applicationSpec";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Briefcase, Plus, X, Users } from "lucide-react";
import type { OppRole } from "@/lib/opportunityRoles";
import { ENGAGEMENT_TYPES, COMP_MODELS, type EngagementType, type CompModel } from "@/lib/engagement";

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
  const [eligibility, setEligibility] = useState("anyone");

  // QA GUIDED INPUTS — populate with example data on request; never submits
  useEffect(() => {
    const onFill = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.form !== "opportunity") return;
      const v = d.values ?? {};
      if (typeof v.title === "string") setTitle(v.title);
      if (typeof v.description === "string") setDescription(v.description);
      if (typeof v.paid === "boolean") setPaid(v.paid);
      if (v.budget != null) setBudget(String(v.budget));
      if (typeof v.location === "string") setLocation(v.location);
      if (typeof v.remote === "boolean") setRemote(v.remote);
      if (typeof v.eventDate === "string") setEventDate(v.eventDate);
      if (typeof v.applyBy === "string") setApplyBy(v.applyBy);
      if (typeof v.studentFriendly === "boolean") setStudentFriendly(v.studentFriendly);
      if (typeof v.eligibility === "string") setEligibility(v.eligibility);
      if (Array.isArray(v.questions)) setAppQuestions(sanitizeQuestions(v.questions));
    };
    window.addEventListener("mavyn:qa-fill", onFill);
    return () => window.removeEventListener("mavyn:qa-fill", onFill);
  }, []);
  // applicant requirements — poster-controlled
  const [requireMessage, setRequireMessage] = useState(true);
  const [question, setQuestion] = useState("");
  /* APPLICATION BUILDER — the poster decides what to ask. Simple types,
     required toggles, reorder, preview. Simple by default: zero custom
     questions is a perfectly good application. */
  const [appQuestions, setAppQuestions] = useState<AppQuestion[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const addQuestion = () =>
    setAppQuestions((q) => (q.length >= MAX_QUESTIONS ? q : [...q, { id: `q${Date.now().toString(36)}`, label: "", type: "short", required: true }]));
  const patchQuestion = (i: number, patch: Partial<AppQuestion>) =>
    setAppQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const moveQuestion = (i: number, dir: -1 | 1) =>
    setAppQuestions((qs) => {
      const j = i + dir;
      if (j < 0 || j >= qs.length) return qs;
      const next = qs.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const appLen = applicationLength(sanitizeQuestions(appQuestions), requireMessage);
  // TEAM & OPENINGS — roles are configuration, not a separate system.
  // Form rows keep count/pay as STRINGS so the inputs behave like real
  // text fields (clearable, retypable); they're sanitized on submit.
  interface RoleRow { id: string; title: string; count: string; pay: string; description?: string }
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selection, setSelection] = useState<"manual" | "shortlist">("manual");
  const [notifyUnselected, setNotifyUnselected] = useState(true);
  // ENGAGEMENT — one-time or ongoing relationship, same universal system
  const [engType, setEngType] = useState<EngagementType>("one_time");
  const [customLabel, setCustomLabel] = useState("");
  const [workload, setWorkload] = useState("");
  const [schedule, setSchedule] = useState("");
  const [duration, setDuration] = useState("");
  const [startDate, setStartDate] = useState("");
  const [compModel, setCompModel] = useState<CompModel>("per_project");
  const [rate, setRate] = useState("");
  const [classification, setClassification] = useState<"mavyn_freelance" | "external_employment">("mavyn_freelance");
  const [interviewMode, setInterviewMode] = useState<"none" | "mavyn" | "external">("none");
  const ongoing = engType !== "one_time";
  const newRole = () =>
    setRoles((r) => [...r, { id: Math.random().toString(36).slice(2, 10), title: "", count: "1", pay: "" }]);
  const patchRole = (id: string, patch: Partial<RoleRow>) =>
    setRoles((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const rmRole = (id: string) => setRoles((r) => r.filter((x) => x.id !== id));
  // live math: total compensation = Σ pay × openings, recalculated on
  // every keystroke; compared against the maximum budget in real time
  const countOf = (r: RoleRow) => Math.max(1, Number(r.count) || 1);
  const payOf = (r: RoleRow) => Math.max(0, Number(r.pay) || 0);
  const totalComp = roles.reduce((sum, r) => sum + payOf(r) * countOf(r), 0);
  const budgetNum = budget ? Number(budget) : null;
  const overBudget = paid && budgetNum != null && roles.some((r) => r.title.trim()) && totalComp > budgetNum;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      setError("Give it a title");
      return;
    }
    const activeRoles: OppRole[] = roles
      .filter((r) => r.title.trim())
      .map((r) => ({ id: r.id, title: r.title.trim(), count: countOf(r), pay: r.pay === "" ? null : payOf(r), description: r.description }));
    if (roles.some((r) => !r.title.trim())) {
      setError("Every role needs a title — or remove the empty row");
      return;
    }
    if (paid && activeRoles.length === 0 && (!budget || Number(budget) < 1)) {
      setError("Set the budget — or switch to Collaboration");
      return;
    }
    if (overBudget) {
      setError(`Over budget by $${totalComp - budgetNum!} — raise the budget or reduce compensation`);
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
        engagement: {
          type: engType,
          customLabel: customLabel || undefined,
          workload: workload || undefined,
          schedule: schedule || undefined,
          duration: duration || undefined,
          startDate: startDate || undefined,
          compModel,
          rate: rate ? Number(rate) : undefined,
          classification,
          interviewMode,
        },
        type: paid ? "gig" : "collab",
        // free-text location — no geo database required
        location,
        remote,
        eventDate: eventDate || undefined,
        applyBy: applyBy || undefined,
        studentFriendly,
        eligibility,
        requireMessage,
        question: question.trim() || undefined,
        questions: sanitizeQuestions(appQuestions),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not post");
      if (res.status === 401) router.push("/login");
      return;
    }
    // land on the permanent link with the share moment ready
    router.push(`/opportunities/${data.id}?published=1`);
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
              <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Max budget" className={`${inputCls} py-1.5 pl-7`} />
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} className="accent-lime-400" />
          Remote — no on-site location
        </label>
        {!remote && (
          <div data-guide="opportunity-location">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Location</p>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Baltimore, MD"
              className={inputCls}
            />
          </div>
        )}
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

        {/* WHO CAN APPLY — eligibility is the poster's rule. The listing
            stays VISIBLE to everyone; this only gates applications. */}
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Who can apply?</p>
          <div className="space-y-1.5">
            {[
              { id: "anyone", label: "Anyone on Mavyn" },
              { id: "students", label: "Verified students only", hint: "any school" },
              { id: "my_school", label: "Students from my school only", hint: "requires your own verified campus status" },
              { id: "alumni", label: "Alumni only", hint: "scoped to your school if you're verified" },
            ].map((o) => (
              <label
                key={o.id}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-sm transition ${
                  eligibility === o.id ? "border-violet-400/50 bg-violet-400/5 text-zinc-100" : "border-line text-zinc-400 hover:border-zinc-600"
                }`}
              >
                <input type="radio" checked={eligibility === o.id} onChange={() => setEligibility(o.id)} className="accent-violet-400" />
                {o.label}
                {o.hint && <span className="ml-auto text-[10px] text-zinc-600">{o.hint}</span>}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
            Everyone can SEE the listing either way — eligibility only controls who can apply, and
            it&apos;s enforced when they press Apply. Verification is free; plans never factor in.
            Multi-school targeting arrives as more schools onboard.
          </p>
        </div>
      </section>

      {/* ENGAGEMENT — one-time project or ongoing relationship. Type is
          configuration; Mavyn never auto-classifies employee/contractor. */}
      <section className="card p-5">
        <h2 className="text-sm font-bold text-zinc-100">Engagement</h2>
        <p className="mt-1 text-xs text-zinc-500">
          One-time work or an ongoing relationship — same system, your configuration.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ENGAGEMENT_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setEngType(t.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                engType === t.id ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {engType === "custom" && (
          <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Name it — e.g. Residency, Apprenticeship" maxLength={40} className={`${inputCls} mt-2`} />
        )}

        {ongoing && (
          <div className="mt-3 space-y-3 border-t border-line-soft pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={workload} onChange={(e) => setWorkload(e.target.value)} placeholder="Expected workload — e.g. ≈10 hrs/week" maxLength={80} className={inputCls} />
              <input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="Schedule — e.g. 2 videos/week" maxLength={120} className={inputCls} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Start date (optional)</p>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">Duration (optional)</p>
                <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder='e.g. "3 months", "until filled"' maxLength={60} className={inputCls} />
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 border-t border-line-soft pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Compensation schedule</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {COMP_MODELS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCompModel(c.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  compModel === c.id ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {c.label}
              </button>
            ))}
            <label className="flex items-center gap-1 text-xs text-zinc-400">
              $<input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^0-9]/g, ""))} placeholder="rate" className={`${inputCls} w-24 py-1.5`} />
            </label>
          </div>
        </div>

        <div className="mt-3 border-t border-line-soft pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Who handles pay &amp; paperwork?</p>
          <div className="mt-1.5 space-y-1.5">
            <button
              onClick={() => setClassification("mavyn_freelance")}
              className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${classification === "mavyn_freelance" ? "border-lime-400/50 bg-lime-400/5" : "border-line hover:border-zinc-600"}`}
            >
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${classification === "mavyn_freelance" ? "bg-lime-400" : "bg-zinc-700"}`} />
              <span>
                <span className={`block text-sm font-semibold ${classification === "mavyn_freelance" ? "text-lime-300" : "text-zinc-200"}`}>Freelance / contract through Mavyn</span>
                <span className="block text-xs text-zinc-500">Payments run through Mavyn — secured per cycle, released on completion.</span>
              </span>
            </button>
            <button
              onClick={() => setClassification("external_employment")}
              className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${classification === "external_employment" ? "border-sky-400/50 bg-sky-400/5" : "border-line hover:border-zinc-600"}`}
            >
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${classification === "external_employment" ? "bg-sky-400" : "bg-zinc-700"}`} />
              <span>
                <span className={`block text-sm font-semibold ${classification === "external_employment" ? "text-sky-300" : "text-zinc-200"}`}>Employment handled by the employer</span>
                <span className="block text-xs text-zinc-500">Payroll, classification, and paperwork happen OUTSIDE Mavyn — labeled as external throughout.</span>
              </span>
            </button>
          </div>
        </div>

        <div className="mt-3 border-t border-line-soft pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Interviews</p>
          <div className="mt-1.5 flex gap-1.5">
            {([["none", "No interview"], ["mavyn", "Schedule through Mavyn"], ["external", "External process"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setInterviewMode(v)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${interviewMode === v ? "border-lime-400/50 bg-lime-400/10 text-lime-300" : "border-line text-zinc-400 hover:border-zinc-600"}`}>
                {l}
              </button>
            ))}
          </div>
          {interviewMode === "external" && (
            <p className="mt-1.5 text-[11px] text-zinc-600">External interviews are labeled clearly — applicants know the process leaves Mavyn.</p>
          )}
        </div>
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
                    inputMode="numeric"
                    onChange={(e) => patchRole(r.id, { count: e.target.value.replace(/[^0-9]/g, "").slice(0, 3) })}
                    onBlur={() => { if (!r.count || Number(r.count) < 1) patchRole(r.id, { count: "1" }); }}
                    className={`${inputCls} w-14 py-1.5 text-center text-xs`}
                  />
                </label>
                {paid && (
                  <label className="flex items-center gap-1 text-xs text-zinc-400">
                    $
                    <input
                      value={r.pay}
                      inputMode="numeric"
                      onChange={(e) => patchRole(r.id, { pay: e.target.value.replace(/[^0-9]/g, "").slice(0, 6) })}
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
          {paid && roles.some((r) => r.title.trim()) && (
            <div className={`rounded-xl border px-3.5 py-2.5 ${overBudget ? "border-rose-400/40 bg-rose-400/5" : "border-lime-400/25 bg-lime-400/5"}`}>
              <p className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-zinc-400">
                  Total compensation{" "}
                  <span className="font-mono tracking-[0.05em] text-zinc-200">
                    {roles.filter((r) => r.title.trim()).map((r) => `$${payOf(r)}×${countOf(r)}`).join(" + ")} = <span className={overBudget ? "text-rose-300" : "text-lime-300"}>${totalComp}</span>
                  </span>
                </span>
                {budgetNum != null ? (
                  overBudget ? (
                    <span className="font-semibold text-rose-300">Over budget by ${totalComp - budgetNum}</span>
                  ) : (
                    <span className="font-semibold text-lime-300">
                      Within budget{budgetNum - totalComp > 0 ? ` — $${budgetNum - totalComp} remaining` : " — exactly at budget"}
                    </span>
                  )
                ) : (
                  <span className="text-zinc-500">Set the budget above to check it live</span>
                )}
              </p>
              {overBudget && (
                <p className="mt-1 text-[11px] text-rose-300/80">
                  Publishing is blocked — raise the budget or reduce role compensation.
                </p>
              )}
            </div>
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
          {/* ---- APPLICATION QUESTIONS — add only what you need ---- */}
          <div data-guide="app-questions" className="rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-zinc-200">Application questions <span className="text-xs text-zinc-500">(optional)</span></p>
              <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${appLen.label === "Long" ? "border-amber-400/50 text-amber-300" : "border-line text-zinc-500"}`}>
                Application length: {appLen.label}
              </span>
            </div>
            {appLen.advice && <p className="mt-1.5 rounded-lg border border-amber-400/30 bg-amber-400/5 px-2.5 py-1.5 text-[11px] text-amber-200">{appLen.advice}</p>}
            <div className="mt-2 space-y-2">
              {appQuestions.map((q, i) => (
                <div key={q.id} className="rounded-lg border border-line bg-card px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <input
                        value={q.label}
                        onChange={(e) => patchQuestion(i, { label: e.target.value })}
                        placeholder='Question — e.g. "Are you available September 15?"'
                        className={`${inputCls} py-1.5 text-xs`}
                        maxLength={140}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={q.type}
                          onChange={(e) => patchQuestion(i, { type: e.target.value as AppQuestion["type"] })}
                          className={`${inputCls} w-auto py-1.5 text-xs`}
                        >
                          {QUESTION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                        <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <input type="checkbox" checked={q.required} onChange={(e) => patchQuestion(i, { required: e.target.checked })} className="accent-lime-400" />
                          Required
                        </label>
                        <span className="ml-auto flex items-center gap-1">
                          <button type="button" onClick={() => moveQuestion(i, -1)} disabled={i === 0} className="rounded border border-line px-1.5 text-xs text-zinc-500 disabled:opacity-30 hover:text-zinc-200">↑</button>
                          <button type="button" onClick={() => moveQuestion(i, 1)} disabled={i === appQuestions.length - 1} className="rounded border border-line px-1.5 text-xs text-zinc-500 disabled:opacity-30 hover:text-zinc-200">↓</button>
                          <button type="button" onClick={() => setAppQuestions((qs) => qs.filter((_, j) => j !== i))} className="rounded border border-line px-1.5 text-xs text-zinc-500 hover:border-rose-400/40 hover:text-rose-300">✕</button>
                        </span>
                      </div>
                      {(q.type === "choice" || q.type === "dropdown") && (
                        <input
                          value={(q.options ?? []).join(", ")}
                          onChange={(e) => patchQuestion(i, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 8) })}
                          placeholder="Options, comma-separated — e.g. Beginner, Intermediate, Advanced, Expert"
                          className={`${inputCls} py-1.5 text-xs`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" data-guide="app-question-add" onClick={addQuestion} disabled={appQuestions.length >= MAX_QUESTIONS} className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40">
                + Add application question
              </button>
              <button type="button" data-guide="app-preview" onClick={() => setShowPreview(true)} className="btn-ghost px-3 py-1.5 text-xs">
                Preview application
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-card-raised/50 px-3.5 py-2.5 opacity-80">
            <span className="text-sm text-zinc-400">
              Profile, portfolio, ratings, verification
              <span className="block text-xs text-zinc-600">Always attached — applicants never re-type what Mavyn knows.</span>
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
        <button onClick={submit} disabled={busy || overBudget} data-guide="opportunity-submit" className="btn-lime px-5 py-2 text-sm disabled:opacity-50" title={overBudget ? "Over budget — fix compensation first" : undefined}>
          {busy ? "Posting…" : overBudget ? "Over budget" : "Post opportunity"}
        </button>
      </div>

      {/* ---- APPLICANT PREVIEW — exactly what applicants will see ---- */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowPreview(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Applicant preview</p>
                <h3 className="mt-1 text-sm font-bold text-zinc-100">Apply for {title.trim() || "your opportunity"}</h3>
              </div>
              <button onClick={() => setShowPreview(false)} className="rounded-md p-1 text-zinc-500 hover:text-zinc-200">✕</button>
            </div>
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center gap-2.5 rounded-xl border border-violet-400/25 bg-violet-400/5 px-3.5 py-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                <p className="text-xs text-zinc-400"><span className="font-semibold text-zinc-300">Their Mavyn profile will be included</span> — photo, bio, skills, portfolio, reviews, verification. Never re-typed.</p>
              </div>
              {eventDate && (
                <div className="rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Are you available on {new Date(eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}?</p>
                  <p className="mt-1 text-xs text-zinc-600">Yes · No · Need to confirm</p>
                </div>
              )}
              {requireMessage && (
                <div className="rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Why are you a good fit?</p>
                  <p className="mt-1 text-xs italic text-zinc-600">Short answer — their profile does the heavy lifting.</p>
                </div>
              )}
              {sanitizeQuestions(appQuestions).map((q) => (
                <div key={q.id} className="rounded-xl border border-line bg-card-raised px-3.5 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                    {q.label} {!q.required && <span className="font-normal normal-case text-zinc-600">(optional)</span>}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {q.type === "yesno" ? "Yes · No" : q.type === "choice" || q.type === "dropdown" ? (q.options ?? []).join(" · ") : QUESTION_TYPES.find((t) => t.id === q.type)?.hint}
                  </p>
                </div>
              ))}
              <div className="rounded-xl border border-line-soft bg-card-raised/50 px-3.5 py-2.5">
                <p className="text-xs text-zinc-500">Anything else? <span className="text-zinc-600">(optional)</span></p>
              </div>
              <div className="rounded-xl bg-lime-400/10 px-3.5 py-2.5 text-center text-xs font-bold text-lime-300">Submit application</div>
              <p className="text-center font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-600">Application length: {appLen.label}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
