/* ------------------------------------------------------------------ */
/*  Password hashing — scrypt (Node built-in, memory-hard, no length   */
/*  truncation) with a unique random salt per password.                */
/*                                                                     */
/*  Why not bcrypt: it silently truncates at 72 bytes, which breaks    */
/*  the "long passphrases welcome" promise. Why not Argon2id here:     */
/*  it needs a native module the sandbox can't always build; scrypt    */
/*  is the OWASP-sanctioned built-in alternative. The verify path      */
/*  still accepts legacy bcrypt hashes and transparently rehashes to   */
/*  scrypt on the next successful login.                               */
/* ------------------------------------------------------------------ */

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

// OWASP-recommended scrypt parameters: N=2^15, r=8, p=1 (~32 MiB)
const N = 1 << 15;
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, KEYLEN, { N, r: R, p: P, maxmem: 128 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  if (stored.startsWith("scrypt$")) {
    const [, n, r, p, saltB64, hashB64] = stored.split("$");
    const expected = Buffer.from(hashB64, "base64");
    const actual = scryptSync(pw, Buffer.from(saltB64, "base64"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 128 * 1024 * 1024,
    });
    return timingSafeEqual(actual, expected);
  }
  // legacy bcrypt hashes (seed data / pre-migration accounts)
  try {
    return bcrypt.compareSync(pw, stored);
  } catch {
    return false;
  }
}

/** Legacy hashes get upgraded to scrypt on the next successful login. */
export function needsRehash(stored: string): boolean {
  return !stored.startsWith("scrypt$");
}
