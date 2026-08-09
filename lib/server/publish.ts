/* ------------------------------------------------------------------ */
/*  Publishing — ONE canonical object, ONE feed presence.              */
/*                                                                     */
/*  Every publishable thing (Service, Opportunity, Product, Work,      */
/*  Event) lives in its own table as the single source of truth. When  */
/*  it's published, this helper creates a LINKED POST (refType/refId)  */
/*  so it flows through the same recommendation-ranked feed and shows  */
/*  on the creator's profile immediately. The post is a pointer with   */
/*  a call-to-action — clicking opens the REAL object to book, apply,  */
/*  buy, or license. No duplicate independent copies, ever.            */
/*  Reusable marketplace machinery: photographers, models, producers,  */
/*  hairstylists, editors, businesses — same function for all of them. */
/* ------------------------------------------------------------------ */

import { randomBytes } from "crypto";
import { db, tables } from "@/db";

export type RefType = "service" | "opportunity" | "product" | "work" | "event";

export const REF_META: Record<RefType, { label: string; cta: string; href: (id: string) => string }> = {
  service: { label: "Service", cta: "Book / Request", href: (id) => `/services/${id}` },
  opportunity: { label: "Opportunity", cta: "Apply", href: (id) => `/opportunities/${id}` },
  product: { label: "Product", cta: "Buy", href: (id) => `/shop/${id}` },
  work: { label: "Work", cta: "License", href: (id) => `/works/${id}` },
  event: { label: "Event", cta: "View Event", href: (id) => `/events/${id}` },
};

export function createLinkedPost(input: {
  userId: string;
  refType: RefType;
  refId: string;
  body: string;
  category?: string;
  imageUrl?: string | null;
}) {
  const id = randomBytes(12).toString("hex");
  db.insert(tables.posts)
    .values({
      id,
      authorId: input.userId,
      body: input.body.slice(0, 500),
      kind: "announcement",
      category: (input.category ?? "").slice(0, 30),
      refType: input.refType,
      refId: input.refId,
      imageUrl: input.imageUrl ?? null,
    })
    .run();
  return id;
}
