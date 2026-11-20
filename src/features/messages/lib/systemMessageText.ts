import type { Language } from "../../../lib/language.ts";

const LEAVE_PATTERN = /^'(.+)' left the chat$/;
const REMOVED_PATTERN = /^'(.+)' was removed from the chat$/;

function localizeMemberName(name: string, language: Language): string {
  return name === "Member" && language === "es" ? "Miembro" : name;
}

/** Formats canonical DB system messages into the viewer's language while preserving unknown notices. */
export function formatSystemMessageText(
  content: string | null | undefined,
  language: Language,
): string {
  if (!content) return "";
  const leftMatch = LEAVE_PATTERN.exec(content);
  if (leftMatch?.[1]) {
    const name = localizeMemberName(leftMatch[1], language);
    return language === "es" ? `'${name}' salió del chat` : `'${name}' left the chat`;
  }
  const removedMatch = REMOVED_PATTERN.exec(content);
  if (removedMatch?.[1]) {
    const name = localizeMemberName(removedMatch[1], language);
    return language === "es"
      ? `'${name}' fue eliminado del chat`
      : `'${name}' was removed from the chat`;
  }
  return content;
}
