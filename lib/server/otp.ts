/* OTP helpers — shared by request + verify routes. Codes are stored as
   sha256 hashes ONLY; 5-minute expiry; 5 attempts; enumeration-safe
   generic failures. */
import { createHash } from "crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { db, tables } from "@/db";
import { ApiError } from "@/lib/server/auth";

export const normalizePhone = (raw: unknown): string | null => {
  const digits = String(raw ?? "").replace(/[^\d+]/g, "");
  const m = digits.match(/^\+?(\d{7,15})$/);
  return m ? `+${m[1]}` : null;
};

export const hashOtp = (code: string) => createHash("sha256").update(`upnova-otp|${code}`).digest("hex");

/** Verify-and-consume: returns the phone on success, throws generic errors. */
export function consumeOtp(phoneRaw: unknown, codeRaw: unknown): string {
  const phone = normalizePhone(phoneRaw);
  const code = String(codeRaw ?? "").trim();
  const fail = () => new ApiError(401, "That code didn't work — request a new one.");
  if (!phone || !/^\d{6}$/.test(code)) throw fail();

  const row = db
    .select()
    .from(tables.otpCodes)
    .where(and(eq(tables.otpCodes.phone, phone), gt(tables.otpCodes.expiresAt, new Date())))
    .orderBy(desc(tables.otpCodes.createdAt))
    .get();
  if (!row) throw fail();
  if (row.attempts >= 5) throw new ApiError(429, "Too many attempts — request a new code.");
  db.update(tables.otpCodes).set({ attempts: row.attempts + 1 }).where(eq(tables.otpCodes.id, row.id)).run();
  if (row.codeHash !== hashOtp(code)) throw fail();
  db.delete(tables.otpCodes).where(eq(tables.otpCodes.phone, phone)).run();
  return phone;
}
