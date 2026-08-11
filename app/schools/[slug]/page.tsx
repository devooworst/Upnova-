"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { GraduationCap, Users } from "lucide-react";
import Avatar from "@/components/Avatar";

/* ------------------------------------------------------------------ */
/* School directory — what opens when you tap the school on someone's  */
/* profile: everyone who publicly shows this school, filterable by     */
/* class year ('26, '27, '28…) and affiliation. Members control their  */
/* own visibility (Settings → School & Education): hidden school =     */
/* not listed; hidden year = never filterable by year.                 */
/* ------------------------------------------------------------------ */

interface Person {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  roleLine: string;
  affiliation: string;
  classOf: string | null;
  verified: boolean;
}

export default function SchoolDirectoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const sp = useSearchParams();
  const [data, setData] = useState<{ school: { name: string }; count: number; years: string[]; people: Person[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>(sp.get("year") || "all");

  useEffect(() => {
    fetch(`/api/schools/${slug}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) setError(d.error || "School not found");
        else setData(d);
      })
      .catch(() => setError("Network error"));
  }, [slug]);

  if (error)
    return (
      <div className="mx-auto max-w-md pt-12 text-center">
        <p className="text-sm font-semibold text-zinc-200">{error}</p>
        <p className="mt-1 text-xs text-zinc-500">More schools onboard soon.</p>
      </div>
    );
  if (!data)
    return <div className="mx-auto max-w-3xl pt-10" aria-busy="true"><div className="h-8 w-64 animate-pulse rounded bg-card-raised" /><div className="mt-4 h-40 animate-pulse rounded-xl bg-card-raised" /></div>;

  const visible = data.people.filter((p) => {
    if (filter === "all") return true;
    if (filter === "students") return p.affiliation === "current_student";
    if (filter === "alumni") return p.affiliation === "alumni";
    return p.classOf === filter; // year filters ONLY match visible years
  });

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? "border-violet-400/50 bg-violet-400/10 text-violet-300" : "border-line text-zinc-400 hover:border-zinc-600"}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="pt-2">
        <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-400">
          <GraduationCap className="h-3.5 w-3.5" /> verified school community
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">{data.school.name}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500">
          <Users className="h-4 w-4" /> {data.count} member{data.count === 1 ? "" : "s"} on Mavyn show this school
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter("all")} className={chip(filter === "all")}>All</button>
        <button onClick={() => setFilter("students")} className={chip(filter === "students")}>Students</button>
        <button onClick={() => setFilter("alumni")} className={chip(filter === "alumni")}>Alumni</button>
        {data.years.map((y) => (
          <button key={y} onClick={() => setFilter(filter === y ? "all" : y)} className={chip(filter === y)}>
            Class of {y}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card p-8 text-center text-sm text-zinc-500">Nobody matches this filter — members with a hidden class year only appear under &quot;All&quot;.</div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {visible.map((p) => (
            <li key={p.handle}>
              <Link href={`/creator/${p.handle}`} className="card flex items-center gap-3 p-3.5 transition hover:border-zinc-600">
                <Avatar src={p.avatarUrl} initials={p.displayName.charAt(0)} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-zinc-100">{p.displayName}</span>
                  <span className="block truncate text-xs text-zinc-500">
                    @{p.handle}{p.roleLine ? ` · ${p.roleLine}` : ""}
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 font-mono text-[9px] font-bold text-violet-300">
                  {p.affiliation === "alumni" ? "Alumni" : p.affiliation === "faculty_staff" ? "Faculty" : p.classOf ? `'${p.classOf.slice(2)}` : "Student"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] leading-relaxed text-zinc-600">
        Only members who show their school appear here, and class years only when the member shows
        them — manage yours in Settings → School &amp; Education.
      </p>
    </div>
  );
}
