import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { getSessionUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "UpNova — Guest Mode",
};

/* ------------------------------------------------------------------ */
/*  GUEST MODE — the public landing.                                   */
/*                                                                     */
/*  Logging out lands HERE, not on a login form. Guests can scroll     */
/*  and browse real public content (same visibility rules the public   */
/*  search API enforces: active accounts, public profiles, open        */
/*  opportunities, public active services) and choose Sign In or       */
/*  Join UpNova from the top navigation whenever they want.            */
/*                                                                     */
/*  No auto-opened forms, no prefilled accounts, nothing hardcoded.    */
/*  A signed-in visitor is sent home (no loop: home sends only         */
/*  GUESTS here, and this page sends only SIGNED-IN users home).       */
/* ------------------------------------------------------------------ */

export default function WelcomePage() {
  // signed-in users don't belong on the guest landing — go home.
  let me = null;
  try {
    me = getSessionUser();
  } catch {
    me = null;
  }
  if (me) redirect("/");

  /* ---- real public data, same rules as /api/search (guests allowed) ---- */
  const creators = db
    .select({ user: tables.users, profile: tables.profiles })
    .from(tables.users)
    .innerJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
    .all()
    .filter((r) => r.user.status === "active" && r.profile.visibility === "public" && r.user.role !== "admin")
    .sort((a, b) => Number(b.profile.verified) - Number(a.profile.verified) || a.user.handle.localeCompare(b.user.handle))
    .slice(0, 8)
    .map((r) => {
      let roles: string[] = [];
      try {
        roles = JSON.parse(r.profile.additionalRoles || "[]");
      } catch {}
      return {
        handle: r.user.handle,
        name: r.profile.displayName,
        avatarUrl: r.profile.avatarUrl,
        roleLine: [r.profile.primaryRole, ...roles].filter(Boolean).slice(0, 2).join(" · "),
        verified: !!r.profile.verified,
      };
    });

  const opportunities = db
    .select()
    .from(tables.opportunities)
    .all()
    .filter((o) => o.status === "open")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 6)
    .map((o) => ({ id: o.id, title: o.title, type: o.type, location: o.remote ? "Remote" : o.location, budget: o.budget }));

  const services = db
    .select()
    .from(tables.services)
    .all()
    .filter((s) => s.active && s.visibility === "public")
    .slice(0, 6)
    .map((s) => {
      const owner = db.select().from(tables.profiles).where(eq(tables.profiles.userId, s.ownerId)).get();
      const ownerUser = db.select().from(tables.users).where(eq(tables.users.id, s.ownerId)).get();
      return { id: s.id, title: s.title, price: s.price, category: s.category, owner: owner?.displayName ?? "", ownerHandle: ownerUser?.handle ?? "" };
    });

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-ink">
      {/* ---- guest top navigation: browse freely, sign in when YOU choose ---- */}
      <header className="sticky top-0 z-10 border-b border-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl leading-none text-lime-400" aria-hidden>✦</span>
            <span className="font-display text-lg font-bold tracking-tight text-zinc-50">UpNova</span>
            <span className="rounded-full border border-line bg-card px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              Guest Mode
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-card-raised">
              Sign In
            </Link>
            <Link href="/signup" className="btn-lime rounded-full px-4 py-1.5 text-xs">
              Join UpNova
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        {/* ---- hero ---- */}
        <section className="pt-12 text-center sm:pt-16">
          <h1 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
            Find what&apos;s happening around you — and the people who can make it happen.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
            Creators, services, opportunities, and communities — browse freely as a guest.
            Join when you&apos;re ready to book, apply, or get hired.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/signup" className="btn-lime rounded-md px-6 py-2.5 text-sm">Join UpNova</Link>
            <Link href="/login" className="rounded-md border border-line px-6 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-card-raised">
              Sign In
            </Link>
          </div>
        </section>

        {/* ---- featured creators: fully public profiles, browsable now ---- */}
        {creators.length > 0 && (
          <section className="mt-14">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-zinc-100">Creators on UpNova</h2>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-600">public profiles — open to browse</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {creators.map((c) => (
                <Link key={c.handle} href={`/creator/${c.handle}`} className="card group p-4 transition hover:border-zinc-600">
                  <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-line bg-card-raised text-sm font-bold text-zinc-400">
                    {c.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      c.name.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <p className="mt-2.5 truncate text-sm font-semibold text-zinc-100 group-hover:text-lime-300">{c.name}</p>
                  <p className="truncate font-mono text-[10px] text-zinc-500">@{c.handle}</p>
                  {c.roleLine && <p className="mt-1 truncate text-[11px] text-zinc-400">{c.roleLine}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ---- open opportunities ---- */}
        {opportunities.length > 0 && (
          <section className="mt-12">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-zinc-100">Open opportunities</h2>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-600">join to apply</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {opportunities.map((o) => (
                <Link key={o.id} href="/signup" className="card group flex items-start justify-between gap-3 p-4 transition hover:border-zinc-600">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-100 group-hover:text-lime-300">{o.title}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                      {o.type}{o.location ? ` · ${o.location}` : ""}
                    </p>
                  </div>
                  {o.budget && <span className="shrink-0 font-mono text-xs font-bold text-lime-300">{o.budget}</span>}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ---- public services ---- */}
        {services.length > 0 && (
          <section className="mt-12">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-zinc-100">Services</h2>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-600">book after you join</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {services.map((s) => (
                <Link key={s.id} href={s.ownerHandle ? `/creator/${s.ownerHandle}` : "/signup"} className="card group p-4 transition hover:border-zinc-600">
                  <p className="truncate text-sm font-semibold text-zinc-100 group-hover:text-lime-300">{s.title}</p>
                  <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-wide text-zinc-500">{s.category}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="truncate text-[11px] text-zinc-400">{s.owner}</span>
                    <span className="font-mono text-xs font-bold text-lime-300">${s.price}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ---- closing CTA ---- */}
        <section className="mt-14 rounded-2xl border border-lime-400/20 bg-lime-400/5 p-8 text-center">
          <h2 className="font-display text-xl font-bold tracking-tight text-zinc-50">Ready to be part of it?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
            Your account, your world — book creators, apply to opportunities, get paid for your work.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link href="/signup" className="btn-lime rounded-md px-6 py-2.5 text-sm">Join UpNova</Link>
            <Link href="/login" className="rounded-md border border-line px-6 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-card-raised">
              Sign In
            </Link>
          </div>
        </section>

        <p className="mt-10 text-center font-mono text-[10px] text-zinc-600">© 2026 UpNova, Baltimore MD</p>
      </main>
    </div>
  );
}
