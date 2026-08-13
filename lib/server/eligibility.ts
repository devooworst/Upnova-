/* ------------------------------------------------------------------ */
/* Opportunity eligibility — WHO CAN APPLY, decided by the poster.     */
/*                                                                     */
/* VISIBILITY ≠ ELIGIBILITY: every listing is visible to everyone;     */
/* this module answers only "can this viewer APPLY?". Enforced at      */
/* application time (server-side), surfaced as a badge on cards and a  */
/* lock panel on the apply flow.                                       */
/*                                                                     */
/*   anyone     — any Mavyn member                                    */
/*   students   — any verified CURRENT student (any school)            */
/*   my_school  — current students verified at eligibilityCampusId     */
/*   alumni     — verified alumni (of eligibilityCampusId when set)    */
/*                                                                     */
/* DEMO MODE (unrestricted tester) bypasses for testing; SIMULATION    */
/* MODE and production enforce. Plan (Free/College+/Pro) NEVER factors */
/* in — verification is free and sufficient.                           */
/* ------------------------------------------------------------------ */

import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { campusVerification, unrestrictedTester } from "@/lib/server/campus";

export const ELIGIBILITIES = ["anyone", "students", "my_school", "alumni"] as const;
export type Eligibility = (typeof ELIGIBILITIES)[number];

const campusName = async (campusId: string | null) =>
  campusId ? (await db.select().from(tables.campuses).where(eq(tables.campuses.id, campusId)).get())?.name ?? null : null;

/** Short badge label for cards ("Verified students", "Bowie State students"…). */
export async function eligibilityLabel(eligibility: string, eligibilityCampusId: string | null): Promise<string | null> {
  if (eligibility === "students") return "Verified students";
  if (eligibility === "my_school") {
    const name = await campusName(eligibilityCampusId);
    return name ? `${name!.replace(" University", "")} students` : "Verified students";
  }
  if (eligibility === "alumni") {
    const name = await campusName(eligibilityCampusId);
    return name ? `${name.replace(" University", "")} alumni` : "Verified alumni";
  }
  return null;
}

export interface EligibilityCheck {
  eligible: boolean;
  /** why not — a complete, user-facing sentence */
  reason?: string;
  /** true when the block is only "verify (free) first" */
  verifyFixes?: boolean;
  /** true when DEMO MODE opened the gate for testing */
  demoBypass?: boolean;
}

export async function checkApplicantEligibility(
  opp: { eligibility: string; eligibilityCampusId: string | null },
  userId: string
): Promise<EligibilityCheck> {
  if (opp.eligibility === "anyone" || !ELIGIBILITIES.includes(opp.eligibility as Eligibility))
    return { eligible: true };

  const v = await campusVerification(userId);
  const school = await campusName(opp.eligibilityCampusId);

  const verdict = await (async () => {
    if (opp.eligibility === "students") {
      if (!v) return { eligible: false, reason: "Student verification required — this opportunity is limited to verified students. Verify your student affiliation for free to apply.", verifyFixes: true };
      if (v!.affiliation !== "current_student") return { eligible: false, reason: "This opportunity is for current students. Your verified status is " + (v!.affiliation === "alumni" ? "alumni" : "faculty/staff") + " — alumni-open opportunities remain available to you." };
      return { eligible: true };
    }
    if (opp.eligibility === "my_school") {
      if (!v) return { eligible: false, reason: `Student verification required — this opportunity is limited to verified ${school ?? "campus"} students. Verify your student affiliation for free to apply.`, verifyFixes: true };
      if (v!.campusId !== opp.eligibilityCampusId) return { eligible: false, reason: `This opportunity is limited to ${school ?? "a specific school"} students — your verification is at a different school.` };
      if (v!.affiliation !== "current_student") return { eligible: false, reason: `This opportunity is for current ${school ?? ""} students. Your verified status is ${v!.affiliation === "alumni" ? "alumni" : "faculty/staff"}.` };
      return { eligible: true };
    }
    // alumni
    if (!v) return { eligible: false, reason: `Alumni verification required — this opportunity is limited to verified ${school ? school + " " : ""}alumni. Verify your affiliation for free to apply.`, verifyFixes: true };
    if (opp.eligibilityCampusId && v!.campusId !== opp.eligibilityCampusId) return { eligible: false, reason: `This opportunity is limited to ${school} alumni — your verification is at a different school.` };
    if (v!.affiliation !== "alumni") return { eligible: false, reason: "This opportunity is for alumni. Current students can find student opportunities across Mavyn." };
    return { eligible: true };
  })();

  // DEMO MODE: the gate opens for testing — labeled, never silent
  if (!verdict.eligible && (await unrestrictedTester(userId))) return { eligible: true, demoBypass: true };
  return verdict;
}
