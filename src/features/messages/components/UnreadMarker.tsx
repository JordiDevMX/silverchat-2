import { useMessageText } from "../i18n";
export function UnreadMarker() {
  const { say } = useMessageText();
  return (
    <div className="message-unread" data-unread-marker>
      <span>{say("Unread messages", "Mensajes sin leer")}</span>
    </div>
  );
}
