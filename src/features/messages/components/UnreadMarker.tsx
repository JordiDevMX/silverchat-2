import { TimelineUnread } from "@/components/ui/conversation-surface";
import { useMessageText } from "../i18n";
export function UnreadMarker() {
  const { say } = useMessageText();
  return <TimelineUnread>{say("Unread messages", "Mensajes sin leer")}</TimelineUnread>;
}
