"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Activity as ActivityIcon,
  Home,
  Search,
  Users,
  Briefcase,
  Calendar,
  CalendarCheck,
  Tag,
  Disc3,
  ShoppingBag,
  MessageSquare,
  Bookmark,
  BarChart3,
  GraduationCap,
  Lock,
  Sparkles,
  UserCheck,
  UserPlus,
  ContactRound,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import { communities } from "@/lib/data";
import { useSession } from "@/lib/session";
import { getPlan, PRO_EVENT, type Plan } from "@/lib/pro";
import { COLLEGE_PRICE, ALUMNI_PRO_PRICE } from "@/lib/fees";

/* nav grouped by the accent-role system: base → earn (lime) → connect (violet) */
const navGroups: {
  label: string | null;
  dot?: string;
  items: { href: string; label: string; icon: typeof Home; badge?: number; meta?: string; tour?: string }[];
}[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Home", icon: Home, tour: "home" },
      { href: "/discover", label: "Discover", icon: Search, tour: "discover" },
      { href: "/messages", label: "Messages", icon: MessageSquare, badge: 3, tour: "messages" },
      { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    ],
  },
  {
    label: "earn",
    dot: "bg-lime-400",
    items: [
      { href: "/opportunities", label: "Opportunities", icon: Briefcase, tour: "opportunities" },
      { href: "/services", label: "Services", icon: ShoppingBag, tour: "services" },
      { href: "/shop", label: "Shop", icon: Tag },
      { href: "/works", label: "Works", icon: Disc3 },
      { href: "/calendar", label: "Bookings", icon: CalendarCheck, tour: "calendar" },
      { href: "/clients", label: "Clients", icon: UserCheck },
      { href: "/activity", label: "Activity", icon: ActivityIcon, tour: "activity" },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "connect",
    dot: "bg-violet-400",
    items: [
      { href: "/communities", label: "Communities", icon: Users, meta: "joined", tour: "communities" },
      { href: "/events", label: "Events", icon: Calendar },
    ],
  },
];

/**
 * variant "desktop" — the classic sticky column (collapsible via the
 *   hamburger; `collapsed` animates it away and gives content the width)
 * variant "drawer"  — the same sidebar, unchanged content, rendered
 *   inside the mobile slide-in panel
 * Navigation items and functionality are IDENTICAL in both.
 */
