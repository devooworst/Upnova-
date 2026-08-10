"use client";

/* ------------------------------------------------------------------ */
/*  QA Lab client helpers — persona switching for the Test Center.     */
/*  Talks to /api/qa/impersonate (demo-only, QA-personas-only) and     */
/*  swaps the local session transport. The signed return token lets    */
/*  the tester come back to their own account with one click.          */
/* ------------------------------------------------------------------ */

import { setFallbackToken, invalidateSession } from "@/lib/session";

export const QA_HANDLES = ["testcustomer", "testcreator", "testbusiness"] as const;
export const QA_LABEL: Record<string, string> = {
  testcustomer: "TEST CUSTOMER",
  testcreator: "TEST CREATOR",
  testbusiness: "TEST BUSINESS",
};
export const isQaHandle = (h: string | undefined | null) => !!h && (QA_HANDLES as readonly string[]).includes(h);

const RETURN_KEY = "upnova-qa-return";

export function stashedReturn(): { token: string; handle: string } | null {
  try {
    const raw = window.localStorage.getItem(RETURN_KEY);
    return raw ? (JSON.parse(raw) as { token: string; handle: string }) : null;
  } catch {
    return null;
  }
}

/** Switch into a QA persona; optionally navigate somewhere as them. */
export async function switchPersona(handle: string, nextHref?: string): Promise<string | null> {
  const res = await fetch("/api/qa/impersonate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) return d.error || "Could not switch persona";
  if (d.returnToken && d.returnHandle) {
    try {
      window.localStorage.setItem(RETURN_KEY, JSON.stringify({ token: d.returnToken, handle: d.returnHandle }));
    } catch {}
  }
  setFallbackToken(String(d.sessionToken));
  invalidateSession();
  window.location.href = nextHref || "/";
  return null;
}

/** Leave the test session — back to the account the tester came from. */
export async function exitQa(): Promise<string | null> {
  const stash = stashedReturn();
  if (!stash) {
    window.location.href = "/login";
    return null;
  }
  const res = await fetch("/api/qa/impersonate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnToken: stash.token }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) return d.error || "Could not restore your session";
  try {
    window.localStorage.removeItem(RETURN_KEY);
  } catch {}
  setFallbackToken(String(d.sessionToken));
  invalidateSession();
  window.location.href = "/simulation";
  return null;
}
