"use client";

import { useEffect, useState } from "react";
import {
  User,
  Palette,
  FlaskConical,
  GraduationCap,
  Bell,
  ShieldCheck,
  Wallet,
  Briefcase,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  CreditCard,
  Landmark,
  Receipt,
  Check,
  HelpCircle,
  Compass,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import SecurityCard from "@/components/SecurityCard";
import PrefsEditor from "@/components/PrefsEditor";
import { useSession, invalidateSession } from "@/lib/session";
import { getTheme, setTheme, type ThemeChoice } from "@/lib/theme";
import { setPlan, PRO_EVENT, type Plan } from "@/lib/pro";
import { currentUser, services, bookings } from "@/lib/data";

/* ------------------------------------------------------------------ */
/* Settings: full account control. Left nav, one clean panel per       */
/* section. Everything is client state until the backend exists.       */
/* ------------------------------------------------------------------ */

const sections = [
  { id: "account", label: "Account", icon: User },
  { id: "creator", label: "Profile & Creator", icon: Palette },
  { id: "personalization", label: "Personalization", icon: Compass },
  { id: "education", label: "School & Education", icon: GraduationCap },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Privacy & Safety", icon: ShieldCheck },
  { id: "payments", label: "Payments & Earnings", icon: Wallet },
  { id: "hiring", label: "Hiring", icon: Briefcase },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "pro", label: "Plan & Billing", icon: Sparkles },
  { id: "help", label: "Help", icon: HelpCircle },
  { id: "demo", label: "Demo Controls", icon: FlaskConical, demoToolsOnly: true },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle },
] as const;

type SectionId = (typeof sections)[number]["id"];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${
        on ? "bg-lime-400" : "bg-zinc-700"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, defaultValue, type = "text" }: { label: string; defaultValue: string; type?: string }) {
  return (
    <div>
      <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
        {label}
      </label>
      <input type={type} defaultValue={defaultValue} className="input-dark mt-1.5" />
    </div>
  );
}

function Select({ label, options, hint }: { label: string; options: string[]; hint?: string }) {
  return (
    <Row label={label} hint={hint}>
      <select className="rounded-md border border-line bg-card-raised px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-lime-400/50">
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </Row>
  );
}

