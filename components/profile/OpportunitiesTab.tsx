import { Briefcase, ArrowRight } from "lucide-react";
import { profileOpportunities } from "@/lib/data";

const statusStyle: Record<string, string> = {
  "Applied • Under Review": "border-amber-400/40 bg-amber-400/10 text-amber-300",
  Completed: "border-lime-400/40 bg-lime-400/10 text-lime-300",
  Open: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  "Accepting Clients": "border-lime-400/40 bg-lime-400/10 text-lime-300",
};

export default function OpportunitiesTab({ isOwner }: { isOwner: boolean }) {
  const applications = profileOpportunities.filter((o) => o.kind === "application");
  const listings = profileOpportunities.filter((o) => o.kind === "listing");

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        {isOwner ? (
          <>
            <span className="font-semibold text-zinc-200">Your work pipeline.</span> Applications
            you sent, completed projects, and listings you posted.
          </>
        ) : (
          <>
            <span className="font-semibold text-zinc-200">
              Here&apos;s what I&apos;m doing — and what I&apos;m looking for.
            </span>{" "}
            Applications, completed work, and open listings.
          </>
        )}
      </p>

      <section>
        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Work History
        </h3>
        <div className="space-y-2.5">
          {applications.map((o) => (
            <article key={o.id} className="card flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-card-raised text-xl">
                {o.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-zinc-100">{o.title}</h4>
                <p className="mt-0.5 text-xs text-zinc-500">{o.detail}</p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-bold ${statusStyle[o.status]}`}
              >
                {o.status}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Open Listings
        </h3>
        <div className="space-y-2.5">
          {listings.map((o) => (
            <article key={o.id} className="card flex flex-wrap items-center gap-3 p-4 transition hover:border-zinc-600">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-400/10 text-xl">
                {o.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-zinc-100">{o.title}</h4>
                <p className="mt-0.5 text-xs text-zinc-500">{o.detail}</p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-bold ${statusStyle[o.status]}`}
              >
                {o.status}
              </span>
              <button className="btn-ghost px-3 py-1.5 text-xs">
                View <ArrowRight className="h-3 w-3" />
              </button>
            </article>
          ))}
        </div>
      </section>

      {isOwner && (
      <div className="card flex items-center gap-3 border-lime-400/25 bg-lime-400/5 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-400/15">
          <Briefcase className="h-5 w-5 text-lime-400" />
        </span>
        <p className="flex-1 text-sm text-zinc-300">
          Looking for your next gig? Browse opportunities matched to your skills and reach.
        </p>
        <a href="/opportunities" className="btn-lime px-4 py-1.5 text-xs">
          Explore
        </a>
      </div>
      )}
    </div>
  );
}
