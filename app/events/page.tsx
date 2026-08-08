import { Calendar } from "lucide-react";
import EventCard from "@/components/EventCard";
import { events } from "@/lib/data";

export const metadata = { title: "Events" };

export default function EventsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="px-1">
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight text-zinc-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400/10">
            <Calendar className="h-5 w-5 text-lime-400" />
          </span>
          Events
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          What&apos;s happening around you — filtered by your location and each event&apos;s reach.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {events.map((e) => (
          <EventCard key={e.id} id={e.id} />
        ))}
      </div>
    </div>
  );
}
