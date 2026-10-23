import { useI18n } from "@/app/providers/i18n-provider";
export function useMessageText() {
  const { language } = useI18n();
  return { language, say: (en: string, es: string) => (language === "es" ? es : en) };
}
