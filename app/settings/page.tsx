"use client";

import { useState } from "react";
import {
  User,
  Palette,
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
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { currentUser, services, bookings } from "@/lib/data";

/* ------------------------------------------------------------------ */
/* Settings: full account control. Left nav, one clean panel per       */
/* section. Everything is client state until the backend exists.       */
/* ------------------------------------------------------------------ */

const sections = [
  { id: "account", label: "Account", icon: User },
  { id: "creator", label: "Profile & Creator", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Privacy & Safety", icon: ShieldCheck },
  { id: "payments", label: "Payments & Earnings", icon: Wallet },
  { id: "hiring", label: "Hiring", icon: Briefcase },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "pro", label: "UpNova Pro", icon: Sparkles },
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
          @{currentUser.handle}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">Settings</h1>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* -------- settings nav -------- */}
        <nav className="no-scrollbar flex gap-1 overflow-x-auto lg:w-56 lg:shrink-0 lg:flex-col lg:self-start">
          {sections.map((s) => (
            <button
              key={s.id}
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
                  <Field label="Name" defaultValue={currentUser.name} />
                  <Field label="Username" defaultValue={`@${currentUser.handle}`} />
                  <Field label="Email" defaultValue="devin@upnova.app" type="email" />
                  <Field label="Phone" defaultValue="+1 (410) 555-0147" />
                </div>
                <div className="mt-4 divide-y divide-line-soft border-t border-line-soft">
                  <Row label="Password" hint="Last changed 3 months ago">
                    <button className="btn-ghost px-3.5 py-1.5 text-xs">Change password</button>
                  </Row>
                </div>
                <Select
                  label="Profile visibility"
                  hint="Who can find and view your profile"
                  options={["Everyone", "UpNova members only", "People you follow"]}
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

          {section === "creator" && (
            <section className="card p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Profile &amp; Creator</h2>
              <div className="mt-4 flex items-center gap-4">
                <Avatar src={currentUser.avatar} initials={currentUser.initials} size="lg" />
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

          {section === "notifications" && (
            <section className="card p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Notifications</h2>
              <div className="mt-2 divide-y divide-line-soft">
                <Row label="Messages" hint="New DMs and project messages"><Toggle on={t("notifMessages")} onChange={setT("notifMessages")} /></Row>
                <Row label="New followers"><Toggle on={t("notifFollowers")} onChange={setT("notifFollowers")} /></Row>
                <Row label="Likes & comments"><Toggle on={t("notifLikes")} onChange={setT("notifLikes")} /></Row>
                <Row label="Opportunity alerts" hint="Paid work inside your radius that matches your skills"><Toggle on={t("notifOpps")} onChange={setT("notifOpps")} /></Row>
                <Row label="Application updates" hint="Status changes on gigs you applied to"><Toggle on={t("notifApps")} onChange={setT("notifApps")} /></Row>
                <Row label="Payment notifications" hint="Offers, payments secured, payouts released"><Toggle on={t("notifPayments")} onChange={setT("notifPayments")} /></Row>
                <Row label="Event reminders"><Toggle on={t("notifEvents")} onChange={setT("notifEvents")} /></Row>
              </div>
            </section>
          )}

          {section === "privacy" && (
            <section className="card p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Privacy &amp; Safety</h2>
              <div className="mt-2">
                <Select label="Who can message you" options={["Everyone", "People you follow", "No one"]} />
                <Select label="Who can see your profile" options={["Everyone", "UpNova members", "Followers"]} />
                <Select
                  label="Who can see your location"
                  hint="Distance is always shown as a range, never an address"
                  options={["Approximate (mi ranges)", "City only", "Hidden"]}
                />
              </div>
              <div className="divide-y divide-line-soft border-t border-line-soft">
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
                  <Row label="💳 •••• 4242" hint="Default for hiring and Pro billing">
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

          {section === "appearance" && (
            <section className="card p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-zinc-50">Appearance</h2>
              <div className="mt-4 flex gap-3">
                <button className="flex-1 rounded-xl border border-lime-400/50 bg-ink p-4 text-left">
                  <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                    <Check className="h-4 w-4 text-lime-400" /> Dark
                  </span>
                  <span className="mt-1 block text-xs text-zinc-500">The UpNova look</span>
                </button>
                <button disabled className="flex-1 cursor-not-allowed rounded-xl border border-line bg-card-raised p-4 text-left opacity-60">
                  <span className="text-sm font-semibold text-zinc-300">Light</span>
                  <span className="mt-1 block text-xs text-zinc-500">Coming later</span>
                </button>
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
                  <Sparkles className="h-4 w-4" /> UpNova Pro
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Advanced analytics, priority applications, and a bigger reach for your work.
                </p>
              </div>
              <div className="p-5">
                <Row label="Current plan" hint="Free — core features, standard reach">
                  <span className="chip">Free</span>
                </Row>
                <Row label="Billing" hint="No subscription active">
                  <button className="btn-ghost px-3.5 py-1.5 text-xs" disabled>
                    <CreditCard className="h-3.5 w-3.5" /> —
                  </button>
                </Row>
                <button className="btn-lime mt-3 w-full rounded-md py-2 text-sm">Upgrade to Pro</button>
                <p className="mt-2 text-center text-[10px] text-zinc-600">Cancel anytime. Pricing TBD with the fee model.</p>
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
