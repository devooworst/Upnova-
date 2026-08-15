import { redirect } from "next/navigation";
import { findCommunity } from "@/lib/server/communities";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/*  /campus/[org] — RETIRED as a separate page.                        */
/*                                                                     */
/*  Organizations are campus communities — another type of community,  */
/*  not a separate product (one membership, posting, and moderation    */
/*  system). An org slug that resolves to a real community redirects   */
/*  to its real home at /communities/[slug]; anything else (including  */
/*  the old demo org ids that never had real records) lands on the     */
/*  campus Organizations door.                                         */
/* ------------------------------------------------------------------ */

export default async function CampusOrgRedirect({ params }: { params: { org: string } }) {
  const community = await findCommunity(params.org);
  if (community) redirect(`/communities/${community.slug}`);
  redirect("/campus");
}
