"use client";

/* ------------------------------------------------------------------ */
/*  Edit Profile — structured profile management, not a giant form.    */
/*                                                                     */
/*  Six sections: Profile · Professional · Work · Verification ·       */
/*  Links · Privacy. Each is independently usable; one Save commits    */
/*  the whole draft to the profile store, which every other surface    */
/*  (profile header, About tab, visitor view, services) reads live.    */
/*                                                                     */
/*  What is editable here is deliberately limited to user-controlled   */
/*  identity. Platform-verified state (student, identity trust) and    */
/*  platform-calculated metrics (reliability, response time) are       */
/*  shown read-only with an explanation of where they come from.       */
/* ------------------------------------------------------------------ */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Briefcase,
  Wrench,
  ShieldCheck,
  Link2,
  Lock,
  Eye,
  Check,
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
  Camera,
  Pause,
  Play,
  PencilLine,
  GraduationCap,
  MapPin,
  MessageSquare,
  Zap,
  FolderPlus,
  Info,
} from "lucide-react";
import Avatar from "../Avatar";
import VerifiedBadge from "../VerifiedBadge";
import {
  ProfileData,
  DEFAULT_PROFILE,
  loadProfile,
  saveProfile,
  checkUsername,
  roleLine,
  locationLine,
  UsernameStatus,
  ExperienceEntry,
  EducationEntry,
  SocialLink,
} from "@/lib/profile";
import { useSession, invalidateSession } from "@/lib/session";

/* ------------------------------ constants ------------------------------ */

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "professional", label: "Professional", icon: Briefcase },
  { id: "work", label: "Work", icon: Wrench },
  { id: "verification", label: "Verification", icon: ShieldCheck },
  { id: "links", label: "Links", icon: Link2 },
  { id: "privacy", label: "Privacy", icon: Lock },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const ROLE_SUGGESTIONS = [
  "Audio Engineer",
  "Songwriter",
  "Video Editor",
  "Content Creator",
  "Photographer",
  "Videographer",
  "Graphic Designer",
  "Entrepreneur",
  "DJ",
  "Stylist",
];

const AVAILABLE_FOR = [
  "Freelance",
  "Projects",
  "Collaborations",
  "Gigs",
  "Brand partnerships",
  "Internships",
  "Full-time opportunities",
];

const INTERESTS = [
  "Music",
  "Film",
  "Fashion",
  "Photography",
  "Technology",
  "Gaming",
  "Brands",
  "Events",
  "Food",
  "Sports",
  "Art & Design",
  "Education",
];

const SERVICE_AREAS = ["5 miles", "25 miles", "50 miles", "City", "State", "Remote", "Custom"] as const;

const LINK_PLATFORMS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "LinkedIn",
  "Website",
  "Spotify",
  "SoundCloud",
  "X",
  "Twitch",
  "Behance",
];

/* ------------------------------ small UI ------------------------------ */

