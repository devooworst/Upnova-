"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Plus, MessageSquare, User } from "lucide-react";
import { openCreateModal } from "./CreateModalTrigger";
import { promptJoin } from "./GuestGate";
import { useSession } from "@/lib/session";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Search },
  { href: "__create__", label: "Create", icon: Plus },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/profile", label: "Profile", icon: User },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { user } = useSession();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label="Mobile navigation"
      data-guide="mobile-bottom-nav"
    >
      {/* tablets get the same persistent touch nav, just wider */}
      <div className="mx-auto grid max-w-md grid-cols-5 md:max-w-lg">
        {items.map((item) => {
          if (item.href === "__create__") {
            return (
              <button
                key={item.label}
                onClick={() => (user ? openCreateModal() : promptJoin("create"))}
                className="flex min-h-[56px] flex-col items-center justify-center gap-1 py-2"
                aria-label="Create"
                data-guide="mobile-create"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lime-400 text-zinc-950 shadow-glow">
                  <Plus className="h-6 w-6" strokeWidth={2.5} />
                </span>
              </button>
            );
          }
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition ${
                active ? "text-zinc-50" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <item.icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
