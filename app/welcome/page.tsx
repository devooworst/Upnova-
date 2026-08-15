import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  /welcome — RETIRED as a separate landing page.                     */
/*                                                                     */
/*  Guest Mode is the REAL application, read-only: the same layout,    */
/*  navigation, feed, search, Discover, profiles, opportunities, and   */
/*  services an authenticated user sees — with participation gated     */
/*  behind contextual Sign Up / Sign In prompts (GuestGate).           */
/*                                                                     */
/*  Old links and the previous logout destination land here; send      */
/*  everyone — guest or member — into the actual app. No loop:         */
/*  "/" never redirects anywhere.                                      */
/* ------------------------------------------------------------------ */

export default function WelcomePage() {
  redirect("/");
}
