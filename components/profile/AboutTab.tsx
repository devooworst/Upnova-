"use client";

import { Mail, MapPin, Clock, Zap, Globe2, Check } from "lucide-react";
import { currentUser, experience, services, contact } from "@/lib/data";

export default function AboutTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* left column: bio + experience + contact */}
      <div className="space-y-4 lg:col-span-2">
        <section className="card p-5">
          <h3 className="text-sm font-bold text-zinc-100">About Me</h3>
          <p className="mt-2.5 text-sm leading-relaxed text-zinc-300">{currentUser.bio}</p>
          <p className="mt-2.5 text-sm leading-relaxed text-zinc-400">
            I&apos;m a music producer, content creator, and entrepreneur focused on helping creators
            grow through opportunities, collaborations, and networking.
          </p>
        </section>

        <section className="card p-5">
          <h3 className="text-sm font-bold text-zinc-100">Experience</h3>
          <ol className="mt-4 space-y-4 border-l border-line pl-4">
            {experience.map((e) => (
              <li key={e.title} className="relative">
                <span className="absolute -left-[23px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-card bg-lime-400" />
                <p className="text-sm font-semibold text-zinc-100">
                  {e.emoji} {e.title}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{e.years}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{e.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="card p-5">
          <h3 className="text-sm font-bold text-zinc-100">Contact</h3>
          <ul className="mt-3 space-y-2.5 text-sm text-zinc-300">
            <li className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-lime-400" /> {contact.email}
            </li>
            <li className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 text-lime-400" /> {contact.location}
            </li>
            <li className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-lime-400" /> {contact.responseTime}
            </li>
          </ul>
        </section>
      </div>

      {/* right column: services */}
      <div className="lg:col-span-3">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-100">Services</h3>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/10 px-2.5 py-1 text-[11px] font-bold text-lime-300">
              <Check className="h-3 w-3" /> Accepting Clients
            </span>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            Hire me directly — agree on scope in messages, pay securely on UpNova.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <article
                key={s.id}
                className="flex flex-col rounded-2xl border border-line bg-card-raised p-4 transition hover:border-lime-400/40"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-400/10 text-lg">
                    {s.emoji}
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-100">{s.title}</h4>
                    <p className="text-xs text-zinc-500">
                      Starting at{" "}
                      <span className="font-bold text-lime-400">${s.startingAt}</span>
                    </p>
                  </div>
                </div>
                <p className="mt-2.5 flex-1 text-xs leading-relaxed text-zinc-400">{s.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-1 text-zinc-400">
                    <Check className="h-3 w-3 text-lime-400" /> {s.availability}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-1 text-zinc-400">
                    <Globe2 className="h-3 w-3 text-lime-400" /> {s.reach}
                  </span>
                </div>
                <a href="/messages" className="btn-lime mt-3 w-full py-1.5 text-xs">
                  <Zap className="h-3.5 w-3.5" />
                  Hire Me
                </a>
              </article>
            ))}
          </div>

          {/* money flow hint */}
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
        </section>
      </div>
    </div>
  );
}
