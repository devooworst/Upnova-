/* CTA wording follows the listing's fulfillment configuration — one
   derivation, used by every surface that renders a service button. */

export function ctaFor(s: { fulfillment: string; category: string; price: number }): string {
  if (s.fulfillment === "quote") return "Request Quote";
  if (s.fulfillment === "appointment") {
    if (["care", "beauty"].includes(s.category)) return "Book Appointment";
    if (["photography", "education"].includes(s.category)) return "Book Session";
    return "Book Time"; // studio / production / events
  }
  if (s.price >= 500) return "Request Quote"; // pricing needs a conversation
  if (["music", "creative"].includes(s.category) && s.price <= 250) return "Book Me"; // fixed creative
  return "Request Project";
}
