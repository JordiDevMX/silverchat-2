import { hasPreference, readPreference, writePreference } from "./preferences.ts";

export const SUPPORTED_LANGUAGES = ["en", "es"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "en";

/** Marker written next to the language the user picked explicitly. */
const CHOSEN_KEY = "language_chosen";

/**
 * Resolves the first language tag the app supports, ignoring region and script
 * subtags: `es-MX` and `es-ES` both resolve to `es`.
 */
export function matchDeviceLanguage(
  tags: readonly string[],
  fallback: Language = DEFAULT_LANGUAGE,
): Language {
  for (const tag of tags) {
    const primary = tag.split("-")[0]?.trim().toLowerCase();
    const match = SUPPORTED_LANGUAGES.find((language) => language === primary);
    if (match) return match;
  }
  return fallback;
}

/** The language the device asks for, used until an account or a choice says otherwise. */
export function detectDeviceLanguage(): Language {
  if (typeof navigator === "undefined") return DEFAULT_LANGUAGE;
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  return matchDeviceLanguage(tags.filter(Boolean));
}

/** The language the user picked explicitly in this browser, if any. */
export function readChosenLanguage(): Language | null {
  if (!hasPreference(CHOSEN_KEY)) return null;
  return readPreference("language", SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE);
}

/** Stores an explicit choice so device detection never overrides it. */
export function rememberChosenLanguage(language: Language) {
  writePreference("language", language);
  writePreference(CHOSEN_KEY, "1");
}
