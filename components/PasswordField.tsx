"use client";

/* Password input with show/hide toggle and optional live strength meter.
   Paste and password-manager autofill are deliberately unhindered. */

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { passwordStrength, PASSWORD_MAX } from "@/lib/passwordPolicy";

const METER_COLORS = ["bg-rose-400", "bg-amber-400", "bg-lime-400", "bg-lime-400"];
const LABEL_COLORS = ["text-rose-300", "text-amber-300", "text-lime-300", "text-lime-300"];

export default function PasswordField({
  value,
  onChange,
  placeholder = "Password",
  autoComplete = "current-password",
  showMeter = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  showMeter?: boolean;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const strength = showMeter && value ? passwordStrength(value) : null;

  return (
    <div>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, PASSWORD_MAX))}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          spellCheck={false}
          className="w-full rounded-xl border border-line bg-card-raised py-2.5 pl-3.5 pr-11 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-lime-400/50"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 transition hover:text-zinc-200"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {strength && (
        <div className="mt-1.5" aria-live="polite">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= strength.score && value ? METER_COLORS[strength.score] : "bg-card-raised"
                }`}
              />
            ))}
          </div>
          <p className="mt-1 flex items-baseline justify-between gap-2 text-[11px]">
            <span className={`font-semibold ${LABEL_COLORS[strength.score]}`}>{strength.label}</span>
            <span className="text-right text-zinc-500">{strength.feedback}</span>
          </p>
        </div>
      )}
    </div>
  );
}
