import type { Language } from "../../../lib/language.ts";

const SYSTEM_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  format: Record<Language, (name: string) => string>;
}> = [
  {
    pattern: /^'(.+)' left the chat$/,
    format: {
      en: (name) => `'${name}' left the chat`,
      es: (name) => `'${name}' salió del chat`,
    },
  },
  {
    pattern: /^'(.+)' was removed from the chat$/,
    format: {
      en: (name) => `'${name}' was removed from the chat`,
      es: (name) => `'${name}' fue eliminado del chat`,
    },
  },
  {
    pattern: /^'(.+)' joined the chat$/,
    format: {
      en: (name) => `'${name}' joined the chat`,
      es: (name) => `'${name}' se unió al chat`,
    },
  },
];

function localizeMemberName(name: string, language: Language): string {
  return name === "Member" && language === "es" ? "Miembro" : name;
}

/** Formats canonical DB system messages into the viewer's language while preserving unknown notices. */
export function formatSystemMessageText(
  content: string | null | undefined,
  language: Language,
): string {
  if (!content) return "";
  for (const rule of SYSTEM_PATTERNS) {
    const match = rule.pattern.exec(content);
    if (match?.[1]) {
      return rule.format[language](localizeMemberName(match[1], language));
    }
  }
  return content;
}
