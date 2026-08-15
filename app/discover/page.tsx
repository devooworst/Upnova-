import { Suspense } from "react";
import DiscoverClient from "@/components/DiscoverClient";

export const metadata = { title: "Discover" };

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-card" />
          <div className="h-12 w-full animate-pulse rounded-2xl bg-card" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl bg-card" />
            ))}
          </div>
        </div>
      }
    >
      <DiscoverClient />
    </Suspense>
  );
}
