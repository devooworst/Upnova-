/* Theme: dark (default) · light · system. A class on <html>, persisted. */

export type ThemeChoice = "dark" | "light" | "system";

export const THEME_EVENT = "upnova:theme-changed";
const KEY = "upnova-theme";

export function getTheme(): ThemeChoice {
  if (typeof window === "undefined") return "dark";
  const v = window.localStorage.getItem(KEY);
  return v === "light" || v === "system" ? v : "dark";
}

export function applyTheme(choice: ThemeChoice) {
  const light =
    choice === "light" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.classList.toggle("light", light);
}

export function setTheme(choice: ThemeChoice) {
  window.localStorage.setItem(KEY, choice);
  applyTheme(choice);
  window.dispatchEvent(new Event(THEME_EVENT));
}
