/* ------------------------------------------------------------------ */
/*  TOTP (RFC 6238) — real MFA with any authenticator app, using only  */
/*  Node's crypto. SHA-1, 6 digits, 30-second period, ±1 step window.  */
/* ------------------------------------------------------------------ */

import { createHmac, randomBytes } from "crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateSecret(): string {
  const bytes = randomBytes(20);
  let bits = "";
  for (let i = 0; i < bytes.length; i++) bits += bytes[i].toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(s: string): Buffer {
  let bits = "";
  for (const c of s.toUpperCase().replace(/=+$/, "")) {
    const v = B32.indexOf(c);
    if (v === -1) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

export function totpCode(secret: string, at = Date.now()): string {
  return hotp(secret, Math.floor(at / 1000 / 30));
}

/** Accepts the current step and its neighbors (clock drift). */
export function verifyTotp(secret: string, code: string, at = Date.now()): boolean {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const step = Math.floor(at / 1000 / 30);
  return [-1, 0, 1].some((d) => hotp(secret, step + d) === clean);
}

export function otpauthUrl(secret: string, email: string): string {
  return `otpauth://totp/UpNova:${encodeURIComponent(email)}?secret=${secret}&issuer=UpNova&algorithm=SHA1&digits=6&period=30`;
}
