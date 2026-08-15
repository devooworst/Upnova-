/* ------------------------------------------------------------------ */
/*  Mission briefings — every QA task explains itself.                 */
/*  Pure functions, usable on both client (briefing UI) and server     */
/*  (regression tests verify every task briefs completely).            */
/*                                                                     */
/*  Built from each checkpoint's OWN data (never generic):             */
/*   · role        → who you must be (with a switch action if needed)  */
/*   · title       → the objective (the outcome to make true)          */
/*   · instruction → parsed into WHAT-TO-DO steps (the scenario        */
/*                   authors write them arrow-separated)               */
/*   · expected    → the success condition, in database terms          */
/*                                                                     */
/*  Used by the Test Center's briefing card AND the persona bar's      */
/*  in-app briefing, so the mission travels with the tester.           */
/* ------------------------------------------------------------------ */

export interface MissionBriefing {
  role: string; // testcustomer | testcreator | testbusiness
  roleLabel: string; // CUSTOMER / CREATOR / BUSINESS
  objective: string;
  steps: string[];
  success: string;
  href: string;
}

const ROLE_SHORT: Record<string, string> = {
  testcustomer: "CUSTOMER",
  testcreator: "CREATOR",
  testbusiness: "BUSINESS",
};

/** strip persona preamble from the first instruction segment —
    the briefing's ROLE section already says who you are */
function cleanSegment(seg: string): string {
  return seg
    .replace(/^As TEST (CUSTOMER|CREATOR|BUSINESS),?\s*/i, "")
    .replace(/^Switch to TEST (CUSTOMER|CREATOR|BUSINESS)\s*(\(button below\))?,?\s*/i, "")
    .replace(/^\s*[-·]\s*/, "")
    .trim();
}

export function buildBriefing(step: {
  role: string;
  title: string;
  instruction: string;
  expected: string;
  href: string;
}): MissionBriefing {
  const segments = step.instruction
    .split("→")
    .map((s) => cleanSegment(s))
    .filter((s) => s.length > 0)
    .map((s) => (s.endsWith(".") ? s.slice(0, -1) : s));
  const steps = segments.length > 0 ? segments : [step.instruction];
  steps.push("Return here when finished — the checkpoint verifies automatically");
  return {
    role: step.role,
    roleLabel: ROLE_SHORT[step.role] ?? step.role.toUpperCase(),
    objective: step.title,
    steps,
    success: step.expected,
    href: step.href && step.href !== "#" ? step.href : "/simulation",
  };
}
