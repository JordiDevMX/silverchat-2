import { useMessageText } from "../i18n";
import { dateLabel } from "../utils/formatMessageTime";
export function DateSeparator({ date }: { date: string }) {
  const { language } = useMessageText();
  return (
    <div className="message-date">
      <span>{dateLabel(date, language)}</span>
    </div>
  );
}
