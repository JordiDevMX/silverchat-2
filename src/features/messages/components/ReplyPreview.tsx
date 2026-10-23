import { useMessageText } from "../i18n";
import type { Message } from "../types";
export function ReplyPreview({ message }: { message: Message }) {
  const { say } = useMessageText();
  const reply = message.reply;
  return (
    <div className="message-reply">
      <strong>{message.replySender?.display_name ?? say("Message", "Mensaje")}</strong>
      <span>
        {!reply
          ? say("Message unavailable", "Mensaje no disponible")
          : reply.deleted_for_everyone
            ? say("This message was deleted", "Este mensaje fue eliminado")
            : reply.content || say("Attachment", "Archivo adjunto")}
      </span>
    </div>
  );
}
