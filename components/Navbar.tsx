"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  MessageSquare,
  Bell,
  ChevronDown,
  User,
  Bookmark,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import Avatar from "./Avatar";
import { currentUser } from "@/lib/data";
import { openCreateModal } from "./CreateModalTrigger";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-3 sm:gap-4 sm:px-4 lg:px-6">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-1.5" aria-label="UpNova home">
          <span className="text-xl leading-none text-lime-400" aria-hidden>
            ✦
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-zinc-50">
            UpNova
          </span>
        </Link>

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
          <button onClick={() => openCreateModal()} className="btn-lime hidden md:inline-flex">
            <Plus className="h-4 w-4" />
            Create
          </button>

          <Link href="/messages" className="icon-btn relative hidden sm:inline-flex" aria-label="Messages">
            <MessageSquare className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-violet-400" />
          </Link>

          <button className="icon-btn relative" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-400 animate-pulse-dot" />
          </button>

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full p-1 pr-2 transition hover:bg-card-raised"
              aria-expanded={menuOpen}
              aria-label="Profile menu"
            >
              <Avatar src={currentUser.avatar} initials={currentUser.initials} size="sm" />
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
                    <Avatar src={currentUser.avatar} initials={currentUser.initials} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-100">
                        {currentUser.name}
                      </p>
                      <p className="truncate text-xs text-zinc-500">@{currentUser.handle}</p>
                    </div>
                  </div>
                  <nav className="p-1.5 text-sm">
                    {[
                      { href: "/profile", icon: User, label: "View Profile" },
                      { href: "/bookmarks", icon: Bookmark, label: "Bookmarks" },
                      { href: "/analytics", icon: BarChart3, label: "Analytics" },
                      { href: "#", icon: Settings, label: "Settings" },
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
                    <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-red-400 transition hover:bg-red-500/10">
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </nav>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