function Toggle({
  on,
  onChange,
  disabled = false,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${
        disabled ? "cursor-not-allowed opacity-40" : ""
      } ${on ? "bg-lime-400" : "bg-zinc-700"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  hint,
  on,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className={`text-sm font-medium ${disabled ? "text-zinc-500" : "text-zinc-200"}`}>{label}</p>
        {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
      </div>
      <Toggle on={on} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label className="text-xs font-bold uppercase tracking-wide text-zinc-400">{children}</label>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-card-raised px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-lime-400/50";

function Section({
  id,
  title,
  sub,
  children,
}: {
  id: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`sec-${id}`} className="card scroll-mt-24 p-5">
      <h2 className="text-sm font-bold text-zinc-100">{title}</h2>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** downscale an uploaded image so it fits comfortably in localStorage */
function readImage(file: File, maxW: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* =============================== main =============================== */

export default function EditProfile() {
  const router = useRouter();
  const [saved, setSaved] = useState<ProfileData>(DEFAULT_PROFILE);
  const [draft, setDraft] = useState<ProfileData>(DEFAULT_PROFILE);
  const [active, setActive] = useState<SectionId>("profile");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [toast, setToast] = useState(false);

  /* platform-verified state — read-only here */
  const { user: sessionUser } = useSession();
  const campus = sessionUser?.campus ?? null;
  const studentVerified = !!campus;
  const trust = (sessionUser?.profile.trustLevel ?? "standard") as "standard" | "identity" | "high-trust";
  const [verifyBusy, setVerifyBusy] = useState(false);
  const verifySchool = async () => {
    setVerifyBusy(true);
    await fetch("/api/campus/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    invalidateSession();
    setVerifyBusy(false);
  };

  useEffect(() => {
    loadProfile().then((p) => {
      if (!p) {
        router.push("/login");
        return;
      }
      setSaved(p);
      setDraft(p);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const set = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const usernameStatus: UsernameStatus = checkUsername(draft.username, saved.username);
  const usernameBlocked = usernameStatus === "unavailable" || usernameStatus === "invalid";
  const canSave = dirty && !usernameBlocked && draft.displayName.trim().length > 0;

  const onSave = async () => {
    if (!canSave) return;
    const clean = { ...draft, username: draft.username.trim().replace(/^@/, "").toLowerCase() };
    const ok = await saveProfile(clean);
    if (!ok) return;
    setSaved(clean);
    setToast(true);
    setTimeout(() => router.push("/profile"), 900);
  };

  const jump = (id: SectionId) => {
    setActive(id);
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* file inputs */
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  /* add-entry mini-forms */
  const [roleInput, setRoleInput] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [xpForm, setXpForm] = useState<ExperienceEntry | null>(null);
  const [eduForm, setEduForm] = useState<EducationEntry | null>(null);
  const [linkForm, setLinkForm] = useState<SocialLink | null>(null);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [servicePrice, setServicePrice] = useState("");

  /* my real DB service listings — changes here apply immediately */
  interface MyService {
    id: string;
    title: string;
    price: number;
    paused: boolean;
    active: boolean;
    visibility: string;
    category: string;
    fulfillment: string;
    bookings: { upcoming: number; completed: number; cancelled: number; earned: number };
  }
  const [myServices, setMyServices] = useState<MyService[]>([]);
  interface CompletedProject {
    id: string;
    title: string;
    client: string;
    rating: number | null;
    inPortfolio: boolean;
  }
  const [completedProjects, setCompletedProjects] = useState<CompletedProject[]>([]);
  const [workStats, setWorkStats] = useState<{
    completedProjects?: number | null;
    approvedExtensions?: number;
    rating?: number | null;
    reviewsCount?: number;
  }>({});
  const loadWork = async () => {
    const res = await fetch("/api/me/portfolio", { cache: "no-store" });
    if (res.ok) setCompletedProjects((await res.json()).completedProjects ?? []);
  };
  useEffect(() => {
    loadWork();
  }, []);
  useEffect(() => {
    if (!sessionUser) return;
    fetch(`/api/users/${sessionUser.handle}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.stats && setWorkStats(d.stats));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser?.handle]);
  const togglePortfolioProject = async (cp: CompletedProject) => {
    if (cp.inPortfolio) {
      const res = await fetch("/api/me/portfolio", { cache: "no-store" });
      const d = await res.json();
      const item = (d.items ?? []).find((i: { projectId: string | null }) => i.projectId === cp.id);
      if (item) await fetch(`/api/me/portfolio?id=${item.id}`, { method: "DELETE" });
    } else {
      await fetch("/api/me/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: cp.id }),
      });
    }
    loadWork();
  };
  const loadServices = async () => {
    // the management view: EVERY canonical record — drafts, unlisted,
    // followers-only, paused, and deactivated history included
    const res = await fetch("/api/me/services", { cache: "no-store" });
    const data = await res.json();
    setMyServices(data.services ?? []);
  };
  useEffect(() => {
    loadServices();
  }, []);
  const svcPatch = async (id: string, patch: Record<string, unknown>) => {
    await fetch(`/api/services/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    loadServices();
  };
  // deactivate = history, not erasure; reactivate brings it right back
  const svcRemove = async (id: string) => {
    await fetch(`/api/services/${id}`, { method: "DELETE" });
    loadServices();
  };

  return (
    <div className="mx-auto max-w-5xl pb-48 lg:pb-28">
      {/* ------------------------------ header ------------------------------ */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Edit Profile</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Update how people see you, what you do, and what you&apos;re available for.
          </p>
        </div>
        <button
          onClick={() => setPreviewOpen(true)}
          className="btn-ghost px-3.5 py-1.5 text-xs sm:text-sm"
        >
          <Eye className="h-4 w-4" /> Preview public profile
        </button>
      </div>

      {/* what-controls-what explainer */}
      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-line bg-card px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
        <p className="text-xs leading-relaxed text-zinc-400">
          You control your identity here. <span className="text-zinc-200">Verified badges</span> come from
          Mavyn verification, and <span className="text-zinc-200">performance metrics</span> are calculated
          from your completed projects — neither can be edited manually.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[190px_1fr]">
        {/* ------------------------------ section nav ------------------------------ */}
        <nav className="no-scrollbar sticky top-16 z-10 -mx-1 flex gap-1 overflow-x-auto px-1 lg:top-20 lg:h-fit lg:flex-col lg:overflow-visible">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => jump(s.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                active === s.id
                  ? "bg-card-raised text-zinc-50"
                  : "text-zinc-400 hover:bg-card hover:text-zinc-200"
              }`}
            >
              <s.icon className="h-4 w-4" /> {s.label}
            </button>
          ))}
        </nav>

        {/* ------------------------------ sections ------------------------------ */}
        <div className="min-w-0 space-y-5">
          {/* ============================ 1. PROFILE ============================ */}
          <Section id="profile" title="Profile" sub="Your basic public identity — photo, name, bio, and where you are.">
            {/* cover */}
            <FieldLabel hint="Recommended 1500 × 500 px. Shown at the top of your profile.">Cover photo</FieldLabel>
            <div className="relative h-32 overflow-hidden rounded-xl border border-line sm:h-40">
              {draft.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={draft.cover}
                  alt="Cover"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: `center ${draft.coverPos}%` }}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-card-raised text-xs text-zinc-500">
                  No cover photo
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button onClick={() => coverInput.current?.click()} className="btn-ghost px-3 py-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" /> Upload cover
              </button>
              {draft.cover && (
                <>
                  <label className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-zinc-400">
                    Reposition
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={draft.coverPos}
                      onChange={(e) => set("coverPos", Number(e.target.value))}
                      className="w-24 accent-lime-400"
                    />
                  </label>
                  <button
                    onClick={() => set("cover", null)}
                    className="rounded-full border border-line px-3 py-1.5 text-xs text-zinc-400 transition hover:border-rose-400/40 hover:text-rose-300"
                  >
                    Remove
                  </button>
                </>
              )}
              <input
                ref={coverInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) set("cover", await readImage(f, 1600));
                  e.target.value = "";
                }}
              />
            </div>

            {/* avatar */}
            <div className="mt-5">
              <FieldLabel hint="Recommended square, at least 400 × 400 px.">Profile photo</FieldLabel>
              <div className="flex items-center gap-4">
                <Avatar src={draft.avatar} initials="D" gradient="from-lime-400 to-emerald-600" size="lg" />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => avatarInput.current?.click()} className="btn-ghost px-3 py-1.5 text-xs">
                    <Camera className="h-3.5 w-3.5" /> Change photo
                  </button>
                  {draft.avatar && (
                    <button
                      onClick={() => set("avatar", null)}
                      className="rounded-full border border-line px-3 py-1.5 text-xs text-zinc-400 transition hover:border-rose-400/40 hover:text-rose-300"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
                <input
                  ref={avatarInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) set("avatar", await readImage(f, 512));
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            {/* name + username */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel hint="This is what appears publicly.">Display name</FieldLabel>
                <input
                  value={draft.displayName}
                  onChange={(e) => set("displayName", e.target.value)}
                  className={inputCls}
                  maxLength={50}
                />
              </div>
              <div>
                <FieldLabel hint="Username changes may affect profile links and mentions.">Username</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                    @
                  </span>
                  <input
                    value={draft.username}
                    readOnly
                    className={`${inputCls} pl-8 opacity-60`}
                    maxLength={30}
                    title="Username changes are an account-level operation — coming to Settings"
                  />
                </div>
                {usernameStatus === "available" && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-lime-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> Username available.
                  </p>
                )}
                {usernameStatus === "unavailable" && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Username unavailable.
                  </p>
                )}
                {usernameStatus === "invalid" && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> 3–30 characters: letters, numbers,
                    underscores, periods.
                  </p>
                )}
              </div>
            </div>

            {/* bio */}
            <div className="mt-5">
              <FieldLabel>Bio</FieldLabel>
              <textarea
                value={draft.bio}
                onChange={(e) => set("bio", e.target.value.slice(0, 300))}
                rows={4}
                className={`${inputCls} resize-none leading-relaxed`}
              />
              <p className="mt-1 text-right font-mono text-[11px] tracking-[0.08em] text-zinc-500">
                {draft.bio.length} / 300
              </p>
              <div className="rounded-xl border border-line-soft bg-card-raised/50 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  This is how your bio will appear publicly
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">
                  {draft.bio || <span className="italic text-zinc-600">Your bio is empty.</span>}
                </p>
              </div>
            </div>

            {/* location — simple free-text fields. The geo reference
                system (db/geo.db, /api/geo/*, lib/server/geo.ts) stays
                available behind the scenes for a future version, but
                basic location entry must NEVER depend on it. */}
            <div className="mt-5">
              <FieldLabel hint="Your exact address is never shown publicly — city, state, and country only.">
                Location
              </FieldLabel>
              <div className="grid gap-3 sm:grid-cols-4">
                <input
                  value={draft.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="City"
                  aria-label="City"
                  className={inputCls}
                />
                <input
                  value={draft.county}
                  onChange={(e) => set("county", e.target.value)}
                  placeholder="County"
                  aria-label="County"
                  className={inputCls}
                />
                <input
                  value={draft.state}
                  onChange={(e) => set("state", e.target.value)}
                  placeholder="State"
                  aria-label="State"
                  className={inputCls}
                />
                <input
                  value={draft.country}
                  onChange={(e) => set("country", e.target.value)}
                  placeholder="Country"
                  aria-label="Country"
                  className={inputCls}
                />
              </div>

              {/* location visibility — the user decides the precision */}
              <div className="mt-3">
                <FieldLabel hint="The most precise level anyone can see. Your exact address and coordinates are always private, no matter what you pick.">
                  Location visibility
                </FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { v: "city", l: "City" },
                      { v: "county", l: "County" },
                      { v: "state", l: "State" },
                      { v: "country", l: "Country" },
                      { v: "hidden", l: "Don't show my location" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.v}
                      onClick={() => set("locationVisibility", o.v)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        draft.locationVisibility === o.v
                          ? "border-violet-400/50 bg-violet-400/10 text-violet-300"
                          : "border-line text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
                <p className="mt-2 rounded-lg border border-line-soft bg-card-raised/50 px-3 py-2 text-xs text-zinc-500">
                  Publicly shown as:{" "}
                  <span className="font-medium text-zinc-300">
                    {draft.locationVisibility === "hidden"
                      ? "nothing — location hidden"
                      : draft.locationVisibility === "country"
                        ? draft.country || "—"
                        : draft.locationVisibility === "state"
                          ? draft.state || "—"
                          : draft.locationVisibility === "county"
                            ? [draft.county, draft.state].filter(Boolean).join(", ") || "—"
                            : [draft.city, draft.state].filter(Boolean).join(", ") || "—"}
                  </span>
                  {draft.serviceArea !== "Remote" && (
                    <> · clients see your service area (&ldquo;{draft.serviceArea}&rdquo;), never an address</>
                  )}
                </p>
              </div>
              <div className="mt-3">
                <FieldLabel hint="How far you'll travel for in-person work. Connects to Services and Opportunities.">
                  Service area
                </FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {SERVICE_AREAS.map((a) => (
                    <button
                      key={a}
                      onClick={() => set("serviceArea", a)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        draft.serviceArea === a
                          ? "border-lime-400/50 bg-lime-400/10 text-lime-300"
                          : "border-line text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                {draft.serviceArea === "Custom" && (
                  <input
                    value={draft.serviceAreaCustom}
                    onChange={(e) => set("serviceAreaCustom", e.target.value)}
                    placeholder="e.g. DMV area — Baltimore, DC, Northern VA"
                    className={`${inputCls} mt-2`}
                  />
                )}
              </div>
            </div>
          </Section>

          {/* ========================= 2. PROFESSIONAL ========================= */}
          <Section
            id="professional"
            title="Professional identity"
            sub="Roles describe what you are. Skills describe what you can do — both power discovery and search."
          >
            {/* roles */}
            <FieldLabel hint="Your primary role leads your profile. Additional roles appear after it, in order.">
              Primary role
            </FieldLabel>
            <input
              value={draft.primaryRole}
              onChange={(e) => set("primaryRole", e.target.value)}
              className={`${inputCls} max-w-sm`}
            />

            <div className="mt-4">
              <FieldLabel>Additional roles</FieldLabel>
              <ul className="space-y-1.5">
                {draft.additionalRoles.map((r, i) => (
                  <li
                    key={r}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card-raised px-3.5 py-2"
                  >
                    <span className="text-sm text-zinc-200">
                      <span className="mr-2 font-mono text-[11px] tracking-[0.08em] text-zinc-500">
                        {i === 0 ? "SECONDARY" : `#${i + 1}`}
                      </span>
                      {r}
                    </span>
                    <span className="flex items-center gap-1">
                      <button
                        disabled={i === 0}
                        onClick={() => {
                          const next = [...draft.additionalRoles];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          set("additionalRoles", next);
                        }}
                        className="rounded-md p-1 text-zinc-500 transition hover:text-zinc-200 disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        disabled={i === draft.additionalRoles.length - 1}
                        onClick={() => {
                          const next = [...draft.additionalRoles];
                          [next[i], next[i + 1]] = [next[i + 1], next[i]];
                          set("additionalRoles", next);
                        }}
                        className="rounded-md p-1 text-zinc-500 transition hover:text-zinc-200 disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => set("additionalRoles", draft.additionalRoles.filter((x) => x !== r))}
                        className="rounded-md p-1 text-zinc-500 transition hover:text-rose-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <input
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && roleInput.trim()) {
                      if (!draft.additionalRoles.includes(roleInput.trim()))
                        set("additionalRoles", [...draft.additionalRoles, roleInput.trim()]);
                      setRoleInput("");
                    }
                  }}
                  placeholder="Add role…"
                  className={`${inputCls} max-w-xs`}
                />
                <button
                  onClick={() => {
                    if (roleInput.trim() && !draft.additionalRoles.includes(roleInput.trim())) {
                      set("additionalRoles", [...draft.additionalRoles, roleInput.trim()]);
                      setRoleInput("");
                    }
                  }}
                  className="btn-ghost px-3 py-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" /> Add role
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ROLE_SUGGESTIONS.filter(
                  (r) => r !== draft.primaryRole && !draft.additionalRoles.includes(r)
                )
                  .slice(0, 6)
                  .map((r) => (
                    <button
                      key={r}
                      onClick={() => set("additionalRoles", [...draft.additionalRoles, r])}
                      className="chip transition hover:border-violet-400/40 hover:text-violet-300"
                    >
                      + {r}
                    </button>
                  ))}
              </div>
              <p className="mt-3 rounded-lg border border-line-soft bg-card-raised/50 px-3 py-2 text-xs text-zinc-500">
                Appears on your profile as:{" "}
                <span className="font-medium text-zinc-300">{roleLine(draft)}</span>
              </p>
            </div>

            {/* skills */}
            <div className="mt-6 border-t border-line-soft pt-5">
              <FieldLabel hint='Skills are searchable — someone searching "vocal production" can find you even though your title is Music Producer.'>
                Skills &amp; specialties
              </FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {draft.skills.map((s) => (
                  <span key={s} className="chip inline-flex items-center gap-1.5">
                    {s}
                    <button
                      onClick={() => set("skills", draft.skills.filter((x) => x !== s))}
                      className="text-zinc-500 transition hover:text-rose-300"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && skillInput.trim()) {
                      if (!draft.skills.includes(skillInput.trim()))
                        set("skills", [...draft.skills, skillInput.trim()]);
                      setSkillInput("");
                    }
                  }}
                  placeholder="Add skill…"
                  className={`${inputCls} max-w-xs`}
                />
                <button
                  onClick={() => {
                    if (skillInput.trim() && !draft.skills.includes(skillInput.trim())) {
                      set("skills", [...draft.skills, skillInput.trim()]);
                      setSkillInput("");
                    }
                  }}
                  className="btn-ghost px-3 py-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" /> Add skill
                </button>
              </div>
            </div>

            {/* experience */}
            <div className="mt-6 border-t border-line-soft pt-5">
              <FieldLabel hint="Experience is what you've done. Portfolio is what you made — they're separate.">
                Experience
              </FieldLabel>
              <ul className="space-y-2">
                {draft.experience.map((x) => (
                  <li
                    key={x.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-line bg-card-raised px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-100">
                        {x.position} <span className="font-normal text-zinc-400">— {x.organization}</span>
                      </p>
                      <p className="font-mono text-[11px] tracking-[0.08em] text-zinc-500">
                        {x.start}–{x.end || "Present"}
                        {x.location ? ` · ${x.location}` : ""}
                      </p>
                      {x.description && <p className="mt-1 text-xs text-zinc-400">{x.description}</p>}
                    </div>
                    <button
                      onClick={() => set("experience", draft.experience.filter((e) => e.id !== x.id))}
                      className="rounded-md p-1 text-zinc-500 transition hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              {xpForm ? (
                <div className="mt-3 space-y-2.5 rounded-xl border border-lime-400/30 bg-card-raised p-3.5">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <input
                      value={xpForm.position}
                      onChange={(e) => setXpForm({ ...xpForm, position: e.target.value })}
                      placeholder="Position"
                      className={inputCls}
                    />
                    <input
                      value={xpForm.organization}
                      onChange={(e) => setXpForm({ ...xpForm, organization: e.target.value })}
                      placeholder="Organization"
                      className={inputCls}
                    />
                    <input
                      value={xpForm.start}
                      onChange={(e) => setXpForm({ ...xpForm, start: e.target.value })}
                      placeholder="Start (e.g. 2023)"
                      className={inputCls}
                    />
                    <input
                      value={xpForm.end}
                      onChange={(e) => setXpForm({ ...xpForm, end: e.target.value })}
                      placeholder="End (blank = Present)"
                      className={inputCls}
                    />
                    <input
                      value={xpForm.location || ""}
                      onChange={(e) => setXpForm({ ...xpForm, location: e.target.value })}
                      placeholder="Location (optional)"
                      className={inputCls}
                    />
                  </div>
                  <textarea
                    value={xpForm.description || ""}
                    onChange={(e) => setXpForm({ ...xpForm, description: e.target.value })}
                    placeholder="Description, skills used… (optional)"
                    rows={2}
                    className={`${inputCls} resize-none`}
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={!xpForm.position.trim() || !xpForm.organization.trim() || !xpForm.start.trim()}
                      onClick={() => {
                        set("experience", [...draft.experience, xpForm]);
                        setXpForm(null);
                      }}
                      className="btn-lime px-3.5 py-1.5 text-xs disabled:opacity-40"
                    >
                      Add
                    </button>
                    <button onClick={() => setXpForm(null)} className="btn-ghost px-3.5 py-1.5 text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() =>
                    setXpForm({ id: `xp-${Date.now()}`, position: "", organization: "", start: "", end: "" })
                  }
                  className="btn-ghost mt-2 px-3 py-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" /> Add experience
                </button>
              )}
            </div>

            {/* portfolio from completed work */}
            <div className="mt-6 border-t border-line-soft pt-5">
              <FieldLabel hint="Completed Mavyn projects can automatically become portfolio entries — you choose which ones show.">
                Portfolio
              </FieldLabel>
              <ul className="space-y-2">
                {completedProjects.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card-raised px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-100">{w.title}</p>
                      <p className="text-xs text-zinc-500">
                        Client: {w.client}
                        {w.rating != null && ` · ★ ${w.rating.toFixed(1)}`}
                      </p>
                    </div>
                    <button
                      onClick={() => togglePortfolioProject(w)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                        w.inPortfolio
                          ? "border border-lime-400/40 bg-lime-400/10 text-lime-300"
                          : "border border-line text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      {w.inPortfolio ? "✓ In portfolio" : "Add to portfolio"}
                    </button>
                  </li>
                ))}
                {completedProjects.length === 0 && (
                  <li className="rounded-xl border border-dashed border-line px-3.5 py-3 text-xs text-zinc-500">
                    No completed projects yet — finish one and it can become a verified portfolio entry.
                  </li>
                )}
              </ul>
              <p className="mt-2 text-xs text-zinc-500">
                Uploads (images, video, audio, links) are managed on your{" "}
                <Link href="/profile" className="text-violet-300 hover:underline">
                  Portfolio tab
                </Link>
                .
              </p>
            </div>

            {/* education */}
            <div className="mt-6 border-t border-line-soft pt-5">
              <FieldLabel hint="Helps with campus discovery and student opportunities.">Education</FieldLabel>
              <ul className="space-y-2">
                {draft.education.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card-raised px-3.5 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <GraduationCap className="h-4 w-4 shrink-0 text-violet-300" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-100">{e.school}</p>
                        <p className="text-xs text-zinc-500">
                          {e.program}
                          {e.gradYear ? ` · Expected ${e.gradYear}` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => set("education", draft.education.filter((x) => x.id !== e.id))}
                      className="rounded-md p-1 text-zinc-500 transition hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              {eduForm ? (
                <div className="mt-3 space-y-2.5 rounded-xl border border-violet-400/30 bg-card-raised p-3.5">
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <input
                      value={eduForm.school}
                      onChange={(e) => setEduForm({ ...eduForm, school: e.target.value })}
                      placeholder="School"
                      className={inputCls}
                    />
                    <input
                      value={eduForm.program}
                      onChange={(e) => setEduForm({ ...eduForm, program: e.target.value })}
                      placeholder="Degree / program"
                      className={inputCls}
                    />
                    <input
                      value={eduForm.gradYear || ""}
                      onChange={(e) => setEduForm({ ...eduForm, gradYear: e.target.value })}
                      placeholder="Graduation (optional)"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={!eduForm.school.trim() || !eduForm.program.trim()}
                      onClick={() => {
                        set("education", [...draft.education, eduForm]);
                        setEduForm(null);
                      }}
                      className="btn-lime px-3.5 py-1.5 text-xs disabled:opacity-40"
                    >
                      Add
                    </button>
                    <button onClick={() => setEduForm(null)} className="btn-ghost px-3.5 py-1.5 text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setEduForm({ id: `edu-${Date.now()}`, school: "", program: "" })}
                  className="btn-ghost mt-2 px-3 py-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" /> Add education
                </button>
              )}
            </div>
          </Section>

          {/* ============================= 3. WORK ============================= */}
          <Section
            id="work"
            title="Work"
            sub="Your services, availability, preferences, and what your profile can be used for."
          >
            {/* services */}
            <FieldLabel hint="What visitors can book from your profile. Pausing hides a service without deleting it.">
              Your Services
            </FieldLabel>
            <ul className="space-y-2">
              {myServices.map((s) => (
                <li
                  key={s.id}
                  className={`rounded-xl border px-3.5 py-2.5 transition ${
                    s.paused ? "border-line-soft bg-card-raised/40 opacity-70" : "border-line bg-card-raised"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-100">
                        {s.title}
                        {!s.active && (
                          <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                            Deactivated — kept in history
                          </span>
                        )}
                        {s.active && s.paused && (
                          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                            Paused
                          </span>
                        )}
                        {s.active && s.visibility !== "public" && (
                          <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-300">
                            {s.visibility === "draft" ? "Draft" : s.visibility === "unlisted" ? "Unlisted" : "Followers only"}
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-[11px] tracking-[0.08em] text-lime-300">
                        Starting at ${s.price} <span className="text-zinc-500">· {s.category}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {s.bookings.upcoming} upcoming · {s.bookings.completed} completed
                        {s.bookings.earned > 0 ? ` · $${s.bookings.earned} earned` : ""}
                        {s.bookings.cancelled > 0 ? ` · ${s.bookings.cancelled} cancelled` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingService(editingService === s.id ? null : s.id);
                          setServicePrice(String(s.price));
                        }}
                        className="btn-ghost px-2.5 py-1 text-[11px]"
                      >
                        <PencilLine className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => svcPatch(s.id, { paused: !s.paused })}
                        className="btn-ghost px-2.5 py-1 text-[11px]"
                      >
                        {s.paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                        {s.paused ? "Resume" : "Pause"}
                      </button>
                      {s.active ? (
                        <button
                          onClick={() => svcRemove(s.id)}
                          title="Deactivates the listing — it stays in your history and can be reactivated"
                          className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-zinc-400 transition hover:border-rose-400/40 hover:text-rose-300"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => svcPatch(s.id, { active: true })}
                          className="btn-lime px-2.5 py-1 text-[11px]"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </div>
                  {editingService === s.id && (
                    <div className="mt-2.5 flex items-center gap-2 border-t border-line-soft pt-2.5">
                      <span className="text-xs text-zinc-500">Starting at $</span>
                      <input
                        value={servicePrice}
                        onChange={(e) => setServicePrice(e.target.value.replace(/[^0-9]/g, ""))}
                        className={`${inputCls} w-24 py-1.5`}
                      />
                      <button
                        onClick={() => {
                          const n = Number(servicePrice);
                          if (n > 0) svcPatch(s.id, { price: n });
                          setEditingService(null);
                        }}
                        className="btn-lime px-3 py-1.5 text-xs"
                      >
                        Update
                      </button>
                      <span className="text-[11px] text-zinc-500">
                        Your listed price is your payout — the buyer pays the 5% platform fee on top.
                      </span>
                      <label className="ml-auto flex items-center gap-1.5 text-[11px] text-zinc-500">
                        Visibility
                        <select
                          value={s.visibility}
                          onChange={(e) => svcPatch(s.id, { visibility: e.target.value })}
                          className={`${inputCls} w-auto py-1 text-xs`}
                        >
                          <option value="public">Public</option>
                          <option value="followers">Followers only</option>
                          <option value="unlisted">Unlisted / link only</option>
                          <option value="draft">Private draft</option>
                        </select>
                      </label>
                    </div>
                  )}
                </li>
              ))}
              {myServices.length === 0 && (
                <li className="rounded-xl border border-dashed border-line px-3.5 py-3 text-xs text-zinc-500">
                  No active services. Create one and it appears on your profile and in the marketplace.
                </li>
              )}
            </ul>
            <Link href="/services/new" className="btn-ghost mt-2 inline-flex px-3 py-1.5 text-xs">
              <FolderPlus className="h-3.5 w-3.5" /> Create Service
            </Link>

            {/* availability */}
            <div className="mt-6 border-t border-line-soft pt-5">
              <FieldLabel>Availability</FieldLabel>
              <ToggleRow
                label="Open to Work"
                hint="Shows the badge on your profile and includes you in hiring discovery."
                on={draft.openToWork}
                onChange={(v) => set("openToWork", v)}
              />
              <div className={draft.openToWork ? "" : "pointer-events-none opacity-40"}>
                <p className="mb-1.5 mt-2 text-xs font-bold uppercase tracking-wide text-zinc-400">
                  Available for
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_FOR.map((a) => {
                    const on = draft.availableFor.includes(a);
                    return (
                      <button
                        key={a}
                        onClick={() =>
                          set(
                            "availableFor",
                            on ? draft.availableFor.filter((x) => x !== a) : [...draft.availableFor, a]
                          )
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          on
                            ? "border-lime-400/50 bg-lime-400/10 text-lime-300"
                            : "border-line text-zinc-400 hover:border-zinc-600"
                        }`}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => set("availabilityMode", "now")}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      draft.availabilityMode === "now"
                        ? "border-lime-400/50 bg-lime-400/10 text-lime-300"
                        : "border-line text-zinc-400"
                    }`}
                  >
                    Available now
                  </button>
                  <button
                    onClick={() => set("availabilityMode", "from")}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      draft.availabilityMode === "from"
                        ? "border-lime-400/50 bg-lime-400/10 text-lime-300"
                        : "border-line text-zinc-400"
                    }`}
                  >
                    Available from…
                  </button>
                  {draft.availabilityMode === "from" && (
                    <input
                      type="date"
                      value={draft.availableFrom}
                      onChange={(e) => set("availableFrom", e.target.value)}
                      className={`${inputCls} w-auto py-1.5`}
                    />
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-line-soft bg-card-raised/50 px-3 py-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                <p className="text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-300">Response time is calculated.</span>{" "}
                  It builds from your actual reply behavior, not self-reported claims, so it stays honest.
                </p>
              </div>
            </div>

            {/* work preferences */}
            <div className="mt-6 border-t border-line-soft pt-5">
              <FieldLabel hint="Tells Mavyn what you're looking for — this feeds your For You feed and recommendations.">
                Work preferences
              </FieldLabel>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-zinc-400">Interested in</p>
              <div className="flex flex-wrap gap-1.5">
                {INTERESTS.map((it) => {
                  const on = draft.interests.includes(it);
                  return (
                    <button
                      key={it}
                      onClick={() =>
                        set("interests", on ? draft.interests.filter((x) => x !== it) : [...draft.interests, it])
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        on
                          ? "border-violet-400/50 bg-violet-400/10 text-violet-300"
                          : "border-line text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      {it}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-zinc-400">Work location</p>
                  <div className="flex gap-1.5">
                    {(["Local", "Remote", "Hybrid"] as const).map((w) => (
                      <button
                        key={w}
                        onClick={() => set("workLocation", w)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          draft.workLocation === w
                            ? "border-lime-400/50 bg-lime-400/10 text-lime-300"
                            : "border-line text-zinc-400"
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-zinc-400">
                    Minimum project budget <span className="normal-case text-zinc-600">(optional)</span>
                  </p>
                  <div className="relative max-w-[140px]">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                      $
                    </span>
                    <input
                      value={draft.minBudget}
                      onChange={(e) => set("minBudget", e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="None"
                      className={`${inputCls} pl-7`}
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-zinc-400">Collaboration</p>
                  <div className="flex gap-1.5">
                    {(["Paid", "Collaboration", "Either"] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => set("collabPref", c)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          draft.collabPref === c
                            ? "border-lime-400/50 bg-lime-400/10 text-lime-300"
                            : "border-line text-zinc-400"
                        }`}
                      >
                        {c === "Collaboration" ? "Collab" : c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* hiring settings */}
            <div className="mt-6 border-t border-line-soft pt-5">
              <FieldLabel hint="Controls whether visitors see Message, Hire Me, and Create Project on your profile.">
                Hiring
              </FieldLabel>
              <ToggleRow
                label="Hiring enabled"
                hint="Let people contact you about paid work and services."
                on={draft.hiringEnabled}
                onChange={(v) => set("hiringEnabled", v)}
              />
              <div className="ml-3 border-l border-line-soft pl-4">
                <ToggleRow
                  label="Accept project offers"
                  on={draft.acceptOffers}
                  onChange={(v) => set("acceptOffers", v)}
                  disabled={!draft.hiringEnabled}
                />
                <ToggleRow
                  label="Accept service bookings"
                  on={draft.acceptBookings}
                  onChange={(v) => set("acceptBookings", v)}
                  disabled={!draft.hiringEnabled}
                />
                <ToggleRow
                  label="Accept collaboration requests"
                  on={draft.acceptCollabs}
                  onChange={(v) => set("acceptCollabs", v)}
                  disabled={!draft.hiringEnabled}
                />
              </div>
            </div>

            {/* work performance — read-only */}
            <div className="mt-6 border-t border-line-soft pt-5">
              <FieldLabel hint="Your reliability metrics are calculated from completed Mavyn projects. They can't be edited — that's what makes them credible.">
                Work Performance
              </FieldLabel>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { v: `${workStats.completedProjects ?? 0}`, l: "Completed" },
                  { v: `${workStats.approvedExtensions ?? 0}`, l: "Approved extensions" },
                  { v: workStats.rating != null ? workStats.rating.toFixed(1) : "—", l: "Rating" },
                  { v: `${workStats.reviewsCount ?? 0}`, l: "Reviews" },
                ].map((m) => (
                  <div key={m.l} className="rounded-xl border border-line bg-card-raised px-3 py-2.5 text-center">
                    <p className="font-mono text-lg font-medium tracking-[0.08em] text-zinc-50">{m.v}</p>
                    <p className="text-[11px] text-zinc-500">{m.l}</p>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* ========================= 4. VERIFICATION ========================= */}
          <Section
            id="verification"
            title="Verification"
            sub="Platform-verified credentials. These are earned through verification — never edited."
          >
            {/* identity */}
            <div className="rounded-xl border border-line bg-card-raised p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">Identity verification</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Optional for most creators. Required before publishing services with unsupervised access —
                    childcare, pet care, home access, transportation, personal assistance.
                  </p>
                </div>
                {trust === "standard" ? (
                  <Link href="/settings" className="btn-lime shrink-0 px-3.5 py-1.5 text-xs">
                    Verify identity
                  </Link>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/10 px-3 py-1.5 text-xs font-bold text-lime-300">
                    <Check className="h-3.5 w-3.5" /> {trust === "high-trust" ? "High-Trust Verified" : "Verified"}
                  </span>
                )}
              </div>
              <p className="mt-2.5 border-t border-line-soft pt-2.5 text-[11px] text-zinc-500">
                Verification happens through a separate secure process. Your documents are never displayed
                publicly — only the badge is.
              </p>
            </div>

            {/* student */}
            <div className="mt-3 rounded-xl border border-line bg-card-raised p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">Student status</p>
                  {studentVerified ? (
                    <p className="mt-0.5 text-xs text-zinc-400">
                      <span className="text-violet-300">
                        {campus?.name}
                        {campus?.gradYear ? ` · Class of ${campus.gradYear}` : ""}
                        {campus?.affiliation === "alumni" ? " · Alumni" : ""}
                      </span>{" "}
                      — verified through Mavyn · manage in Settings → School &amp; Education
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Verify your school to unlock Campus — communities, campus services, and student
                      opportunities.
                    </p>
                  )}
                </div>
                {studentVerified ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-400/10 px-3 py-1.5 text-xs font-bold text-violet-300">
                    <Check className="h-3.5 w-3.5" /> Verified
                  </span>
                ) : (
                  <button
                    onClick={verifySchool}
                    disabled={verifyBusy}
                    className="shrink-0 rounded-full bg-violet-400 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-violet-300 disabled:opacity-50"
                  >
                    {verifyBusy ? "Verifying…" : "Verify school"}
                  </button>
                )}
              </div>
              <p className="mt-2.5 border-t border-line-soft pt-2.5 text-[11px] text-zinc-500">
                Student verification is always free. Verification and monetization are separate — College+ is an
                optional upgrade, never a requirement for campus access.
              </p>
            </div>
          </Section>

          {/* ============================ 5. LINKS ============================ */}
          <Section id="links" title="Links" sub="Social accounts and websites shown on your profile. All optional.">
            <ul className="space-y-2">
              {draft.links.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card-raised px-3.5 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-zinc-400">
                      {l.platform}
                    </span>
                    <span className="truncate text-sm text-zinc-300">{l.url}</span>
                  </div>
                  <button
                    onClick={() => set("links", draft.links.filter((x) => x.id !== l.id))}
                    className="rounded-md p-1 text-zinc-500 transition hover:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            {linkForm ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-violet-400/30 bg-card-raised p-3.5">
                <select
                  value={linkForm.platform}
                  onChange={(e) => setLinkForm({ ...linkForm, platform: e.target.value })}
                  className={`${inputCls} w-auto`}
                >
                  {LINK_PLATFORMS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <input
                  value={linkForm.url}
                  onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                  placeholder="URL"
                  className={`${inputCls} min-w-[200px] flex-1`}
                />
                <button
                  disabled={!linkForm.url.trim()}
                  onClick={() => {
                    set("links", [...draft.links, linkForm]);
                    setLinkForm(null);
                  }}
                  className="btn-lime px-3.5 py-1.5 text-xs disabled:opacity-40"
                >
                  Add
                </button>
                <button onClick={() => setLinkForm(null)} className="btn-ghost px-3.5 py-1.5 text-xs">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setLinkForm({ id: `lnk-${Date.now()}`, platform: "Instagram", url: "" })}
                className="btn-ghost mt-2 px-3 py-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Add link
              </button>
            )}
          </Section>

          {/* =========================== 6. PRIVACY =========================== */}
          <Section id="privacy" title="Privacy" sub="Who can find you, contact you, and what visitors can see.">
            <FieldLabel>Profile visibility</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  { v: "public", l: "Public", h: "Anyone can view your profile" },
                  { v: "members", l: "Mavyn members", h: "Only signed-in members" },
                  { v: "private", l: "Private", h: "Only people you approve" },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  onClick={() => set("visibility", o.v)}
                  className={`rounded-xl border px-3.5 py-2.5 text-left transition ${
                    draft.visibility === o.v
                      ? "border-lime-400/50 bg-lime-400/10"
                      : "border-line hover:border-zinc-600"
                  }`}
                >
                  <p className={`text-sm font-semibold ${draft.visibility === o.v ? "text-lime-300" : "text-zinc-200"}`}>
                    {o.l}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">{o.h}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 border-t border-line-soft pt-5">
              <FieldLabel hint="Directly determines which buttons visitors see on your profile.">
                Contact permissions
              </FieldLabel>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-zinc-400">Who can message me?</p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { v: "everyone", l: "Everyone" },
                    { v: "following", l: "People I follow" },
                    { v: "worked", l: "People I've worked with" },
                    { v: "nobody", l: "Nobody" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    onClick={() => set("whoCanMessage", o.v)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      draft.whoCanMessage === o.v
                        ? "border-violet-400/50 bg-violet-400/10 text-violet-300"
                        : "border-line text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <ToggleRow
                  label="Allow project requests"
                  on={draft.allowProjectRequests}
                  onChange={(v) => set("allowProjectRequests", v)}
                />
                <ToggleRow
                  label="Allow service requests"
                  on={draft.allowServiceRequests}
                  onChange={(v) => set("allowServiceRequests", v)}
                />
                <ToggleRow
                  label="Allow collaboration requests"
                  on={draft.allowCollabRequests}
                  onChange={(v) => set("allowCollabRequests", v)}
                />
              </div>
            </div>

            <div className="mt-6 border-t border-line-soft pt-5">
              <FieldLabel>Public information</FieldLabel>
              <div className="grid gap-x-8 sm:grid-cols-2">
                <ToggleRow label="Show location" hint="City only — never an exact address" on={draft.showLocation} onChange={(v) => set("showLocation", v)} />
                <ToggleRow label="Show education" on={draft.showEducation} onChange={(v) => set("showEducation", v)} />
                <ToggleRow label="Show follower count" on={draft.showFollowers} onChange={(v) => set("showFollowers", v)} />
                <ToggleRow label="Show following count" on={draft.showFollowing} onChange={(v) => set("showFollowing", v)} />
                <ToggleRow label="Show portfolio" on={draft.showPortfolio} onChange={(v) => set("showPortfolio", v)} />
                <ToggleRow label="Show completed projects" on={draft.showCompletedProjects} onChange={(v) => set("showCompletedProjects", v)} />
                <ToggleRow label="Show work performance" hint="The Reliable Creator badge" on={draft.showWorkPerformance} onChange={(v) => set("showWorkPerformance", v)} />
                <ToggleRow label="Show availability" hint="The Open to Work badge" on={draft.showAvailability} onChange={(v) => set("showAvailability", v)} />
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* ------------------------------ save bar ------------------------------
          MOBILE FIX: the bottom navigation is ALSO fixed at bottom-0 with
          the same z-index and renders later in the DOM, so below lg it
          painted directly on top of Cancel/Save — the controls existed
          but were invisible and untappable. On touch layouts the bar now
          docks immediately ABOVE the nav (its 3.5rem height + safe-area),
          with full-width thumb-sized buttons. Desktop (lg+) is unchanged:
          same bottom-0 bar, same compact right-aligned pair.            */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-line bg-ink/95 backdrop-blur lg:bottom-0 lg:bg-ink/90" data-guide="profile-save-bar">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2.5 lg:py-3">
          <p className={`${dirty ? "block" : "hidden"} w-full text-center text-[11px] text-zinc-500 sm:block sm:w-auto sm:text-left sm:text-xs`}>
            {dirty
              ? usernameBlocked
                ? "Fix your username before saving."
                : "You have unsaved changes."
              : "All changes saved."}
          </p>
          <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
            <button onClick={() => router.push("/profile")} className="btn-ghost h-11 flex-1 px-4 text-sm sm:flex-none lg:h-auto lg:py-2">
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={!canSave}
              className="btn-lime h-11 flex-1 px-5 text-sm disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none lg:h-auto lg:py-2"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------- toast ------------------------------- */}
      {toast && (
        <div className="fixed bottom-44 left-1/2 z-50 -translate-x-1/2 rounded-full border border-lime-400/40 bg-card px-5 py-2.5 shadow-lg lg:bottom-20">
          <p className="flex items-center gap-2 text-sm font-semibold text-lime-300">
            <Check className="h-4 w-4" /> Changes saved
          </p>
        </div>
      )}

      {/* ------------------------------ preview ------------------------------ */}
      {previewOpen && <PublicPreview draft={draft} campus={campus} completedCount={workStats.completedProjects ?? 0} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

/* ========================== public preview modal ========================== */

function PublicPreview({
  draft,
  campus,
  completedCount,
  onClose,
}: {
  draft: ProfileData;
  campus: { name: string; affiliation?: string; gradYear?: string } | null;
  completedCount: number;
  onClose: () => void;
}) {
  const canMessage = draft.whoCanMessage !== "nobody";
  const canHire = draft.hiringEnabled && draft.acceptBookings && draft.allowServiceRequests;
  const canProject = draft.hiringEnabled && draft.acceptOffers && draft.allowProjectRequests;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Public Preview</h3>
            <p className="text-xs text-zinc-500">Exactly what a stranger sees — using your unsaved draft.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-zinc-500 transition hover:text-zinc-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {draft.visibility === "private" ? (
            <div className="rounded-xl border border-line bg-card-raised p-6 text-center">
              <Lock className="mx-auto h-6 w-6 text-zinc-500" />
              <p className="mt-2 text-sm font-semibold text-zinc-200">This profile is private</p>
              <p className="mt-1 text-xs text-zinc-500">Visitors must request access to see anything.</p>
            </div>
          ) : (
            <>
              {/* mini profile card */}
              <div className="overflow-hidden rounded-xl border border-line">
                <div className="relative h-24">
                  {draft.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={draft.cover}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{ objectPosition: `center ${draft.coverPos}%` }}
                    />
                  ) : (
                    <div className="h-full bg-card-raised" />
                  )}
                </div>
                <div className="px-4 pb-4">
                  <div className="-mt-8">
                    <span className="inline-block rounded-full bg-card p-1">
                      <Avatar src={draft.avatar} initials="D" gradient="from-lime-400 to-emerald-600" size="lg" />
                    </span>
                  </div>
                  <h4 className="mt-1 flex flex-wrap items-center gap-1.5 text-lg font-bold text-zinc-50">
                    {draft.displayName}
                    <VerifiedBadge className="h-4 w-4" />
                  </h4>
                  <p className="text-xs font-medium text-zinc-400">{roleLine(draft)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {draft.openToWork && draft.showAvailability && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> Open to Work
                      </span>
                    )}
                    {campus && (
                      <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                        {campus.name}
                        {campus.gradYear ? ` · Class of ${campus.gradYear}` : ""}
                        {campus.affiliation === "alumni" ? " · Alumni" : ""}
                      </span>
                    )}
                    {draft.showWorkPerformance && completedCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-card-raised px-2 py-0.5 text-[10px] font-semibold text-zinc-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-lime-400" /> Reliable Creator ·{" "}
                        {completedCount} completed
                      </span>
                    )}
                  </div>
                  {draft.bio && <p className="mt-2 text-xs leading-relaxed text-zinc-400">{draft.bio}</p>}
                  {draft.showLocation && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-500">
                      <MapPin className="h-3 w-3 text-lime-400" /> {locationLine(draft)}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    {canMessage && (
                      <span className="btn-ghost pointer-events-none px-3 py-1.5 text-xs">
                        <MessageSquare className="h-3.5 w-3.5" /> Message
                      </span>
                    )}
                    {canHire && (
                      <span className="btn-lime pointer-events-none px-3 py-1.5 text-xs">
                        <Zap className="h-3.5 w-3.5" /> Book / Request
                      </span>
                    )}
                    {canProject && (
                      <span className="pointer-events-none rounded-full border border-violet-400/40 px-3 py-1.5 text-xs font-semibold text-violet-300">
                        Create Project
                      </span>
                    )}
                    {!canMessage && !canHire && !canProject && (
                      <span className="text-[11px] italic text-zinc-600">
                        No contact buttons — messaging and hiring are turned off.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* the three information types */}
              <div className="mt-4 rounded-xl border border-line-soft bg-card-raised/50 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  Three kinds of information on every profile
                </p>
                <ul className="mt-2 space-y-1.5 text-xs text-zinc-400">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime-400" />
                    <span>
                      <span className="font-semibold text-zinc-200">Open to Work</span> — user-controlled
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                    <span>
                      <span className="font-semibold text-zinc-200">School &amp; class year</span> — platform-verified affiliation; the major is never public
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    <span>
                      <span className="font-semibold text-zinc-200">Reliable Creator</span> — platform-calculated
                    </span>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
