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
        ink: {
          DEFAULT: "#0A0A0F",
          soft: "#0E0E14",
        },
        card: {
          DEFAULT: "#111111",
          raised: "#16161C",
          hover: "#1A1A21",
        },
        line: {
          DEFAULT: "#26262E",
          soft: "#1D1D24",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px -6px rgba(163, 230, 53, 0.35)",
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
