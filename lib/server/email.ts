import { randomBytes } from "crypto";
import { db, tables } from "@/db";

/* ------------------------------------------------------------------ */
/*  TRANSACTIONAL EMAIL — the auth-critical transport.                 */
/*                                                                     */
/*  Two modes behind one function, mirroring the payment seam:         */
/*                                                                     */
/*   · PROVIDER (production): Resend's HTTP API (server-side fetch,    */
/*     RESEND_API_KEY — never exposed to a browser). Chosen because    */
/*     it is the standard Vercel transactional-email pairing and       */
/*     needs no SDK.                                                   */
/*   · OUTBOX (dev/preview/demo/Test Center): the existing inspectable */
/*     outbox table — exactly the platform's historical behavior.      */
/*     Reset links keep working in QA via the outbox record.           */
/*                                                                     */
/*  Fail-closed rule: on Vercel Production, auth-critical email        */
/*  REQUIRES the provider — if RESEND_API_KEY is missing, sendEmail    */
/*  reports failure loudly instead of silently "succeeding" into a     */
/*  table nobody reads. Non-production always uses the outbox unless   */
/*  a key explicitly opts in (safe to test with a real key on          */
/*  preview).                                                          */
/*                                                                     */
/*  SECRECY: bodies may contain single-use tokens. They are NEVER      */
/*  logged (no console.* of body anywhere here) and never returned to  */
/*  API callers.                                                       */
/* ------------------------------------------------------------------ */

const isVercelProduction = () => process.env.VERCEL_ENV === "production";

export interface SendEmailInput {
  /** account the mail belongs to (outbox bookkeeping + rate caps) */
  userId: string;
  to: string;
  subject: string;
  /** plain-text body — auth mail should be dead simple */
  text: string;
  /** outbox/anti-spam category; "security" bypasses volume caps */
  kind: "security" | "otp" | "notification";
}

export interface SendEmailResult {
  delivered: boolean;
  transport: "resend" | "outbox";
  /** provider message id — never contains secrets */
  providerRef?: string;
  /** human-safe error (no body content) when delivered=false */
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY || null;

  if (isVercelProduction() && !apiKey) {
    // fail closed and SAY SO — a reset mail that lands in an invisible
    // table is a lie to the user ("check your email" for mail that
    // never existed).
    return {
      delivered: false,
      transport: "resend",
      error: "Email provider not configured (RESEND_API_KEY missing on production)",
    };
  }

  if (apiKey) {
    try {
      const from = process.env.EMAIL_FROM || "Mavyn <onboarding@resend.dev>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return {
          delivered: false,
          transport: "resend",
          // provider error text only — never the mail body
          error: `Provider rejected the send (${res.status}): ${detail.slice(0, 140)}`,
        };
      }
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      return { delivered: true, transport: "resend", providerRef: data.id };
    } catch (err) {
      return { delivered: false, transport: "resend", error: `Provider unreachable: ${(err as Error).message.slice(0, 100)}` };
    }
  }

  // dev/preview/demo: the inspectable outbox — the existing QA mechanism
  await db.insert(tables.outbox)
    .values({
      id: randomBytes(12).toString("hex"),
      userId: input.userId,
      channel: "email",
      to: input.to,
      body: `${input.subject}\n${input.text}`.slice(0, 320),
      kind: input.kind,
    })
    .run();
  return { delivered: true, transport: "outbox" };
}
