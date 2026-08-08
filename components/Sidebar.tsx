"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  Users,
  Briefcase,
  Calendar,
  CalendarCheck,
  ShoppingBag,
  MessageSquare,
  Bookmark,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import { currentUser, communities } from "@/lib/data";
import { getPlan, isStudentVerified, PRO_EVENT, type Plan } from "@/lib/pro";

/* nav grouped by the accent-role system: base → earn (lime) → connect (violet) */
const navGroups: {
  label: string | null;
  dot?: string;
  items: { href: string; label: string; icon: typeof Home; badge?: number }[];
}[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Home", icon: Home },
      { href: "/discover", label: "Discover", icon: Search },
      { href: "/messages", label: "Messages", icon: MessageSquare, badge: 3 },
      { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    ],
  },
  {
    label: "earn",
    dot: "bg-lime-400",
    items: [
      { href: "/opportunities", label: "Opportunities", icon: Briefcase },
      { href: "/services", label: "Services", icon: ShoppingBag },
      { href: "/calendar", label: "Bookings", icon: CalendarCheck },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "connect",
    dot: "bg-violet-400",
    items: [
      { href: "/communities", label: "Communities", icon: Users },
      { href: "/events", label: "Events", icon: Calendar },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const myCommunities = communities.filter((c) => c.joined);
  const [plan, setPlanState] = useState<Plan>("free");
  const [studentVerified, setStudentVerifiedState] = useState(false);

  useEffect(() => {
    const sync = () => {
      setPlanState(getPlan());
      setStudentVerifiedState(isStudentVerified());
    };
    sync();
    window.addEventListener(PRO_EVENT, sync);
    return () => window.removeEventListener(PRO_EVENT, sync);
  }, []);
  const pro = plan === "pro";

  return (
    <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-60 shrink-0 flex-col gap-6 self-start overflow-y-auto pb-6 lg:flex">
      {/* Main nav — unboxed; grouping does the work */}
      <nav className="space-y-5 px-1">
        {navGroups.map((g) => (
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
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
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
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {studentVerified && (
          <div className="mt-1">
            <Link
              href="/campus"
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                pathname.startsWith("/campus")
                  ? "bg-violet-400/15 text-violet-200"
                  : "text-violet-300 hover:bg-violet-400/10"
              }`}
            >
              <span aria-hidden>🎓</span> Your Campus
              <span className="ml-auto truncate font-mono text-[9px] text-zinc-500">Bowie State</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Your communities — people DNA: round card, real photos */}
      <div className="card-people p-3">
        <p className="px-3 pb-2 pt-1 text-[13px] font-bold tracking-tight text-zinc-100">
          Your communities
        </p>
        <ul className="space-y-0.5">
          {myCommunities.map((c) => (
            <li key={c.id}>
              <Link
                href={`/communities/${c.id}`}
                className="flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-card-raised hover:text-zinc-100"
              >
                {c.image ? (
                  <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg">
                    <Image src={c.image} alt="" fill sizes="28px" className="object-cover" />
                  </span>
                ) : (
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br text-sm ${c.gradient}`}
                  >
                    {c.emoji}
                  </span>
                )}
                <span className="truncate">{c.name}</span>
                <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-zinc-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                  {c.online}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* plan card — account upgrade, not a community */}
      {plan === "college" ? (
        <div className="relative overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-b from-violet-400/10 to-card p-4">
          <p className="text-sm font-bold text-violet-300">🎓 UpNova College+ ✓</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Verified Student · Student Boost active.
          </p>
          <Link href="/pro" className="btn-ghost mt-3 flex w-full border-violet-400/40 py-1.5 text-xs text-violet-300">
            Manage Plan
          </Link>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-lime-400/25 bg-gradient-to-b from-lime-400/10 to-card p-4">
          <Sparkles className="absolute -right-3 -top-3 h-16 w-16 text-lime-400/10" />
          <p className="text-sm font-bold text-lime-300">UpNova Pro {pro && "✓"}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            {pro
              ? "Your Pro membership is active."
              : "Advanced analytics, priority applications, and a bigger reach for your work."}
          </p>
          <Link
            href="/pro"
            className={
              pro
                ? "btn-ghost mt-3 flex w-full border-lime-400/40 py-1.5 text-xs text-lime-300"
                : "btn-lime mt-3 flex w-full py-1.5 text-xs"
            }
          >
            {pro ? "Manage Plan" : "Upgrade"}
          </Link>
          {!pro && (
            <Link href="/pro" className="mt-2 block text-center text-[10px] font-semibold text-violet-400 hover:text-violet-300">
              🎓 Student? Verification is free →
            </Link>
          )}
        </div>
      )}

      {/* Profile */}
      <Link
        href="/profile"
        className="card flex items-center gap-3 p-3 transition hover:border-zinc-600"
      >
        <Avatar src={currentUser.avatar} initials={currentUser.initials} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-zinc-100">
            {currentUser.name}
          </span>
          <span className="block truncate text-xs text-zinc-500">@{currentUser.handle}</span>
        </span>
        <span className="ml-auto h-2 w-2 rounded-full bg-violet-400" title="Online" />
      </Link>
    </aside>
  );
}
