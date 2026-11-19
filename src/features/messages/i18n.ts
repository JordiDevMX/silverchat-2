import { useI18n } from "@/app/providers/i18n-provider";
import { type ConversationMessageKey, formatConversationText } from "./lib/conversationStrings";

export function useMessageText() {
  const { language } = useI18n();
  return {
    language,
    say: (en: string, es: string) => (language === "es" ? es : en),
    t: (key: ConversationMessageKey, params?: Record<string, string>) =>
      formatConversationText(language, key, params),
  };
}
