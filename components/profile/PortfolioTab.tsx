import Image from "next/image";
import { ExternalLink, Plus } from "lucide-react";
import { portfolio } from "@/lib/data";

export default function PortfolioTab() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          <span className="font-semibold text-zinc-200">Show me what you can do.</span> Completed
          work, client projects, and published releases.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {portfolio.map((p) => (
          <article key={p.id} className="card group overflow-hidden transition hover:border-zinc-600">
            <div className="relative aspect-[4/3] overflow-hidden">
              {p.thumbnail ? (
                <Image
                  src={p.thumbnail}
                  alt={p.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
                  className="object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <div className={`flex h-full items-center justify-center bg-gradient-to-br text-5xl ${p.gradient}`}>
                  {p.emoji}
                </div>
              )}
              <span
                className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur ${
                  p.status === "Published"
                    ? "bg-lime-400/90 text-zinc-950"
                    : "bg-black/60 text-lime-300"
                }`}
              >
                {p.status}
              </span>
            </div>
            <div className="p-4">
              <h3 className="font-display text-sm font-bold text-zinc-50">{p.title}</h3>
              <dl className="mt-2 space-y-1 text-xs text-zinc-500">
                <div className="flex justify-between gap-2">
                  <dt>Client</dt>
                  <dd className="font-medium text-zinc-300">{p.client}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Role</dt>
                  <dd className="font-medium text-zinc-300">{p.role}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Type</dt>
                  <dd className="font-medium text-zinc-300">{p.type}</dd>
                </div>
              </dl>
              <button className="btn-ghost mt-3 w-full py-1.5 text-xs">
                <ExternalLink className="h-3.5 w-3.5" />
                View Project
              </button>
            </div>
          </article>
        ))}

        {/* add project */}
        <button className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-zinc-500 transition hover:border-lime-400/40 hover:text-lime-300">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card-raised">
            <Plus className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium">Add Project</span>
        </button>
      </div>
    </div>
  );
}
