"use client";

/* ------------------------------------------------------------------ */
/*  Public service page — the shareable booking link.                  */
/*  /services/<id> is what a stylist drops in their bio or a client    */
/*  forwards to a friend. Guests see everything public: price, menu,   */
/*  availability, policies, reviews, verification. The account ask     */
/*  happens at BOOK — after they've seen the work. Members' CTA        */
/*  resumes the real wizard on /services (?book= / ?hire=).            */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import AvailabilityStrip from "@/components/AvailabilityStrip";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Star, Lock, Link2, Check, CalendarDays, Zap, BadgeCheck } from "lucide-react";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useSession } from "@/lib/session";
import { promptJoin } from "@/components/GuestGate";
import {
  policyLines,
  travelLabel,
  availabilityLabel,
  priceLabel,
  LOCATION_LABEL,
  type ServiceConfig,
} from "@/lib/servicePolicies";

interface ServiceDetail {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  fulfillment: string;
  cta: string;
  reach: string;
  paused: boolean;
  media: string[];
  config: ServiceConfig;
  travelEstimate: number;
  travelNote: string | null;
  distanceMi: number | null;
  owner: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    verified: boolean;
    roleLine: string;
    locationLabel?: string | null;
  };
  ownerStats: {
    rating: number | null;
    reviewsCount: number;
    completedBookings: number;
    completedProjects: number;
    identityVerified: boolean;
    businessVerified: boolean;
  };
  recentReviews: { rating: number; body: string; createdAt: string }[];
  isMine: boolean;
  deactivated?: boolean;
  visibility?: string;
}

