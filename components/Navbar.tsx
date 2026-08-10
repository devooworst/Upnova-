"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Menu,
  Search,
  Plus,
  MessageSquare,
  Bell,
  ChevronDown,
  User,
  Bookmark,
  BarChart3,
  Settings,
  ShieldCheck,
  Sparkles,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getTheme, setTheme } from "@/lib/theme";
import DbNotificationBell from "./db/DbNotificationBell";
import Avatar from "./Avatar";
import { promptJoin } from "./GuestGate";
import { useSession, logout } from "@/lib/session";
import { openCreateModal } from "./CreateModalTrigger";
import { toggleSidebar } from "@/lib/sidebarStore";
import DemoModeSwitch from "./DemoModeSwitch";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const router = useRouter();
  const { user } = useSession();
  const [lightMode, setLightMode] = useState(false);
  useEffect(() => {
    setLightMode(document.documentElement.classList.contains("light"));
  }, []);
  const flipTheme = () => {
    const next = lightMode ? "dark" : "light";
    setTheme(next);
    setLightMode(!lightMode);
  };
  const plan = user?.plan ?? "free";
  const planLabel = plan === "pro" ? "Pro" : plan === "college" ? "College+" : "Free";

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-3 sm:gap-4 sm:px-4 lg:px-6">
        {/* Sidebar toggle — collapses the column on desktop, opens the
            drawer on mobile. Navigation items are untouched. */}
        <button
          onClick={toggleSidebar}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-card-raised hover:text-zinc-100"
          aria-label="Toggle navigation menu"
          title="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-1.5" aria-label="UpNova home">
          <span className="text-xl leading-none text-lime-400" aria-hidden>
            ✦
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-zinc-50">
            UpNova
          </span>
        </Link>
        {/* DEMO MODE / SIMULATION MODE master switch — outside the logo link */}
        <DemoModeSwitch />

        {/* Desktop search */}
        <div className="relative mx-auto hidden w-full max-w-xl md:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            placeholder="Search creators, opportunities, communities…"
            className="w-full rounded-full border border-line bg-card px-10 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-lime-400/40 focus:ring-2 focus:ring-lime-400/15"
          />
          <kbd className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-card-raised px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 lg:block">
            ⌘K
          </kbd>
        </div>

        {/* Right actions */}
        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0 md:gap-1.5">
          {/* Create stays visible to guests — pressing it explains what an
              account unlocks. Server-side auth is the real gate. */}
          <button onClick={() => (user ? openCreateModal() : promptJoin("create"))} className="btn-lime hidden md:inline-flex">
            <Plus className="h-4 w-4" />
            Create
          </button>

          <Link
            href={user ? "/messages" : "#"}
            onClick={(e) => {
              if (!user) {
                e.preventDefault();
                promptJoin("message");
              }
            }}
            className="icon-btn relative hidden sm:inline-flex"
            aria-label="Messages"
          >
            <MessageSquare className="h-5 w-5" />
          </Link>

          <button
            onClick={flipTheme}
            className="icon-btn hidden sm:inline-flex"
            aria-label={lightMode ? "Switch to dark mode" : "Switch to light mode"}
            title={lightMode ? "Dark mode" : "Light mode"}
          >
            {lightMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>

          <DbNotificationBell />

          {/* Profile dropdown — the real authenticated user, or Sign in */}
          {user === undefined ? (
            /* session still resolving — a quiet placeholder, never a
               premature "Sign in" that flashes at logged-in users */
            <span className="h-8 w-8 animate-pulse rounded-full bg-card-raised" aria-hidden />
          ) : user === null ? (
            <Link href="/login" className="btn-lime px-4 py-1.5 text-xs sm:text-sm">
              Sign in
            </Link>
          ) : (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full p-1 pr-2 transition hover:bg-card-raised"
              aria-expanded={menuOpen}
              aria-label="Profile menu"
            >
              <Avatar src={user.profile.avatarUrl} initials={user.profile.displayName.charAt(0)} size="sm" />
              <ChevronDown
                className={`hidden h-4 w-4 text-zinc-500 transition-transform sm:block ${
                  menuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-card shadow-card animate-fade-up">
                  <div className="flex items-center gap-3 border-b border-line-soft p-4">
                    <Avatar src={user.profile.avatarUrl} initials={user.profile.displayName.charAt(0)} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-100">
                        {user.profile.displayName}
                      </p>
                      <p className="truncate text-xs text-zinc-500">@{user.handle}</p>
                      <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold ${
                        plan === "pro"
                          ? "border-lime-400/40 bg-lime-400/10 text-lime-300"
                          : plan === "college"
                          ? "border-violet-400/40 bg-violet-400/10 text-violet-300"
                          : "border-line text-zinc-400"
                      }`}>
                        UpNova {planLabel}
                      </span>
                    </div>
                  </div>
                  <nav className="p-1.5 text-sm">
                    {[
                      { href: "/profile", icon: User, label: "View Profile" },
                      { href: "/bookmarks", icon: Bookmark, label: "Bookmarks" },
                      { href: "/analytics", icon: BarChart3, label: "Analytics" },
                      { href: "/pro", icon: Sparkles, label: "Your Plan" },
                      { href: "/resolution", icon: ShieldCheck, label: "Resolution Center" },
                      { href: "/settings", icon: Settings, label: "Settings" },
                      ...(user.role === "admin"
                        ? [{ href: "/admin", icon: ShieldCheck, label: "Admin Dashboard" }]
                        : []),
                    ].map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-zinc-300 transition hover:bg-card-raised hover:text-zinc-100"
                      >
                        <item.icon className="h-4 w-4 text-zinc-500" />
                        {item.label}
                      </Link>
                    ))}
                    <div className="my-1.5 h-px bg-line-soft" />
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setLogoutOpen(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-red-400 transition hover:bg-red-500/10"
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </nav>
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Log out confirmation */}
      {logoutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLogoutOpen(false)}
        >
          <div className="card w-full max-w-xs p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-bold tracking-tight text-zinc-50">Log out of UpNova?</p>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              You&apos;ll need to sign back in to access your account. Nothing is deleted — your
              profile, portfolio, messages, and projects stay right here.
            </p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setLogoutOpen(false)} className="btn-ghost flex-1 py-2 text-xs">
                Cancel
              </button>
              <button
                onClick={async () => {
                  setLogoutOpen(false);
                  await logout();
                  router.push("/welcome");
                }}
                className="flex-1 rounded-full bg-red-500 py-2 text-xs font-bold text-white transition hover:bg-red-400"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile search */}
      <div className="px-3 pb-3 md:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            placeholder="Search creators, opportunities, communities…"
            className="w-full rounded-full border border-line bg-card py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-lime-400/40"
          />
        </div>
      </div>
    </header>
  );
}