export default function SettingsPage() {
  const { user } = useSession();
  const [section, setSection] = useState<SectionId>("account");
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    openToWork: true,
    portfolioPublic: true,
    twoFa: false,
    notifMessages: true,
    notifFollowers: true,
    notifLikes: false,
    notifOpps: true,
    notifApps: true,
    notifPayments: true,
    notifEvents: true,
    compact: false,
    motion: true,
  });
  const t = (k: string) => toggles[k] ?? false;
  const [theme, setThemeState] = useState<ThemeChoice>("dark");
  useEffect(() => setThemeState(getTheme()), []);
  const pickTheme = (c: ThemeChoice) => {
    setTheme(c);
    setThemeState(c);
  };
  // plan + verification are ACCOUNT facts from the session (DB) — never localStorage
  const plan = (user?.plan ?? "free") as Plan;
  const studentVerified = !!user?.campus;
  // PRO_EVENT re-render bridges the moment between a plan change and the session refetch
  const [, forceTick] = useState(0);
  useEffect(() => {
    const sync = () => forceTick((n) => n + 1);
    window.addEventListener(PRO_EVENT, sync);
    return () => window.removeEventListener(PRO_EVENT, sync);
  }, []);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoMsg, setDemoMsg] = useState("");
  /* DEMO ONLY — switches the verification state of THIS account through a
     demo-gated API. Auth/session state is never touched. */
  const setAccountState = async (state: "unverified" | "current_student" | "alumni") => {
    setDemoBusy(true);
    setDemoMsg("");
    try {
      const res = await fetch("/api/demo/account-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) { setDemoMsg((data as { error?: string }).error || "Switch failed — try again."); return; }
      invalidateSession();
      setDemoMsg("");
    } catch {
      setDemoMsg("Network error — try again.");
    } finally {
      setDemoBusy(false);
    }
  };
  const setDemoPlan = async (p: Plan) => {
    setDemoBusy(true);
    setDemoMsg("");
    const ok = await setPlan(p);
    if (!ok) setDemoMsg("Plan change failed — are you signed in?");
    setDemoBusy(false);
  };

  /* ---- School & Education: profile display of the VERIFIED affiliation.
     The school itself is a verified fact (never hand-editable); class year
     and its visibility are the member's choice and NEVER change the
     verification status. ---- */
  const [eduYear, setEduYear] = useState("");
  const [eduShowYear, setEduShowYear] = useState(true);
  const [eduLoaded, setEduLoaded] = useState(false);
  const [eduBusy, setEduBusy] = useState(false);
  const [eduMsg, setEduMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  useEffect(() => {
    if (!user?.campus) return;
    fetch("/api/campus/verify", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.verified) {
          setEduYear(d.gradYear || "");
          setEduShowYear(!!d.showGradYear);
        }
        setEduLoaded(true);
      })
      .catch(() => setEduLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!user?.campus]);
  const patchEducation = async (body: Record<string, unknown>, okText: string) => {
    setEduBusy(true);
    setEduMsg(null);
    try {
      const res = await fetch("/api/campus/verify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) {
        setEduMsg({ kind: "err", text: (data as { error?: string }).error || "Update failed — try again." });
        return false;
      }
      invalidateSession(); // profile pill updates; verification status untouched
      setEduMsg({ kind: "ok", text: okText });
      return true;
    } catch {
      setEduMsg({ kind: "err", text: "Network error — try again." });
      return false;
    } finally {
      setEduBusy(false);
    }
  };
  /* ---- Phone & Login + real Notification Preferences (DB-backed) ---- */
  const [np, setNp] = useState<{
    prefs: Record<string, { inapp: boolean; email: boolean; sms: boolean }>;
    types?: Record<string, boolean>;
    motivation?: { enabled: boolean; frequency: string; window: string; general: boolean; fromFollowed: boolean };
    typeGroups?: { group: string; items: { key: string; label: string; hint: string }[] }[];
    phone: string | null; phoneVerified: boolean; smsConsent: boolean;
  } | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpDemo, setOtpDemo] = useState<string | null>(null);
  const [npBusy, setNpBusy] = useState(false);
  const [npMsg, setNpMsg] = useState<string | null>(null);
  const loadNp = () => fetch("/api/me/notifications", { cache: "no-store" }).then((r) => r.json()).then((d) => d.prefs && setNp(d)).catch(() => {});
  useEffect(() => { if (user) loadNp(); }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps
  const sendPhoneOtp = async () => {
    setNpBusy(true); setNpMsg(null);
    const res = await fetch("/api/auth/otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: phoneInput }) });
    const d = await res.json();
    setNpBusy(false);
    if (!res.ok) return setNpMsg(d.error || "Couldn't send a code");
    setOtpSent(true); setOtpDemo(d.demoCode ?? null);
  };
  const verifyPhoneOtp = async () => {
    setNpBusy(true); setNpMsg(null);
    const res = await fetch("/api/auth/otp/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: phoneInput, code: otpCode }) });
    const d = await res.json();
    setNpBusy(false);
    if (!res.ok) return setNpMsg(d.error || "That code didn't work");
    setOtpSent(false); setOtpCode(""); setOtpDemo(null); setPhoneInput("");
    setNpMsg("Your phone number is verified.");
    loadNp();
  };
  const removePhone = async () => {
    if (!window.confirm("Remove your phone number? Phone login and all SMS alerts stop immediately.")) return;
    await fetch("/api/me/notifications", { method: "DELETE" });
    setNpMsg("Phone number removed."); loadNp();
  };
  const patchNp = async (body: Record<string, unknown>) => {
    setNpBusy(true);
    const res = await fetch("/api/me/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json();
    setNpBusy(false);
    if (!res.ok) setNpMsg(d.error || "Update failed");
    else loadNp();
  };
  const togglePref = (cat: string, ch: "inapp" | "email" | "sms") => {
    if (!np) return;
    const prefs = { ...np.prefs, [cat]: { ...np.prefs[cat], [ch]: !np.prefs[cat][ch] } };
    setNp({ ...np, prefs });
    patchNp({ prefs });
  };
  const toggleType = (key: string) => {
    if (!np?.types) return;
    const types = { ...np.types, [key]: !np.types[key] };
    setNp({ ...np, types });
    patchNp({ types: { [key]: types[key] } });
  };
  const patchMotivation = (patch: Record<string, unknown>) => {
    if (!np?.motivation) return;
    const motivation = { ...np.motivation, ...patch };
    setNp({ ...np, motivation });
    patchNp({ motivation });
  };

  const graduateFromSettings = async () => {
    if (!window.confirm("Switch your status to Alumni? Everything you built stays — connections, messages, portfolio, history. Student-only areas (Marketplace, Student Groups) close; the alumni environment opens.")) return;
    setEduBusy(true);
    setEduMsg(null);
    const res = await fetch("/api/campus/verify", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "graduate" }) });
    if (res.ok) {
      invalidateSession();
      setEduMsg({ kind: "ok", text: "You're an alum now — your profile shows it, and everything you built stays." });
    } else {
      const d = await res.json().catch(() => ({} as { error?: string }));
      setEduMsg({ kind: "err", text: (d as { error?: string }).error || "Update failed — try again." });
    }
    setEduBusy(false);
  };
  const setT = (k: string) => (v: boolean) => setToggles((s) => ({ ...s, [k]: v }));

  const earned = 4850;
  const pending = bookings
    .filter((b) => b.status === "pending")
    .reduce((n, b) => n + (Number(b.price.replace(/[^0-9.]/g, "")) || 0), 0);

  const transactions = [
    { id: "t1", label: "Event Photography · paid to Ava Chen", amount: "-$315", date: "Aug 7", kind: "out" },
    { id: "t2", label: "Mixing session · Maya Reyes", amount: "+$200", date: "Aug 3", kind: "in" },
    { id: "t3", label: "Brand audio package · Harbor & Oak (deposit)", amount: "+$225", date: "Jul 29", kind: "in" },
    { id: "t4", label: "Loop kit sales payout", amount: "+$140", date: "Jul 22", kind: "in" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-500">
          {user ? `@${user.handle}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">Settings</h1>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* -------- settings nav -------- */}
        <nav className="no-scrollbar flex gap-1 overflow-x-auto lg:w-56 lg:shrink-0 lg:flex-col lg:self-start">
          {sections.filter((s) => !("demoToolsOnly" in s) || user?.demoTools).map((s) => (
            <button
              key={s.id}
              data-guide={s.id === "demo" ? "settings-demo" : undefined}
              onClick={() => setSection(s.id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition lg:w-full ${
                section === s.id
                  ? s.id === "danger"
                    ? "bg-red-500/10 text-red-300"
                    : "bg-white/10 text-zinc-50"
                  : s.id === "danger"
                  ? "text-red-400/70 hover:bg-red-500/10 hover:text-red-300"
                  : "text-zinc-400 hover:bg-card-raised hover:text-zinc-200"
              } ${s.id === "danger" ? "lg:mt-4" : ""}`}
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </button>
          ))}
        </nav>

        {/* -------- panels -------- */}
        <div className="min-w-0 flex-1 space-y-4">
          {section === "account" && (
            <>
              <section className="card p-5">
                <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Account</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Name" defaultValue={user?.profile.displayName ?? ""} />
                  <Field label="Username" defaultValue={user ? `@${user.handle}` : ""} />
                  <Field label="Email" defaultValue={user?.email ?? ""} type="email" />
                </div>
                <div className="mt-4 border-t border-line-soft pt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Security
                  </p>
                  <section className="card p-5">
                    <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Phone &amp; Login</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Sign in with your email, username, or a verified phone number. Your number is
                      never shown publicly.
                    </p>
                    {npMsg && <p className="mt-2 rounded-md border border-line bg-card-raised px-3 py-1.5 text-[11px] text-zinc-300">{npMsg}</p>}
                    {np?.phoneVerified ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm text-zinc-200">{np.phone}</span>
                        <span className="rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold text-lime-300">Your phone number is verified.</span>
                        <button onClick={removePhone} className="ml-auto rounded-full border border-red-500/30 px-3 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/10">Remove</button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <div className="flex gap-2">
                          <input type="tel" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} placeholder="+1 555 123 4567" className="flex-1 rounded-lg border border-line bg-card-raised px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50" />
                          <button onClick={sendPhoneOtp} disabled={npBusy || !phoneInput.trim()} className="btn-lime rounded-md px-4 py-2 text-xs disabled:opacity-50">Text a code</button>
                        </div>
                        {otpSent && (
                          <div className="flex gap-2">
                            <input value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" inputMode="numeric" className="flex-1 rounded-lg border border-line bg-card-raised px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-lime-400/50" />
                            <button onClick={verifyPhoneOtp} disabled={npBusy || otpCode.length !== 6} className="btn-lime rounded-md px-4 py-2 text-xs disabled:opacity-50">Verify</button>
                          </div>
                        )}
                        {otpDemo && <p className="rounded border border-amber-400/25 bg-amber-400/5 px-2 py-1 font-mono text-[10px] text-amber-300">DEMO — no SMS provider in this sandbox, your code: {otpDemo}</p>}
                      </div>
                    )}
                    {np?.phoneVerified && (
                      <label className="mt-3 flex items-center justify-between gap-3 border-t border-line-soft pt-3">
                        <span>
                          <span className="block text-xs font-medium text-zinc-200">SMS alerts</span>
                          <span className="block text-[10px] text-zinc-600">Explicit consent — a verified number alone never opts you in. Non-essential SMS always tells you how to manage alerts.</span>
                        </span>
                        <Toggle on={np.smsConsent} onChange={(v) => patchNp({ smsConsent: v })} />
                      </label>
                    )}
                  </section>
                  <SecurityCard />
                </div>
                <Select
                  label="Profile visibility"
                  hint="Who can find and view your profile"
                  options={["Everyone", "Mavyn members only", "People you follow"]}
                />
                <div className="mt-2 flex justify-end">
                  <button className="btn-lime rounded-md px-5 py-2 text-xs">Save changes</button>
                </div>
              </section>
              <button
                onClick={() => setSection("danger")}
                className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-sm text-zinc-500 transition hover:border-red-500/40 hover:text-red-300"
              >
                Deactivate or delete account <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {section === "personalization" && (
            <section className="card p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Personalization</h2>
              <p className="mt-1 text-xs text-zinc-500">
                The four questions from your first day on Mavyn — interests, goals, vibe,
                and what you want more of. Change them whenever; skip them entirely if you like.
              </p>
              <PrefsEditor />
            </section>
          )}

          {section === "creator" && (
            <section className="card p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Profile &amp; Creator</h2>
              <div className="mt-4 flex items-center gap-4">
                <Avatar src={user?.profile.avatarUrl} initials={user?.profile.displayName.charAt(0) ?? "?"} size="lg" />
                <div className="flex gap-2">
                  <button className="btn-ghost px-3.5 py-1.5 text-xs">Change photo</button>
                  <button className="btn-ghost px-3.5 py-1.5 text-xs">Change banner</button>
                </div>
              </div>
              <div className="mt-4">
                <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Bio</label>
                <textarea defaultValue={currentUser.bio} rows={3} className="input-dark mt-1.5 resize-none" />
              </div>
              <div className="mt-4">
                <label className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">Skills</label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {currentUser.skills.map((s) => (
                    <span key={s} className="chip">{s} ×</span>
                  ))}
                  <button className="chip border-dashed text-zinc-500 hover:text-zinc-300">+ Add skill</button>
                </div>
              </div>
              <div className="mt-4 divide-y divide-line-soft border-t border-line-soft">
                <Row label="Open to Work" hint="Shows the lime badge on your profile and in search">
                  <Toggle on={t("openToWork")} onChange={setT("openToWork")} />
                </Row>
                <Row label="Portfolio visibility" hint="Public portfolios rank higher in Discover">
                  <Toggle on={t("portfolioPublic")} onChange={setT("portfolioPublic")} />
                </Row>
              </div>
              <Select
                label="Default reach"
                hint="Where your posts and services surface by default"
                options={["Nearby (5 mi)", "Local (25 mi)", "City", "Regional", "National", "Global", "Remote"]}
              />
              <Select label="Location" options={["Baltimore, MD", "Washington, DC", "Custom…"]} />
              <div className="mt-2 flex justify-end">
                <button className="btn-lime rounded-md px-5 py-2 text-xs">Save changes</button>
              </div>
            </section>
          )}

          {section === "education" && (
            <section className="card overflow-hidden">
              <div className="border-b border-violet-400/20 bg-gradient-to-b from-violet-400/10 to-transparent p-5">
                <p className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-violet-300">
                  <GraduationCap className="h-4 w-4" /> School &amp; Education
                </p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  What your profile says about your school. The school itself comes from your{" "}
                  <span className="font-semibold text-zinc-300">verified affiliation</span> — it can
                  never be claimed by editing a profile. Your major is never shown on your public profile.
                </p>
              </div>

              {!user?.campus ? (
                <div className="p-5">
                  <p className="text-sm font-semibold text-zinc-200">No verified school yet</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Verify your student, alumni, or faculty affiliation — free, and independent of
                    any plan — and your school and class year appear here and on your profile.
                  </p>
                  <a href="/campus" className="mt-3 inline-flex items-center gap-2 rounded-md bg-violet-400 px-5 py-2 text-xs font-bold text-zinc-950 transition hover:bg-violet-300">
                    <GraduationCap className="h-3.5 w-3.5" /> Verify your school — Free
                  </a>
                </div>
              ) : (
                <div className="space-y-5 p-5">
                  {/* the school — a verified fact, read-only */}
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">College / University</p>
                    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line bg-card-raised px-3 py-2.5">
                      <p className="text-sm font-semibold text-zinc-100">{user.campus.name}</p>
                      <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">Verified</span>
                    </div>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
                      Locked to your verified affiliation. Transferring schools? Re-verify at the new
                      school in Your Campus — profile edits can never change it.
                    </p>
                  </div>

                  {/* status — student vs alumni */}
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Status</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                      <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-2.5 py-1 text-[11px] font-bold text-violet-300">
                        {user.campus.affiliation === "alumni" ? "Alumni" : user.campus.affiliation === "faculty_staff" ? "Faculty / Staff" : "Current Student"}
                      </span>
                      {user.campus.affiliation === "current_student" && (
                        <button onClick={graduateFromSettings} disabled={eduBusy} className="btn-ghost px-3.5 py-1.5 text-xs disabled:opacity-50">
                          I graduated — switch to Alumni
                        </button>
                      )}
                    </div>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
                      {user.campus.affiliation === "current_student"
                        ? "Graduating changes ONE thing: student-only areas close and the alumni environment opens. Account, portfolio, connections, and history stay."
                        : user.campus.affiliation === "alumni"
                        ? "Alumni status — everything you built as a student stays with your account. (Testing? Demo Mode → Settings → Demo Controls can switch states.)"
                        : "Faculty/staff affiliation — verified through your school."}
                    </p>
                  </div>

                  {/* class year — profile display only, never verification */}
                  {user.campus.affiliation !== "faculty_staff" && (
                    <div>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        {user.campus.affiliation === "alumni" ? "Class of" : "Expected graduation — Class of"}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          value={eduYear}
                          onChange={(e) => setEduYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                          placeholder="e.g. 2028"
                          inputMode="numeric"
                          className="w-28 rounded-lg border border-line bg-card-raised px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
                        />
                        <button
                          onClick={() => {
                            if (!/^(19|20)\d{2}$/.test(eduYear)) { setEduMsg({ kind: "err", text: "Enter a 4-digit year, e.g. 2028." }); return; }
                            patchEducation({ gradYear: eduYear }, "Class year updated on your profile.");
                          }}
                          disabled={eduBusy || !eduLoaded}
                          className="rounded-md bg-violet-400 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-violet-300 disabled:opacity-50"
                        >
                          {eduBusy ? "Saving…" : "Save"}
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-zinc-200">Show class year on profile</p>
                          <p className="text-[10px] text-zinc-600">Off = only your school shows</p>
                        </div>
                        <Toggle
                          on={eduShowYear}
                          onChange={(v) => {
                            setEduShowYear(v);
                            patchEducation({ showGradYear: v }, v ? "Class year is visible on your profile." : "Class year hidden — your school still shows.");
                          }}
                        />
                      </div>
                      <p className="mt-2 rounded-md border border-line bg-card-raised px-3 py-2 text-[10px] leading-relaxed text-zinc-500">
                        Changing or hiding the class year changes your <span className="font-semibold text-zinc-300">profile display only</span> —
                        your verification status is a separate fact and is never affected.
                      </p>
                    </div>
                  )}

                  {/* live preview of the profile pill */}
                  <div className="border-t border-line-soft pt-4">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Profile preview</p>
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-400/10 px-2.5 py-1 text-[11px] font-bold text-violet-300">
                      <GraduationCap className="h-3.5 w-3.5" />
                      {user.campus.name}
                      {eduShowYear && eduYear ? ` · Class of ${eduYear}` : ""}
                      {user.campus.affiliation === "alumni" ? " · Alumni" : user.campus.affiliation === "faculty_staff" ? " · Faculty / Staff" : ""}
                    </span>
                  </div>

                  {eduMsg && (
                    <p className={`rounded-md border px-3 py-2 text-[11px] ${eduMsg.kind === "ok" ? "border-lime-400/30 bg-lime-400/5 text-lime-300" : "border-red-500/30 bg-red-500/5 text-red-300"}`}>
                      {eduMsg.text}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {section === "notifications" && (
            <section className="card p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Notification Preferences</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Per category, per channel — saved to your account. SMS needs a verified phone and
                explicit consent (Settings → Account → Phone &amp; Login). Projects, payments and
                bookings SMS look like: &quot;Mavyn: Payment submitted for your project. Open Mavyn to review.&quot;
              </p>
              {np ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[420px]">
                    <thead>
                      <tr className="border-b border-line-soft text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        <th className="py-2 text-left">Category</th>
                        <th className="py-2 text-center">In-app</th>
                        <th className="py-2 text-center">Email</th>
                        <th className="py-2 text-center">SMS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {([
                        ["projects", "Project & payment updates", "Started, milestones, submissions, revisions, payments, confirmations, completion"],
                        ["opportunities", "Opportunities", "Matches, application status, deadlines"],
                        ["bookings", "Bookings", "Requests, confirmations, changes, reminders"],
                        ["messages", "Messages", "New messages & important thread updates"],
                        ["security", "Account & security", "Sign-ins, password/phone changes, MFA — always on in-app"],
                      ] as const).map(([cat, label, hint]) => (
                        <tr key={cat}>
                          <td className="py-2.5 pr-3">
                            <p className="text-xs font-medium text-zinc-200">{label}</p>
                            <p className="text-[10px] text-zinc-600">{hint}</p>
                          </td>
                          {(["inapp", "email", "sms"] as const).map((ch) => {
                            const locked = cat === "security" && ch === "inapp";
                            const smsBlocked = ch === "sms" && !(np.phoneVerified && np.smsConsent);
                            return (
                              <td key={ch} className="text-center">
                                <input
                                  type="checkbox"
                                  checked={np.prefs[cat]?.[ch] ?? false}
                                  disabled={npBusy || locked || smsBlocked}
                                  onChange={() => togglePref(cat, ch)}
                                  className="h-4 w-4 accent-lime-400 disabled:opacity-40"
                                  title={locked ? "Security notifications are always visible in-app" : smsBlocked ? "Verify a phone and turn on SMS alerts first" : undefined}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-3 h-24 animate-pulse rounded-lg bg-card-raised" />
              )}
              {/* ---- WHAT you get notified about — one switch per kind.
                   Off = never sent, on any channel, anywhere. The same
                   switches will govern real push (iOS/Android/web) when a
                   push transport is added — one decision point. ---- */}
              {np?.types && np.typeGroups && (
                <div className="mt-5 border-t border-line-soft pt-4" data-guide="notify-type-groups">
                  <h3 className="text-sm font-bold text-zinc-100">What you get notified about</h3>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Per kind, across every channel. Bell subscriptions on creators, posts,
                    opportunities and services add to this — these switches always win.
                  </p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    {np.typeGroups.map((g) => (
                      <div key={g.group} className="rounded-xl border border-line-soft p-3.5">
                        <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{g.group}</p>
                        <ul className="space-y-2">
                          {g.items.map((it) => {
                            const locked = it.key === "system.security";
                            const on = np.types![it.key] !== false;
                            return (
                              <li key={it.key} className="flex items-center justify-between gap-3">
                                <span className="min-w-0">
                                  <span className="block text-xs font-medium text-zinc-200">{it.label}</span>
                                  <span className="block text-[10px] leading-snug text-zinc-600">{it.hint}</span>
                                </span>
                                <input
                                  type="checkbox"
                                  checked={on}
                                  disabled={npBusy || locked}
                                  onChange={() => toggleType(it.key)}
                                  className="h-4 w-4 shrink-0 accent-lime-400 disabled:opacity-40"
                                  title={locked ? "Security notifications are always on" : undefined}
                                  aria-label={`${g.group}: ${it.label}`}
                                />
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ---- Mavyn Motivation — strictly opt-in, fully tunable ---- */}
              {np?.motivation && (
                <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-4" data-guide="notify-motivation">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100">Mavyn Motivation</h3>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Occasional encouragement — a positive push, a productivity nudge, or a
                        motivational post from a creator you follow. Off unless you turn it on,
                        and never more often than you choose.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={np.motivation.enabled}
                      disabled={npBusy}
                      onChange={() => patchMotivation({ enabled: !np.motivation!.enabled })}
                      className="h-5 w-5 shrink-0 accent-amber-400"
                      aria-label="Motivation notifications on/off"
                    />
                  </div>
                  {np.motivation.enabled && (
                    <div className="mt-3 grid gap-3 border-t border-amber-400/15 pt-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wide text-zinc-500">How often</span>
                        <select
                          value={np.motivation.frequency}
                          disabled={npBusy}
                          onChange={(e) => patchMotivation({ frequency: e.target.value })}
                          className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-zinc-200"
                        >
                          <option value="daily">About once a day</option>
                          <option value="few-week">A few times a week</option>
                          <option value="weekly">About once a week</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wide text-zinc-500">When</span>
                        <select
                          value={np.motivation.window}
                          disabled={npBusy}
                          onChange={(e) => patchMotivation({ window: e.target.value })}
                          className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-zinc-200"
                        >
                          <option value="morning">Mornings (7am–12pm)</option>
                          <option value="afternoon">Afternoons (12–5pm)</option>
                          <option value="evening">Evenings (5–10pm)</option>
                          <option value="any">Any time</option>
                        </select>
                      </label>
                      <label className="flex items-center justify-between gap-3 sm:col-span-1">
                        <span className="text-xs text-zinc-300">General Mavyn motivation</span>
                        <input type="checkbox" checked={np.motivation.general} disabled={npBusy} onChange={() => patchMotivation({ general: !np.motivation!.general })} className="h-4 w-4 accent-amber-400" />
                      </label>
                      <label className="flex items-center justify-between gap-3 sm:col-span-1">
                        <span className="text-xs text-zinc-300">From creators you follow <span className="block text-[10px] text-zinc-600">Real motivational posts only — never invented quotes</span></span>
                        <input type="checkbox" checked={np.motivation.fromFollowed} disabled={npBusy} onChange={() => patchMotivation({ fromFollowed: !np.motivation!.fromFollowed })} className="h-4 w-4 accent-amber-400" />
                      </label>
                    </div>
                  )}
                </div>
              )}

              <p className="mt-3 border-t border-line-soft pt-2.5 text-[10px] leading-relaxed text-zinc-600">
                No spam, by design: unmapped social noise never leaves the app, deliveries are
                rate-capped per hour, there is no marketing SMS at all, motivation is opt-in with
                your frequency and time window, and security alerts stay on so your account is
                never silently taken over.
              </p>
            </section>
          )}

          {section === "privacy" && (
            <section className="card p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Privacy &amp; Safety</h2>
              <div className="mt-2">
                <Select label="Who can message you" options={["Everyone", "People you follow", "No one"]} />
                <Select label="Who can see your profile" options={["Everyone", "Mavyn members", "Followers"]} />
                <Select
                  label="Who can see your location"
                  hint="Distance is always shown as a range, never an address"
                  options={["Approximate (mi ranges)", "City only", "Hidden"]}
                />
              </div>
              <div className="divide-y divide-line-soft border-t border-line-soft">
                <Row label="Identity verification" hint="Status only — your ID never lives on Mavyn">
                  <span className="flex items-center gap-1.5 rounded-full border border-line bg-card-raised px-2.5 py-1 text-[11px] font-semibold text-zinc-200"><span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> Identity Verified</span>
                </Row>
                <Row label="High-Trust verification" hint="Required for childcare, pet care, home access, transportation">
                  <button className="btn-ghost px-3.5 py-1.5 text-xs">Complete</button>
                </Row>
                <Row label="Two-factor authentication" hint="Extra login step via authenticator app">
                  <Toggle on={t("twoFa")} onChange={setT("twoFa")} />
                </Row>
                <Row label="Blocked users" hint="1 blocked">
                  <button className="btn-ghost px-3.5 py-1.5 text-xs">Manage</button>
                </Row>
                <Row label="Report history" hint="Reports you've filed and their status">
                  <button className="btn-ghost px-3.5 py-1.5 text-xs">View</button>
                </Row>
              </div>
            </section>
          )}

          {section === "payments" && (
            <>
              <section className="card-money p-5">
                <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Earnings</h2>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-2xl font-extrabold tracking-tight tabular-nums text-lime-400">
                      ${earned.toLocaleString()}
                    </p>
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                      lifetime earnings
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold tracking-tight tabular-nums text-amber-400">
                      ${pending}
                    </p>
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                      pending
                    </p>
                  </div>
                </div>
              </section>
              <section className="card p-5">
                <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Payment methods</h2>
                <div className="mt-3 divide-y divide-line-soft">
                  <Row label="Card •••• 4242" hint="Default for hiring and Pro billing">
                    <button className="btn-ghost px-3.5 py-1.5 text-xs">Edit</button>
                  </Row>
                  <Row label="Payout account" hint="Where your earnings land — powered by Stripe Connect">
                    <button className="btn-lime rounded-md px-3.5 py-1.5 text-xs">
                      <Landmark className="h-3.5 w-3.5" /> Connect payouts
                    </button>
                  </Row>
                  <Row label="Billing information" hint="Name, address, tax details for receipts">
                    <button className="btn-ghost px-3.5 py-1.5 text-xs">Edit</button>
                  </Row>
                </div>
              </section>
              <section className="card p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Transaction history</h2>
                  <button className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500 hover:text-zinc-200">
                    <Receipt className="h-3.5 w-3.5" /> receipts
                  </button>
                </div>
                <ul className="mt-2 divide-y divide-line-soft">
                  {transactions.map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate text-zinc-200">{tx.label}</span>
                        <span className="font-mono text-[10px] font-medium text-zinc-500">{tx.date}</span>
                      </span>
                      <span className={`shrink-0 font-bold tabular-nums tracking-tight ${tx.kind === "in" ? "text-lime-400" : "text-zinc-400"}`}>
                        {tx.amount}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          {section === "hiring" && (
            <>
              <section className="card p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Your services</h2>
                  <button className="btn-ghost px-3.5 py-1.5 text-xs">+ Add service</button>
                </div>
                <ul className="mt-2 divide-y divide-line-soft">
                  {services.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                      <span className="flex min-w-0 items-center gap-2.5 text-sm">
                        <span aria-hidden>{s.emoji}</span>
                        <span className="truncate font-medium text-zinc-200">{s.title}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="font-bold tabular-nums tracking-tight text-lime-400">${s.startingAt}</span>
                        <button className="btn-ghost px-3 py-1 text-[11px]">Edit</button>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="card p-5">
                <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Hiring preferences</h2>
                <Select label="Availability" options={["Open to Work", "Available this week", "Booked until Sep", "Not taking work"]} />
                <Select
                  label="Default payment preference"
                  hint="Applied to new project offers"
                  options={["Fixed price, held until approval", "50% upfront", "Custom per project"]}
                />
                <div className="mt-2 divide-y divide-line-soft border-t border-line-soft text-sm">
                  <Row label="Active projects" hint="Brand audio package · Harbor & Oak">
                    <span className="font-bold tabular-nums text-zinc-200">2</span>
                  </Row>
                  <Row label="Completed projects" hint="98% completion rate">
                    <span className="font-bold tabular-nums text-zinc-200">27</span>
                  </Row>
                </div>
              </section>
            </>
          )}

          {section === "help" && (
            <section className="card p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Help</h2>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-line bg-card-raised p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                    <Compass className="h-4 w-4 text-violet-300" /> Take the tour again
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Replay the guided walkthrough of Mavyn — Home, Discover, Opportunities, Services,
                    Messages, your profile, and My World. It highlights the real interface and takes about a minute.
                  </p>
                  <button
                    onClick={() => {
                      window.location.href = "/?tour=1";
                    }}
                    className="btn-lime mt-3 px-4 py-1.5 text-xs"
                  >
                    Start the tour
                  </button>
                </div>
                <div className="rounded-xl border border-line bg-card-raised p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                    <HelpCircle className="h-4 w-4 text-violet-300" /> Learn Mavyn — real-world guides
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    Scenario-based walkthroughs of the deeper features — Clients, Preferred Clients, bookings,
                    releases, payments, hiring, and more. Pick a path (client, provider, business, creator) and
                    learn through actual situations, at your own pace.
                  </p>
                  <a href="/learn" className="btn-ghost mt-3 inline-flex px-4 py-1.5 text-xs">Open Learn Mavyn</a>
                </div>
                <div className="rounded-xl border border-line bg-card-raised p-4">
                  <p className="text-sm font-semibold text-zinc-100">Quick answers</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-zinc-500">
                    <li>· Payments are secured when a project or booking starts, and released when work is approved or completed.</li>
                    <li>· Campus access comes from free school verification — never from a paid plan.</li>
                    <li>· Notification channels (in-app, email, SMS) are controlled per category in Settings → Notifications.</li>
                    <li>· Project and booking progress lives in the project page and booking record — Activity keeps the history.</li>
                  </ul>
                </div>
              </div>
            </section>
          )}

          {section === "appearance" && (
            <section className="card p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Appearance</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["dark", "Dark", "The Mavyn look"],
                    ["light", "Light", "Same Mavyn, brighter room"],
                    ["system", "Use device settings", "Follows your computer"],
                  ] as [ThemeChoice, string, string][]
                ).map(([id, label, desc]) => (
                  <button
                    key={id}
                    onClick={() => pickTheme(id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      theme === id
                        ? "border-lime-400/50 bg-lime-400/5"
                        : "border-line hover:border-zinc-600"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                      {theme === id && <Check className="h-4 w-4 text-lime-400" />} {label}
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500">{desc}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 divide-y divide-line-soft border-t border-line-soft">
                <Row label="Compact mode" hint="Tighter cards and smaller media">
                  <Toggle on={t("compact")} onChange={setT("compact")} />
                </Row>
                <Row label="Animations" hint="Feed transitions and hover effects">
                  <Toggle on={t("motion")} onChange={setT("motion")} />
                </Row>
              </div>
            </section>
          )}

          {section === "pro" && (
            <section className="card overflow-hidden">
              <div className="border-b border-lime-400/20 bg-gradient-to-b from-lime-400/10 to-transparent p-5">
                <p className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-lime-300">
                  <Sparkles className="h-4 w-4" /> Plan &amp; Billing
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Your plan controls perks — never your identity, communities, or navigation.
                </p>
              </div>
              <div className="p-5">
                <ul className="divide-y divide-line-soft">
                  {(
                    [
                      ["free", "Mavyn Free", "$0", "Everyone. The full core platform."],
                      ["college", "Mavyn College+", "$4.99/mo", "Optional student exposure boost. Verification & campus access are free."],
                      ["pro", "Mavyn Pro", "$12.99/mo", "Serious creators — analytics, discovery, pro tools."],
                    ] as [Plan, string, string, string][]
                  ).map(([id, name, price, desc]) => (
                    <li key={id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-100">{name}</p>
                        <p className="text-xs text-zinc-500">{desc}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-bold tabular-nums tracking-tight text-zinc-200">{price}</span>
                        {plan === id && (
                          <span className="rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold text-lime-300">
                            Current
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {studentVerified && (
                  <p className="mt-3 rounded-md border border-violet-400/25 bg-violet-400/5 px-3 py-2 text-[11px] text-zinc-400">
                    <span className="font-semibold text-violet-300">Verified Student</span> —
                    identity stays with your account across plan changes.
                  </p>
                )}
                <a href="/pro" className="btn-lime mt-4 flex w-full rounded-md py-2 text-sm">
                  Change plan
                </a>
                <p className="mt-2 text-center text-[10px] text-zinc-600">
                  Test prices. Transaction fees on paid work are separate — Mavyn earns even from
                  Free users when they earn.
                </p>
              </div>
            </section>
          )}

          {section === "demo" && user?.demoTools && user?.testerMode === "simulation" && (
            <section className="card p-5">
              <p className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-sky-300">
                <FlaskConical className="h-4 w-4" /> Demo Controls
              </p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                You are in <span className="font-semibold text-sky-300">Simulation Mode</span> — the
                realistic user experience, where developer testing tools are hidden and every
                restriction applies. To use the account-state and plan switchers, switch to{" "}
                <span className="font-semibold text-amber-300">Demo Mode</span> with the toggle in
                the top-left corner of the page.
              </p>
              <p className="mt-3 border-t border-line-soft pt-3 text-[10px] leading-relaxed text-zinc-600">
                In Simulation Mode you change plans through the real (test-payment) checkout on the
                Plans page, and verification through Your Campus — exactly like a normal user.
              </p>
            </section>
          )}

          {section === "demo" && user?.demoTools && user?.testerMode !== "simulation" && (
            <section className="card overflow-hidden">
              <div className="border-b border-amber-400/20 bg-gradient-to-b from-amber-400/10 to-transparent p-5">
                <p className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-amber-300">
                  <FlaskConical className="h-4 w-4" /> Demo Controls
                </p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  Testing tools for this demo environment — switch your account&apos;s verification
                  state and plan without payments or permanent changes. In production, verification
                  runs through the education-verification provider and plans through Stripe.
                  <span className="font-semibold text-zinc-300"> Your sign-in session is never touched.</span>
                </p>
              </div>
              <div className="space-y-5 p-5">
                <div>
                  <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    <GraduationCap className="h-3.5 w-3.5" /> Demo Account State — verification
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {([
                      { id: "unverified", label: "Unverified", desc: "Your Campus locks" },
                      { id: "current_student", label: "Current Student", desc: "Student campus experience" },
                      { id: "alumni", label: "Alumni", desc: "Alumni campus experience" },
                    ] as const).map((s2) => {
                      const active =
                        s2.id === "unverified"
                          ? !user?.campus
                          : user?.campus?.affiliation === s2.id;
                      return (
                        <button
                          key={s2.id}
                          data-guide={`account-state-${s2.id}`}
                          onClick={() => setAccountState(s2.id)}
                          disabled={demoBusy || active}
                          className={`rounded-lg border p-3 text-left transition disabled:cursor-default ${
                            active
                              ? "border-violet-400/50 bg-violet-400/10"
                              : "border-line hover:border-zinc-600 hover:bg-card-raised disabled:opacity-50"
                          }`}
                        >
                          <p className={`text-sm font-semibold ${active ? "text-violet-300" : "text-zinc-200"}`}>
                            {s2.label} {active ? "· current" : ""}
                          </p>
                          <p className="mt-0.5 text-[10px] text-zinc-500">{s2.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    <Sparkles className="h-3.5 w-3.5" /> Demo Plan — subscription
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {([
                      { id: "free", label: "Free", desc: "Basic features" },
                      { id: "college", label: "College+", desc: "Student growth benefits" },
                      { id: "pro", label: "Pro", desc: "Professional creator tools" },
                    ] as const).map((p2) => {
                      const active = plan === p2.id;
                      return (
                        <button
                          key={p2.id}
                          onClick={() => setDemoPlan(p2.id)}
                          disabled={demoBusy || active}
                          className={`rounded-lg border p-3 text-left transition disabled:cursor-default ${
                            active
                              ? "border-lime-400/50 bg-lime-400/10"
                              : "border-line hover:border-zinc-600 hover:bg-card-raised disabled:opacity-50"
                          }`}
                        >
                          <p className={`text-sm font-semibold ${active ? "text-lime-300" : "text-zinc-200"}`}>
                            {p2.label} {active ? "· current" : ""}
                          </p>
                          <p className="mt-0.5 text-[10px] text-zinc-500">{p2.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {demoMsg && (
                  <p className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-300">{demoMsg}</p>
                )}
                <a href="/simulation" className="flex w-full items-center justify-center rounded-md border border-amber-400/30 bg-amber-400/5 py-2 text-xs font-bold text-amber-300 transition hover:bg-amber-400/10">
                  Open the Simulation / Test Center →
                </a>
                <p className="border-t border-line-soft pt-3 text-[10px] leading-relaxed text-zinc-600">
                  Verification and plan are independent facts: switching plans never removes your
                  verified school identity, and verifying never activates a paid plan.
                </p>
              </div>
            </section>
          )}

          {section === "danger" && (
            <section className="rounded-2xl border border-red-500/30 bg-red-500/[0.04] p-5">
              <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-red-300">
                <AlertTriangle className="h-4 w-4" /> Danger Zone
              </h2>
              <div className="mt-2 divide-y divide-red-500/10">
                <Row label="Deactivate account" hint="Hides your profile and pauses everything. Reversible — log back in to restore.">
                  <button className="rounded-full border border-red-400/40 px-3.5 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10">
                    Deactivate
                  </button>
                </Row>
                <Row label="Delete account permanently" hint="Erases profile, portfolio, messages, and projects. Cannot be undone. Pending payouts are settled first.">
                  <button className="rounded-full bg-red-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-red-400">
                    Delete forever
                  </button>
                </Row>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
