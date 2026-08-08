import { Bookmark } from "lucide-react";
import { bookmarks } from "@/lib/data";

export const metadata = { title: "Bookmarks" };

export default function BookmarksPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="px-1">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
            <Bookmark className="h-5 w-5 text-amber-400" />
          </span>
          Bookmarks
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Everything you&apos;ve saved — opportunities, posts, services, and events.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {bookmarks.map((b) => (
          <article key={b.id} className="card flex items-start gap-3 p-4 transition hover:border-zinc-600">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card-raised text-xl">
              {b.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">{b.kind}</p>
              <h3 className="mt-0.5 truncate text-sm font-semibold text-zinc-100">{b.title}</h3>
              <p className="mt-0.5 truncate text-xs text-zinc-500">{b.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
