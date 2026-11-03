import { TimelineDate } from "@/components/ui/conversation-surface";
import { useMessageText } from "../i18n";
import { dateLabel } from "../utils/formatMessageTime";
export function DateSeparator({ date }: { date: string }) {
  const { language } = useMessageText();
  return <TimelineDate>{dateLabel(date, language)}</TimelineDate>;
}
