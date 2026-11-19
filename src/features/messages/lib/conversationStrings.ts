import type { Language } from "../../../lib/language.ts";

export const conversationStrings = {
  "conversation.start": {
    en: "Start of this conversation",
    es: "Inicio de esta conversación",
  },
  "chat.encryptionNotice": {
    en: "Messages are end-to-end encrypted. No one outside of this chat can read or listen to them.",
    es: "Los mensajes están cifrados de extremo a extremo. Nadie fuera de este chat puede leerlos ni escucharlos.",
  },
  "channel.created": {
    en: 'Channel "{name}" was created',
    es: 'Se creó el canal "{name}".',
  },
  "channel.follow": {
    en: "Follow channel",
    es: "Seguir canal",
  },
  "channel.followError": {
    en: "Unable to follow channel. Try again.",
    es: "No se pudo seguir el canal. Reinténtalo.",
  },
} as const satisfies Record<string, Record<Language, string>>;

export type ConversationMessageKey = keyof typeof conversationStrings;

export function formatConversationText(
  language: Language,
  key: ConversationMessageKey,
  params?: Record<string, string>,
): string {
  const template: string = conversationStrings[key][language];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(params, name) ? (params[name] ?? "") : match,
  );
}
