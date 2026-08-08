/* ------------------------------------------------------------------ */
/* Notifications — the central activity inbox.                         */
/* One rule above all: every notification has a specific source and a  */
/* specific destination. No "someone interacted with your content" →   */
/* Home. Project offer → that project's conversation. Message from     */
/* Marcus → Marcus's thread. Mention in Music Producers → that         */
/* community. Repetitive social activity is grouped, never spammed.    */
/* ------------------------------------------------------------------ */

export type NotificationCategory =
  | "work" | "message" | "community" | "campus" | "payment" | "activity";

export type NotificationPriority = "high" | "normal" | "low";

export interface UpNotification {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  time: string;
  day: "today" | "yesterday" | "earlier";
  /** the meaningful place this takes you — always specific */
  href: string;
  /** CTA label for high-priority items */
  action?: string;
}

export const categoryInfo: Record<NotificationCategory, { label: string; color: string }> = {
  work: { label: "Work", color: "text-lime-400" },
  payment: { label: "Payment", color: "text-lime-400" },
  message: { label: "Message", color: "text-violet-400" },
  community: { label: "Community", color: "text-violet-400" },
  campus: { label: "Campus", color: "text-violet-400" },
  activity: { label: "Activity", color: "text-zinc-500" },
};

export const notifications: UpNotification[] = [
  {
    id: "n1",
    category: "work",
    priority: "high",
    title: "Ava Chen accepted your project offer",
    body: "Event Photography · Aug 22 · Baltimore, MD · $250",
    time: "2 min ago",
    day: "today",
    href: "/messages?to=ava",
    action: "Review project",
  },
  {
    id: "n2",
    category: "work",
    priority: "high",
    title: "Extension requested",
    body: "Ava Chen requested +2 days · new proposed deadline Aug 24",
    time: "14 min ago",
    day: "today",
    href: "/messages?to=ava",
    action: "Review request",
  },
  {
    id: "n3",
    category: "message",
    priority: "normal",
    title: "Marcus Reed",
    body: "\u201cSend me the raw footage and I\u2019ll take a look.\u201d",
    time: "1 hr ago",
    day: "today",
    href: "/messages?to=marcus",
  },
  {
    id: "n4",
    category: "payment",
    priority: "high",
    title: "Booking confirmed — payment secured",
    body: "Mixing session with Maya Reyes · Aug 9 · $200 held until approval",
    time: "2 hr ago",
    day: "today",
    href: "/calendar",
    action: "View booking",
  },
  {
    id: "n5",
    category: "community",
    priority: "normal",
    title: "You were mentioned in Music Producers",
    body: "Jordan Miles: \u201c@devin has the cleanest low end in the DMV\u201d",
    time: "3 hr ago",
    day: "today",
    href: "/communities/music-producers",
  },
  {
    id: "n6",
    category: "work",
    priority: "high",
    title: "Application update",
    body: "Your application for Nike Fall Campaign has been viewed",
    time: "5 hr ago",
    day: "today",
    href: "/opportunities",
    action: "View application",
  },
  {
    id: "n7",
    category: "campus",
    priority: "normal",
    title: "BSU Photography Club posted an opportunity",
    body: "Org Promo Videographer · $150 · campus",
    time: "Yesterday",
    day: "yesterday",
    href: "/campus/photo-club",
  },
  {
    id: "n8",
    category: "activity",
    priority: "low",
    title: "Jordan, Marcus, Ava and 12 others liked your post",
    body: "\u201cLate nights in the studio hit different\u2026\u201d",
    time: "Yesterday",
    day: "yesterday",
    href: "/profile",
  },
  {
    id: "n9",
    category: "activity",
    priority: "low",
    title: "Lena Ortiz followed you",
    body: "Graphic Designer · Remote",
    time: "Yesterday",
    day: "yesterday",
    href: "/creator/lena",
  },
  {
    id: "n10",
    category: "campus",
    priority: "normal",
    title: "Campus event reminder",
    body: "UpNova Creator Meetup · Sat Aug 22 · 7:00 PM · you\u2019re going",
    time: "2 days ago",
    day: "earlier",
    href: "/events/meetup",
  },
  {
    id: "n11",
    category: "payment",
    priority: "normal",
    title: "Payout released",
    body: "Loop kit license · K. Boateng · $150 on the way",
    time: "3 days ago",
    day: "earlier",
    href: "/settings",
  },
  {
    id: "n12",
    category: "community",
    priority: "normal",
    title: "Maya replied to your post in Photographers",
    body: "\u201cThat golden hour spot is behind the library, right?\u201d",
    time: "4 days ago",
    day: "earlier",
    href: "/communities/photographers",
  },
];

/* ---- read state (localStorage until real backend) ---- */

export const NOTIF_EVENT = "upnova:notifications-changed";
const KEY = "upnova-notif-read";

export function getReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function markRead(id: string) {
  const read = getReadIds();
  read.add(id);
  window.localStorage.setItem(KEY, JSON.stringify(Array.from(read)));
  window.dispatchEvent(new Event(NOTIF_EVENT));
}

export function markAllRead() {
  window.localStorage.setItem(KEY, JSON.stringify(notifications.map((n) => n.id)));
  window.dispatchEvent(new Event(NOTIF_EVENT));
}