export default function Sidebar({
  variant = "desktop",
  collapsed = false,
}: {
  variant?: "desktop" | "drawer";
  collapsed?: boolean;
} = {}) {
  const pathname = usePathname();
  const { user } = useSession();
  const myCommunities = communities.filter((c) => c.joined);
  // plan is account state from the session; PRO_EVENT re-render covers
  // same-tab changes made on /pro before the session refetch lands
  const [, forceTick] = useState(0);
  useEffect(() => {
    const sync = () => forceTick((n) => n + 1);
    window.addEventListener(PRO_EVENT, sync);
    return () => window.removeEventListener(PRO_EVENT, sync);
  }, []);
  const plan = (user?.plan ?? "free") as Plan;
  const pro = plan === "pro";
  // campus access is a database fact (verified school), never a local flag
  const campus = user?.campus ?? null;
  // BUSINESS accounts are hiring accounts, not profile pages: their nav
  // swaps "Clients" for Hiring · People · Payments (sky = business).
  // Same real routes, different lens — nothing is hidden from anyone.
  const isBusiness = user?.accountType === "business";
  const groups = navGroups.map((g) => ({
    ...g,
    items: isBusiness ? g.items.filter((i) => i.href !== "/clients") : g.items,
  }));
  if (isBusiness)
    groups.push({
      label: "business",
      dot: "bg-sky-400",
      items: [
        { href: "/hiring", label: "Hiring", icon: UserPlus, tour: "hiring" },
        { href: "/people", label: "People", icon: ContactRound, tour: "people" },
        { href: "/payments", label: "Payments", icon: Wallet, tour: "payments" },
      ],
    });

  return (
    <aside
      className={
        variant === "drawer"
          ? "flex h-full w-full flex-col gap-4 overflow-y-auto p-4 pb-10"
          : `sticky top-20 hidden max-h-[calc(100vh-6rem)] shrink-0 flex-col gap-4 self-start pb-6 transition-[width,opacity,margin] duration-300 ease-in-out lg:flex ${
              collapsed
                ? "w-0 -translate-x-2 overflow-hidden opacity-0 lg:-mr-6"
                : "w-60 overflow-y-auto opacity-100"
            }`
      }
      aria-hidden={variant === "desktop" && collapsed ? true : undefined}
    >
      {/* Main nav — unboxed; grouping does the work */}
      <nav className="space-y-4 px-1">
        {groups.map((g) => (
          <div key={g.label ?? "base"}>
            {g.label && (
              <p className="flex items-center gap-1.5 px-3 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                <span className={`h-1 w-1 rounded-full ${g.dot}`} />
                {g.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const base = item.href.split("?")[0];
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : !item.href.includes("?") && pathname.startsWith(base);
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      data-tour={item.tour}
                      className={`flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                        active
                          ? "bg-white/10 text-zinc-50"
                          : "text-zinc-300 hover:bg-card-raised hover:text-zinc-100"
                      }`}
                    >
                      <item.icon
                        className={`h-[18px] w-[18px] ${active ? "text-zinc-50" : "text-zinc-500"}`}
                      />
                      {item.label}
                      {item.badge ? (
                        <span className="ml-auto rounded-full bg-violet-400 px-1.5 py-0.5 text-[10px] font-bold leading-none text-zinc-950">
                          {item.badge}
                        </span>
                      ) : item.meta === "joined" ? (
                        <span className="ml-auto font-mono text-[9px] text-zinc-600">
                          {myCommunities.length} joined
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {/* Your Campus is a VERIFIED-IDENTITY feature: verified members get
            the live item; signed-in unverified members see it LOCKED with
            the path in (verification, always free — never a plan). Plan
            (Free vs Pro) never factors in. Guests see nothing. */}
        {campus ? (
          <div className="mt-1">
            <Link
              href="/campus"
              data-tour="campus"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                pathname.startsWith("/campus")
                  ? "bg-violet-400/15 text-violet-200"
                  : "text-violet-300 hover:bg-violet-400/10"
              }`}
            >
              <GraduationCap className="h-[18px] w-[18px]" /> Your Campus
              <span className="ml-auto flex items-center gap-1.5 truncate font-mono text-[9px] text-zinc-500">
                {campus.affiliation === "alumni" && (
                  <span className="rounded border border-violet-400/40 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-violet-300">Alumni</span>
                )}
                {campus.name.replace(" University", "")}
              </span>
            </Link>
          </div>
        ) : user ? (
          user.testerMode !== "simulation" ? (
            /* DEMO MODE: gate is open for testing — labeled, never implied
               to be a real verified state */
            <div className="mt-1">
              <Link
                href="/campus"
                title="DEMO MODE — access opened for testing. In Simulation Mode this requires verification."
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  pathname.startsWith("/campus")
                    ? "bg-violet-400/15 text-violet-200"
                    : "text-violet-300 hover:bg-violet-400/10"
                }`}
              >
                <GraduationCap className="h-[18px] w-[18px]" /> Your Campus
                <span className="ml-auto rounded border border-amber-400/40 bg-amber-400/10 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-wide text-amber-300">
                  demo
                </span>
              </Link>
            </div>
          ) : (
            <div className="mt-1">
              <Link
                href="/campus"
                title="Verify your student or alumni affiliation to access Your Campus — verification is free."
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 transition hover:bg-card-raised hover:text-zinc-300"
              >
                <Lock className="h-[18px] w-[18px] text-zinc-600" /> Your Campus
                <span className="ml-auto rounded border border-line px-1 py-px font-mono text-[8px] font-bold uppercase tracking-wide text-zinc-600">
                  Verify to unlock
                </span>
              </Link>
            </div>
          )
        ) : null}
      </nav>

      {/* Your Account — the plan card gets the prime real estate */}
      <div>
        <p className="px-3 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Your account
        </p>
        {plan === "business_pro" || plan === "agency" ? (
          <div className="relative overflow-hidden rounded-2xl border border-sky-400/30 bg-gradient-to-b from-sky-400/10 to-card p-4">
            <p className="text-sm font-bold text-sky-300">{plan === "agency" ? "Agency / Enterprise ✓" : "Business Pro ✓"}</p>
            <p className="mt-0.5 text-xs text-zinc-400">Recruiting tools active · Business World unlocked</p>
            <Link href="/pro" className="btn-ghost mt-3 flex w-full border-sky-400/40 py-1.5 text-xs text-sky-300">
              Manage Subscription →
            </Link>
          </div>
        ) : plan === "pro" ? (
          <div className="relative overflow-hidden rounded-2xl border border-lime-400/25 bg-gradient-to-b from-lime-400/10 to-card p-4">
            <Sparkles className="absolute -right-3 -top-3 h-16 w-16 text-lime-400/10" />
            <p className="text-sm font-bold text-lime-300">✦ Mavyn Pro ✓</p>
            <p className="mt-0.5 text-xs text-zinc-400">Your Pro membership is active</p>
            {campus && (
              <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-violet-300">
                <GraduationCap className="h-3 w-3" /> Verified {campus.affiliation === "alumni" ? "Alumni" : "Student"} — {campus.name.replace(" University", "")}
              </p>
            )}
            <ul className="mt-2 space-y-0.5 text-[10px] text-zinc-500">
              <li>Priority exposure · Advanced analytics</li>
              <li>Premium profile & creator tools</li>
            </ul>
            <Link href="/pro" className="btn-ghost mt-3 flex w-full border-lime-400/40 py-1.5 text-xs text-lime-300">
              Manage Subscription →
            </Link>
          </div>
        ) : plan === "college" ? (
          <div className="relative overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-b from-violet-400/10 to-card p-4">
            <p className="text-sm font-bold text-violet-300">Mavyn College+ ✓</p>
            {campus ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-violet-300">
                <GraduationCap className="h-3.5 w-3.5" /> Verified {campus.affiliation === "alumni" ? "Alumni" : "Student"} — {campus.name.replace(" University", "")}
              </p>
            ) : (
              <Link href="/pro" className="mt-0.5 block text-xs font-semibold text-amber-300 hover:text-amber-200">
                Not verified yet — verify free to activate Student Boost →
              </Link>
            )}
            <p className="mt-1 text-[10px] text-zinc-500">
              College+ benefits active{campus ? " · Student Boost on" : ""}
            </p>
            <Link href="/pro" className="btn-ghost mt-3 flex w-full border-violet-400/40 py-1.5 text-xs text-violet-300">
              Manage Subscription →
            </Link>
            <Link href="/pro" className="mt-2 block text-center text-[10px] font-semibold text-lime-400 hover:text-lime-300">
              Want the full professional experience? Upgrade to Pro anytime →
            </Link>
          </div>
        ) : campus ? (
          /* Free plan + VERIFIED identity — two separate facts, shown separately:
             the identity badge (permanent) and the subscription (not active) */
          <div className="relative overflow-hidden rounded-2xl border border-line bg-card p-4">
            <p className="text-sm font-bold text-zinc-100">Free Plan</p>
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-violet-300">
              <GraduationCap className="h-3.5 w-3.5" /> Verified {campus.affiliation === "alumni" ? "Alumni" : campus.affiliation === "faculty_staff" ? "Faculty / Staff" : "Student"} ✓
            </p>
            <p className="text-[10px] text-zinc-500">{campus.name}</p>
            <Link href="/pro" className="btn-ghost mt-3 flex w-full py-1.5 text-xs">
              Manage Account →
            </Link>
            {campus.affiliation === "alumni" ? (
              /* alumni are never sold the student plan — Alumni Pro is the
                 permanent loyalty rate, and staying free is always fine */
              <div className="mt-2 border-t border-line-soft pt-2">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                  Alumni Pro — your rate
                </p>
                <Link
                  href="/pro"
                  className="mt-1.5 flex w-full items-center justify-center rounded-md bg-lime-400/15 py-1.5 text-[11px] font-bold text-lime-300 transition hover:bg-lime-400/25"
                >
                  Upgrade to Alumni Pro — ${ALUMNI_PRO_PRICE}/mo
                </Link>
              </div>
            ) : campus.affiliation !== "faculty_staff" ? (
              <div className="mt-2 border-t border-line-soft pt-2">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                  College+ — Not Active
                </p>
                <Link
                  href="/pro?intent=college"
                  className="mt-1.5 flex w-full items-center justify-center rounded-md bg-violet-400/15 py-1.5 text-[11px] font-bold text-violet-300 transition hover:bg-violet-400/25"
                >
                  Add College+ — ${COLLEGE_PRICE}/mo
                </Link>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-line bg-card p-4">
            <p className="text-sm font-bold text-zinc-100">Mavyn</p>
            <p className="mt-0.5 text-xs text-zinc-500">Free Plan</p>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
              Unlock creator tools and greater reach.
            </p>
            <Link href="/plans" className="btn-lime mt-3 flex w-full py-1.5 text-xs">
              View Plans →
            </Link>
            <Link href="/pro" className="mt-2 block text-center text-[10px] font-semibold text-violet-400 hover:text-violet-300">
              Student? Verification is free →
            </Link>
          </div>
        )}
      </div>

      {/* Profile — the authenticated user, never a hardcoded person */}
      {user === undefined ? (
        /* auth initializing — never flash the guest card at a signed-in user */
        <div className="card h-16 animate-pulse" aria-hidden />
      ) : user ? (
        <Link
          href="/profile"
          data-tour="profile"
          className="card flex items-center gap-3 p-3 transition hover:border-zinc-600"
        >
          <Avatar src={user.profile.avatarUrl} initials={user.profile.displayName.charAt(0)} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-zinc-100">
              {user.profile.displayName}
            </span>
            <span className="block truncate text-xs text-zinc-500">@{user.handle}</span>
          </span>
          <span className="ml-auto h-2 w-2 rounded-full bg-lime-400" title="Online" />
        </Link>
      ) : (
        <div className="card space-y-2 p-4">
          <p className="text-sm font-bold text-zinc-100">New here?</p>
          <p className="text-xs leading-relaxed text-zinc-500">
            You&apos;re browsing as a guest. Join free to follow, save, message, book, and apply.
          </p>
          <Link href="/signup" className="btn-lime w-full justify-center py-2 text-xs">Create free account</Link>
          <Link href="/login" className="btn-ghost w-full justify-center py-2 text-xs">Sign in</Link>
        </div>
      )}
    </aside>
  );
}
