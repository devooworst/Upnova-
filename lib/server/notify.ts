/* ------------------------------------------------------------------ */
/*  Notifications — single creation path. Every notification has a     */
/*  specific actor, a category, a priority, and a real destination.    */
/* ------------------------------------------------------------------ */

import { randomBytes } from "crypto";
import { db, tables } from "@/db";

type NotifyInput = {
  userId: string;
  actorId?: string | null;
  type: string;
  title: string;
  body?: string;
  href: string;
  category?: "activity" | "work" | "messages" | "communities" | "campus" | "payments";
  priority?: "high" | "normal" | "low";
};

const CATEGORY_BY_TYPE: Record<string, NotifyInput["category"]> = {
  message: "messages",
  follow: "activity",
  like: "activity",
  project_offer: "work",
  project_accepted: "work",
  extension_requested: "work",
  extension_approved: "work",
  extension_denied: "work",
  project_submitted: "work",
  project_approved: "work",
  application: "work",
  application_shortlisted: "work",
  application_selected: "work",
  payment: "payments",
  community: "communities",
  campus: "campus",
  booking: "work",
};

const PRIORITY_BY_TYPE: Record<string, NotifyInput["priority"]> = {
  project_offer: "high",
  extension_requested: "high",
  payment: "high",
  booking: "high",
  application: "high",
  application_selected: "high",
  message: "normal",
  follow: "low",
  like: "low",
};

export function notify(input: NotifyInput) {
  // never notify yourself
  if (input.actorId && input.actorId === input.userId) return;
  db.insert(tables.notifications)
    .values({
      id: randomBytes(12).toString("hex"),
      userId: input.userId,
      actorId: input.actorId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? "",
      href: input.href,
      category: input.category ?? CATEGORY_BY_TYPE[input.type] ?? "activity",
      priority: input.priority ?? PRIORITY_BY_TYPE[input.type] ?? "normal",
    })
    .run();
}
