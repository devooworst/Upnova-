"use client";

import { useState } from "react";
import { LayoutGrid, Briefcase, Info } from "lucide-react";
import PortfolioTab from "./PortfolioTab";
import OpportunitiesTab from "./OpportunitiesTab";
import AboutTab from "./AboutTab";

const tabs = [
  { id: "portfolio", label: "Portfolio", icon: LayoutGrid },
  { id: "opportunities", label: "Opportunities", icon: Briefcase },
  { id: "about", label: "About", icon: Info },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function ProfileTabs({ isOwner }: { isOwner: boolean }) {
  const [tab, setTab] = useState<TabId>("portfolio");

  return (
    <section className="card">
      <div className="flex border-b border-line" role="tablist" aria-label="Profile sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex flex-1 items-center justify-center gap-2 px-3 py-3.5 text-sm font-semibold transition ${
              tab === t.id ? "text-zinc-50" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-white" />
            )}
          </button>
        ))}
      </div>
      <div className="p-4 sm:p-5">
        {tab === "portfolio" && <PortfolioTab isOwner={isOwner} />}
        {tab === "opportunities" && <OpportunitiesTab isOwner={isOwner} />}
        {tab === "about" && <AboutTab isOwner={isOwner} />}
      </div>
    </section>
  );
}