export default function ServicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useSession();
  const [svc, setSvc] = useState<ServiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/services/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) setError(d.error || "Not found");
        else setSvc(d.service);
      })
      .catch(() => setError("Network error"));
  }, [id]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const book = () => {
    if (!svc) return;
    // the date picked on the calendar RIDES ALONG — never selected twice
    const dateQ = svc.fulfillment === "appointment" && pickedDate ? `&date=${pickedDate}` : "";
    const resume = `/services?${svc.fulfillment === "appointment" ? "book" : "hire"}=${svc.id}${dateQ}`;
    if (me === null) {
      promptJoin(svc.fulfillment === "appointment" ? "book" : "hire", resume);
      return;
    }
    router.push(resume);
  };

  if (error)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm font-semibold text-zinc-200">{error}</p>
        <Link href="/services" className="btn-ghost mt-4 inline-flex px-4 py-1.5 text-xs">Browse services</Link>
      </div>
    );
  if (!svc) return <div className="card-money mx-auto h-64 max-w-2xl animate-pulse" aria-hidden />;

  const menu = svc.config.menu;
  const s = svc.ownerStats;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/services" className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="h-3.5 w-3.5" /> Services
      </Link>

      <article className="card-money p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 capitalize">
              {svc.category} · {svc.fulfillment === "appointment" ? "Appointment" : svc.fulfillment === "quote" ? "Quote" : "Project"}
              {svc.paused && <span className="ml-2 text-amber-300">· Paused</span>}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">{svc.title}</h1>
            <p className="mt-0.5 font-mono text-lg font-medium tracking-[0.08em] text-lime-300">
              {priceLabel(svc.config, svc.price)}
            </p>
          </div>
          <button onClick={share} className="btn-ghost shrink-0 px-3 py-1.5 text-xs" title="Copy link — anyone can view it, no account needed">
            {copied ? <Check className="h-3.5 w-3.5 text-lime-300" /> : <Link2 className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Share"}
          </button>
        </div>

        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-300">{svc.description}</p>

        {svc.media.length > 0 && (
          <div className="mt-4 flex gap-2">
            {svc.media.map((m, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={m} alt={`Work example ${i + 1}`} className="h-24 w-24 rounded-xl border border-line object-cover sm:h-28 sm:w-28" />
            ))}
          </div>
        )}

        {/* the creator's own menu — public, so shared links sell the range */}
        {menu && (menu.packages.length > 0 || menu.addons.length > 0) && (
          <div className="mt-4 rounded-xl border border-line bg-card-raised/50 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Menu</p>
            <ul className="mt-1.5 space-y-1 text-xs">
              {menu.packages.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="text-zinc-200">{p.name}</span>
                  <span className="font-mono tracking-[0.08em] text-lime-300">${p.price}</span>
                </li>
              ))}
              {menu.addons.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span className="text-zinc-400">
                    {a.name}
                    {a.timeMin > 0 ? <span className="text-zinc-600"> · +{a.timeMin} min</span> : null}
                  </span>
                  <span className="font-mono tracking-[0.08em] text-zinc-300">
                    {a.priceMode === "quote" ? "Quote" : a.priceMode === "starting" ? `from $${a.price}` : `+$${a.price}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* availability + location + policies — disclosed before any ask */}
        <div className="mt-4 space-y-1 text-[11px] text-zinc-500">
          {svc.fulfillment === "appointment" && (
            <p className="flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3" /> {availabilityLabel(svc.config.scheduling)}
              {svc.config.scheduling.maxPerDay ? ` · max ${svc.config.scheduling.maxPerDay}/day` : ""}
            </p>
          )}
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3" /> {LOCATION_LABEL[svc.config.locationMode]} · {travelLabel(svc.config.travel)} · {svc.reach}
          </p>
          {policyLines(svc.config).map((l) => (
            <p key={l} className="flex items-center gap-1.5">
              <span className="h-1 w-1 shrink-0 rounded-full bg-zinc-600" /> {l}
            </p>
          ))}
        </div>

        {/* the provider — verification badges + computed track record */}
        <div className="mt-5 rounded-xl border border-line bg-card-raised/50 p-3.5">
          <div className="flex items-center gap-3">
            <Link href={`/creator/${svc.owner.handle}`}>
              <Avatar src={svc.owner.avatarUrl} initials={svc.owner.displayName.charAt(0)} size="md" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/creator/${svc.owner.handle}`} className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-zinc-100 hover:text-violet-300">
                {svc.owner.displayName}
                {svc.owner.verified && <VerifiedBadge className="h-3.5 w-3.5" />}
              </Link>
              <p className="truncate text-xs text-zinc-500">
                {svc.owner.roleLine}
                {svc.owner.locationLabel ? ` · ${svc.owner.locationLabel}` : ""}
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line-soft pt-2.5 text-[11px] text-zinc-400">
            {s.rating != null && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {s.rating.toFixed(1)} · {s.reviewsCount} review{s.reviewsCount === 1 ? "" : "s"}
              </span>
            )}
            {s.completedBookings + s.completedProjects > 0 && (
              <span>{s.completedBookings + s.completedProjects} completed on Mavyn</span>
            )}
            {s.identityVerified && (
              <span className="inline-flex items-center gap-1 text-lime-300">
                <BadgeCheck className="h-3 w-3" /> Identity Verified
              </span>
            )}
            {s.businessVerified && (
              <span className="inline-flex items-center gap-1 text-sky-300">
                <BadgeCheck className="h-3 w-3" /> Business Verified
              </span>
            )}
          </div>
          {svc.recentReviews.length > 0 && (
            <ul className="mt-2.5 space-y-1.5">
              {svc.recentReviews.map((r, i) => (
                <li key={i} className="text-[11px] leading-relaxed text-zinc-500">
                  <span className="text-amber-300">{"★".repeat(r.rating)}</span> &quot;{r.body}&quot;
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* THE HONEST CALENDAR — the future is visible, each state explains
            itself: available · limited · preferred-first · not released yet ·
            closed · fully booked. Click any date for the why. */}
        {svc.fulfillment === "appointment" && !svc.deactivated && (
          <div className="mt-5 border-t border-dashed border-line pt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Booking availability — next 6 weeks</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">Pick a date here — you&apos;ll choose the time next, without selecting the date again.</p>
            <div className="mt-2">
              <AvailabilityStrip serviceId={svc.id} onSelectDate={setPickedDate} selectedDate={pickedDate} />
            </div>
          </div>
        )}

        {/* CTA — the conversion moment comes AFTER they've seen everything */}
        <div className="mt-5 border-t border-dashed border-line pt-4">
          {svc.deactivated ? (
            <p className="rounded-xl border border-line px-4 py-2.5 text-center text-sm text-zinc-500">
              This service is no longer offered — kept as part of {svc.owner.displayName.split(" ")[0]}&apos;s history.
            </p>
          ) : svc.isMine ? (
            <Link href="/profile/edit" className="btn-ghost w-full justify-center py-2.5 text-sm">Manage this listing</Link>
          ) : svc.paused ? (
            <p className="rounded-xl border border-line px-4 py-2.5 text-center text-sm text-zinc-500">
              This service is paused right now.
            </p>
          ) : (
            <>
              <button onClick={book} className="btn-lime w-full justify-center py-2.5 text-sm">
                {svc.fulfillment === "appointment" ? <CalendarDays className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                {svc.fulfillment === "appointment" && pickedDate
                  ? `Book ${new Date(pickedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} — pick a time`
                  : svc.cta}
              </button>
              {me === null && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
                  <Lock className="h-3 w-3" /> Create a free account to book — bookings, payments, and messages in one place.
                </p>
              )}
            </>
          )}
        </div>
      </article>
    </div>
  );
}
