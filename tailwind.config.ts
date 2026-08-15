import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* the whole palette rides on CSS variables so light mode is a
           class on <html>, not a rewrite — same Mavyn, different room */
        ink: {
          DEFAULT: "rgb(var(--c-ink) / <alpha-value>)",
          soft: "rgb(var(--c-ink-soft) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--c-card) / <alpha-value>)",
          raised: "rgb(var(--c-card-raised) / <alpha-value>)",
          hover: "rgb(var(--c-card-hover) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--c-line) / <alpha-value>)",
          soft: "rgb(var(--c-line-soft) / <alpha-value>)",
        },
        white: "rgb(var(--c-contrast) / <alpha-value>)",
        zinc: {
          50: "rgb(var(--c-z50) / <alpha-value>)",
          100: "rgb(var(--c-z100) / <alpha-value>)",
          200: "rgb(var(--c-z200) / <alpha-value>)",
          300: "rgb(var(--c-z300) / <alpha-value>)",
          400: "rgb(var(--c-z400) / <alpha-value>)",
          500: "rgb(var(--c-z500) / <alpha-value>)",
          600: "rgb(var(--c-z600) / <alpha-value>)",
          950: "rgb(var(--c-on-contrast) / <alpha-value>)",
        },
        lime: {
          300: "rgb(var(--c-lime-300) / <alpha-value>)",
          400: "rgb(var(--c-lime-400) / <alpha-value>)",
        },
        violet: {
          300: "rgb(var(--c-violet-300) / <alpha-value>)",
          400: "rgb(var(--c-violet-400) / <alpha-value>)",
        },
        amber: {
          300: "rgb(var(--c-amber-300) / <alpha-value>)",
          400: "rgb(var(--c-amber-400) / <alpha-value>)",
        },
        sky: {
          300: "rgb(var(--c-sky-300) / <alpha-value>)",
          400: "rgb(var(--c-sky-400) / <alpha-value>)",
        },
        red: {
          300: "rgb(var(--c-red-300) / <alpha-value>)",
          400: "rgb(var(--c-red-400) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px -6px rgba(163, 230, 53, 0.35)",
        "glow-violet": "0 0 24px -6px rgba(167, 139, 250, 0.35)",
        "glow-amber": "0 0 24px -6px rgba(251, 191, 36, 0.35)",
        card: "0 1px 0 0 rgba(255,255,255,0.02) inset, 0 8px 24px -16px rgba(0,0,0,0.8)",
      },
      keyframes: {
        "heart-pop": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "40%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "eq-1": {
          "0%, 100%": { height: "6px" },
          "50%": { height: "16px" },
        },
        "eq-2": {
          "0%, 100%": { height: "14px" },
          "50%": { height: "7px" },
        },
        "eq-3": {
          "0%, 100%": { height: "9px" },
          "50%": { height: "15px" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "heart-pop": "heart-pop 0.45s ease-out forwards",
        "eq-1": "eq-1 0.9s ease-in-out infinite",
        "eq-2": "eq-2 0.9s ease-in-out 0.15s infinite",
        "eq-3": "eq-3 0.9s ease-in-out 0.3s infinite",
        "fade-up": "fade-up 0.35s ease-out both",
        "pulse-dot": "pulse-dot 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
