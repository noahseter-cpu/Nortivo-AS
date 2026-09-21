import { Capacitor, registerPlugin } from "@capacitor/core";
import type { State } from "./tracker-core";

export type Language = "nb" | "en";
let language: Language = "en";
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export const getLocale = () => (language === "nb" ? "nb-NO" : "en-GB");
export function subscribeLanguage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function syncLanguage(state: Pick<State, "settings">) {
  const next = state.settings.language;
  if (!next) return;
  const changed = language !== next;
  language = next;
  if (typeof document !== "undefined") document.documentElement.lang = next;
  if (changed) listeners.forEach((listener) => listener());
}

/** Pure country policy; language-only values such as "nb" are never a country. */
export function languageForCountry(country: unknown): Language {
  return typeof country === "string" && country.toUpperCase() === "NO"
    ? "nb"
    : "en";
}
const DeviceRegion = registerPlugin<{
  getRegion(): Promise<{ country: string | null }>;
}>("DeviceRegion");
async function firstUseCountry(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    // Device region is an explicitly documented fallback, not Play/download country.
    const value = await DeviceRegion.getRegion();
    return value.country;
  }
  if (typeof window === "undefined") return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch("/api/locale", {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const value = (await response.json()) as { country?: unknown };
    return typeof value.country === "string" ? value.country : null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Called before revealing the app. Only a committed language preference is published. */
export async function initializeLanguage(
  state: State,
  countryLookup = firstUseCountry,
): Promise<State> {
  if (state.settings.language) {
    syncLanguage(state);
    return state;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const country = await Promise.race([
    countryLookup().catch(() => null),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), 1500);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
  const { updateState } = await import("./tracker-store");
  const next = await updateState((current) => {
    // Read the latest record inside the transaction: a newer manual choice wins.
    if (current.settings.language) return;
    current.settings.language = languageForCountry(country);
    current.settings.languageSource =
      typeof country === "string" &&
      /^[A-Z]{2}$/i.test(country) &&
      country !== "XX"
        ? "country"
        : "fallback";
  });
  syncLanguage(next);
  return next;
}

export async function setLanguage(next: Language): Promise<State> {
  if (next !== "nb" && next !== "en") throw new Error("Invalid language");
  const { updateState } = await import("./tracker-store");
  const state = await updateState((current) => {
    current.settings.language = next;
    current.settings.languageSource = "manual";
  });
  syncLanguage(state);
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent("arc-language-committed", { detail: state }),
    );
  return state;
}
