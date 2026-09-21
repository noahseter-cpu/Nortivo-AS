import { useSyncExternalStore } from "react";
import {
  getLanguage,
  setLanguage,
  subscribeLanguage,
  type Language,
} from "./language";
import { coreMessages } from "./locales/core";
import { uiMessages } from "./locales/ui";
import { settingsMessages } from "./locales/settings";
import { foodMessages } from "./locales/food";

export { getLanguage, getLocale, type Language } from "./language";
export const messages: Record<string, string> = {
  ...coreMessages,
  ...uiMessages,
  ...settingsMessages,
  ...foodMessages,
};
const missing = new Set<string>();
export const getMissingTranslations = () => [...missing];
export function translate(
  source: string,
  selected: Language,
  params?: Record<string, string | number>,
) {
  const entry = messages[source];
  if (entry === undefined) missing.add(source);
  // Human-readable source is the safe fallback; never display opaque lookup keys.
  const template = selected === "nb" ? source : (entry ?? source);
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params?.[name] === undefined ? match : String(params[name]),
  );
}
export const t = (source: string, params?: Record<string, string | number>) =>
  translate(source, getLanguage(), params);
export function useI18n() {
  const language = useSyncExternalStore(
    subscribeLanguage,
    getLanguage,
    () => "en" as Language,
  );
  return { language, t, setLanguage };
}
export function errorMessage(
  error: unknown,
  fallback = "Noe gikk galt. Prøv igjen.",
) {
  if (
    error instanceof Error &&
    Object.prototype.hasOwnProperty.call(messages, error.message)
  )
    return t(error.message);
  // Core errors may already have been translated when thrown.
  if (error instanceof Error) {
    const entry = Object.entries(messages).find(
      ([, english]) => english === error.message,
    );
    if (entry) return t(entry[0]);
  }
  return t(fallback);
}
