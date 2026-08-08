import { Users } from "lucide-react";
import CommunityCard from "@/components/CommunityCard";
import { communities } from "@/lib/data";

export const metadata = { title: "Communities" };

export default function CommunitiesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="px-1">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
            <Users className="h-5 w-5 text-lime-400" />
          </span>
          Communities
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Find your people — local communities for creators, built around where you are.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {communities.map((c) => (
          <CommunityCard key={c.id} community={c} />
        ))}
      </div>
    </div>
  );
}
