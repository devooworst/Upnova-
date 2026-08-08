/* ------------------------------------------------------------------ */
/*  Password policy — shared by the signup form (live feedback) and    */
/*  the API (enforcement). One source of truth.                        */
/*                                                                     */
/*  Philosophy (NIST SP 800-63B / OWASP ASVS):                         */
/*    · length beats composition — NO required character classes       */
/*    · allow spaces, symbols, passphrases, any printable characters   */
/*    · block known-common passwords instead of adding rules           */
/*    · never truncate, never expire on a timer                        */
/*  Real security lives server-side: memory-hard hashing, rate         */
/*  limiting, MFA, and session hygiene (lib/server/passwords.ts).      */
/* ------------------------------------------------------------------ */

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export const HANDLE_RE = /^[a-z0-9_.]{3,30}$/;
export const HANDLE_RULE = "3–30 characters. Letters, numbers, underscores, and periods.";

/* A compact top-common-passwords set (lowercased). Production swaps this
   for a k-anonymity breached-password check (Have I Been Pwned range API)
   — the seam is checkCommonPassword(). */
const COMMON = new Set(
  `password password1 password12 password123 password1234 passw0rd p@ssword p@ssw0rd
  123456 1234567 12345678 123456789 1234567890 12345678910 0123456789 987654321
  qwerty qwerty123 qwertyuiop asdfghjkl zxcvbnm qazwsx 1q2w3e4r 1q2w3e4r5t q1w2e3r4t5
  iloveyou iloveyou1 letmein letmein123 welcome welcome1 welcome123 monkey dragon
  sunshine princess football baseball superman batman trustno1 master shadow
  michael jordan23 harley hunter buster soccer charlie jennifer jessica daniel
  starwars whatever computer internet samsung google facebook instagram tiktok
  abc123 abcd1234 abcdefgh abcdefg123 aaaaaaaaaaaa 111111111111 000000000000
  password!234 admin admin123 administrator root toor changeme secret secret123
  fuckyou asshole pussy696969 696969 mustang corvette ferrari mercedes
  liverpool arsenal chelsea barcelona realmadrid pokemon naruto minecraft fortnite
  summer2024 summer2025 winter2024 spring2025 autumn2024 january february
  baltimore maryland upnova upnova123 upnova1234 creator creative
  letmeinplease passwordpassword 123123123123 111222333444 aaa111bbb222`
    .split(/\s+/)
    .filter(Boolean)
);

export function isCommonPassword(pw: string): boolean {
  const n = pw.toLowerCase().trim();
  if (COMMON.has(n)) return true;
  // common + trivial suffix ("password2024!", "qwerty!!")
  const stripped = n.replace(/[\d!@#$%^&*.?]+$/, "");
  return stripped.length >= 5 && COMMON.has(stripped);
}

/** null = OK, otherwise a user-facing error. The ONLY server-side rules. */
export function validatePassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters. Longer passwords are stronger.`;
  if (pw.length > PASSWORD_MAX) return `Password can't exceed ${PASSWORD_MAX} characters.`;
  if (isCommonPassword(pw)) return "That password shows up in common-password lists — pick something more unique.";
  return null;
}

/* ------------------------------ strength ------------------------------ */

export interface Strength {
  score: 0 | 1 | 2 | 3; // Weak · Fair · Strong · Very strong
  label: "Weak" | "Fair" | "Strong" | "Very strong";
  feedback: string;
}

const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl", "zxcvbnm", "0123456789"];

function hasLongSequence(pw: string): boolean {
  const n = pw.toLowerCase();
  for (const seq of SEQUENCES) {
    for (let i = 0; i + 4 <= seq.length; i++) {
      const chunk = seq.slice(i, i + 4);
      if (n.includes(chunk) || n.includes(chunk.split("").reverse().join(""))) return true;
    }
  }
  return false;
}

/** Length + patterns, never character-class rules. */
export function passwordStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: "Weak", feedback: `At least ${PASSWORD_MIN} characters — a few random words work great.` };

  if (isCommonPassword(pw))
    return { score: 0, label: "Weak", feedback: "This is a commonly used password — it would be guessed quickly." };

  // effective length discounts heavy repetition ("aaaaaaaaaaaa")
  let effective = 0;
  let prev = "";
  let run = 0;
  for (const ch of pw) {
    if (ch === prev) run++;
    else run = 0;
    prev = ch;
    effective += run >= 2 ? 0.25 : 1;
  }

  let score = 0;
  if (effective >= PASSWORD_MIN) score++;
  if (effective >= 16) score++;
  if (effective >= 24) score++;

  const uniqueChars = new Set(pw).size;
  if (uniqueChars <= 4 && score > 0) score--; // "abababababab"
  if (hasLongSequence(pw) && score > 0) score--; // "qwerty…", "1234…"
  if (/^(19|20)\d{2}/.test(pw) || /(19|20)\d{2}$/.test(pw)) score = Math.min(score, 2); // year affixes

  const s = Math.max(0, Math.min(3, score)) as Strength["score"];
  const label = (["Weak", "Fair", "Strong", "Very strong"] as const)[s];
  const feedback =
    s === 0
      ? pw.length < PASSWORD_MIN
        ? `${PASSWORD_MIN - pw.length} more character${PASSWORD_MIN - pw.length === 1 ? "" : "s"} to go — try a passphrase.`
        : "Avoid repeats and keyboard runs — try a longer passphrase."
      : s === 1
        ? "Decent. A few extra words would make it much stronger."
        : s === 2
          ? "Strong password."
          : "Very strong — this is what a good passphrase looks like.";
  return { score: s, label, feedback };
}
