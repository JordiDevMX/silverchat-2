import { SystemPill } from "@/components/ui/conversation-surface";
import { useMessageText } from "../../i18n";
import { formatSystemMessageText } from "../../lib/systemMessageText";
import type { Message } from "../../types";

export function SystemMessage({ message }: { message: Message }) {
  const { language } = useMessageText();
  return (
    <SystemPill className="message-system">
      {formatSystemMessageText(message.content, language)}
    </SystemPill>
  );
}
