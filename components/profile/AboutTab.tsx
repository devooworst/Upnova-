"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mail, MapPin, Clock, Zap, Globe2, Check, Settings2, PencilLine, GraduationCap, Link2 } from "lucide-react";
import { useProfile } from "@/lib/profile";
import { useSession } from "@/lib/session";

interface OwnService {
  id: string;
  title: string;
  description: string;
  price: number;
  reach: string;
  paused: boolean;
}

/**
 * Everything user-controlled here comes from the live profile store — bio,
 * experience, education, links all reflect the database record. Services
 * are the user's real marketplace listings.
 */
export default function AboutTab({ isOwner }: { isOwner: boolean }) {
  const profile = useProfile();
  const { user } = useSession();
  const [services, setServices] = useState<OwnService[]>([]);

  useEffect(() => {
    fetch("/api/services", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) =>
        setServices(
          (d.services ?? [])
            .filter((s: { isMine: boolean }) => s.isMine)
            .filter((s: { paused?: boolean }) => isOwner || !s.paused)
            .map((s: OwnService & { paused?: boolean }) => ({ ...s, paused: !!s.paused }))
        )
      );
  }, [isOwner]);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* left column: bio + experience + education + links + contact */}
      <div className="space-y-4 lg:col-span-2">
        <section className="card p-5">
          <h3 className="text-sm font-bold text-zinc-100">About Me</h3>
          <p className="mt-2.5 text-sm leading-relaxed text-zinc-300">{profile.bio}</p>
        </section>

        <section className="card p-5">
          <h3 className="text-sm font-bold text-zinc-100">Experience</h3>
          <ol className="mt-4 space-y-4 border-l border-line pl-4">
            {profile.experience.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[23px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-card bg-lime-400" />
                <p className="text-sm font-semibold text-zinc-100">
                  {e.position} <span className="font-normal text-zinc-400">— {e.organization}</span>
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  {e.start} — {e.end || "Now"}
                  {e.location ? ` · ${e.location}` : ""}
                </p>
                {e.description && (
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">{e.description}</p>
                )}
              </li>
            ))}
          </ol>
        </section>

        {(isOwner || profile.showEducation) && profile.education.length > 0 && (
          <section className="card p-5">
            <h3 className="text-sm font-bold text-zinc-100">Education</h3>
            <ul className="mt-3 space-y-2.5">
              {profile.education.map((e) => (
                <li key={e.id} className="flex items-start gap-2.5">
                  <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{e.school}</p>
                    <p className="text-xs text-zinc-500">
                      {e.program}
                      {e.gradYear ? ` · Expected ${e.gradYear}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {profile.links.length > 0 && (
          <section className="card p-5">
            <h3 className="text-sm font-bold text-zinc-100">Links</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {profile.links.map((l) => (
                <li key={l.id} className="flex items-center gap-2.5">
                  <Link2 className="h-4 w-4 shrink-0 text-violet-300" />
                  <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-zinc-500">
                    {l.platform}
                  </span>
                  <span className="truncate text-zinc-300">{l.url}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card p-5">
          <h3 className="text-sm font-bold text-zinc-100">Contact</h3>
          <ul className="mt-3 space-y-2.5 text-sm text-zinc-300">
            {isOwner && user && (
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-lime-400" /> {user.email}
              </li>
            )}
            {(isOwner || profile.showLocation) && (
              <li className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-lime-400" /> {profile.city}
                {profile.state ? `, ${profile.state}` : ""} · Serves{" "}
                {profile.serviceArea}
              </li>
            )}
            <li className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-lime-400" /> Response time builds from your real reply
              activity
            </li>
          </ul>
        </section>
      </div>

      {/* right column: services */}
      <div className="lg:col-span-3">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-100">Services</h3>
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/10 px-2.5 py-1 text-[11px] font-bold text-lime-300">
                <Check className="h-3 w-3" /> Accepting Clients
              </span>
              {isOwner && (
                <Link href="/profile/edit" className="btn-ghost px-3 py-1 text-[11px]">
                  <Settings2 className="h-3.5 w-3.5" /> Manage Services
                </Link>
              )}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            {isOwner
              ? "This is what visitors can book. Prices, scope, and availability are yours to change in Edit Profile."
              : "Hire me directly: agree on scope in messages, pay securely on Mavyn."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <article
                key={s.id}
                className={`flex flex-col rounded-2xl border border-line bg-card-raised p-4 transition hover:border-lime-400/40 ${
                  s.paused ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-400/10">
                    <Zap className="h-4 w-4 text-lime-400" />
                  </span>
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
                      {s.title}
                      {s.paused && (
                        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
                          Paused
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-zinc-500">
                      Starting at{" "}
                      <span className="font-bold text-lime-400">${s.price}</span>
                    </p>
                  </div>
                </div>
                <p className="mt-2.5 flex-1 text-xs leading-relaxed text-zinc-400">{s.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-1 text-zinc-400">
                    <Check className="h-3 w-3 text-lime-400" /> {s.paused ? "Paused" : "Accepting clients"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-1 text-zinc-400">
                    <Globe2 className="h-3 w-3 text-lime-400" /> {s.reach}
                  </span>
                </div>
                {isOwner ? (
                  <Link href="/profile/edit" className="btn-ghost mt-3 w-full py-1.5 text-xs">
                    <PencilLine className="h-3.5 w-3.5" />
                    Edit Service
                  </Link>
                ) : (
                  <a href="/services" className="btn-lime mt-3 w-full py-1.5 text-xs">
                    <Zap className="h-3.5 w-3.5" />
                    Book or Request
                  </a>
                )}
              </article>
            ))}
          </div>

          {/* money flow hint — shown to visitors, who can actually hire */}
          {!isOwner && (
          <div className="mt-4 rounded-2xl border border-line-soft bg-ink p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              How hiring works
            </p>
            <ol className="mt-2 grid gap-1.5 text-xs text-zinc-400 sm:grid-cols-2">
              {[
                "View a service",
                "Contact the creator",
                "Discuss the project",
                "Agree on price",
                "Payment is processed",
                "Creator completes work",
                "You approve delivery",
                "Both sides review",
              ].map((step, i) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-[9px] font-bold text-lime-300">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          )}
        </section>
      </div>
    </div>
  );
}
