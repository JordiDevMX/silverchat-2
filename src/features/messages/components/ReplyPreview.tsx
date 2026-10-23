import { X } from "lucide-react";
import { useMessageText } from "../i18n";
import type { Message } from "../types";
import { useMessageActionUI } from "./MessageActionsProvider";
export function ReplyPreview({
  message,
  mode = "quote",
  onClear,
}: {
  message?: Message;
  mode?: "quote" | "bar";
  onClear?: () => void;
}) {
  const { say } = useMessageText();
  const ui = useMessageActionUI();
  const reply = mode === "bar" ? message : message?.reply;
  const name = mode === "bar" ? message?.sender?.display_name : message?.replySender?.display_name;
  const content = !reply
    ? say("Message unavailable", "Mensaje no disponible")
    : reply.deleted_for_everyone
      ? say("This message was deleted", "Este mensaje fue eliminado")
      : reply.content ||
        {
          image: say("📷 Photo", "📷 Foto"),
          video: say("🎥 Video", "🎥 Video"),
          audio: say("🎤 Audio", "🎤 Audio"),
          file: say("📄 File", "📄 Archivo"),
          contact: say("Contact", "Contacto"),
          location: say("Location", "Ubicación"),
          sticker: say("Sticker", "Sticker"),
          text: say("Message", "Mensaje"),
          system: say("Message", "Mensaje"),
        }[reply.type];
  return (
    <div className={`message-reply ${mode === "bar" ? "reply-bar" : ""}`}>
      <button
        type="button"
        disabled={!reply}
        onClick={() => {
          if (reply) ui.navigate(reply.id);
        }}
      >
        <strong>
          {mode === "bar"
            ? `${say("Replying to", "Respondiendo a")} ${name ?? say("Message", "Mensaje")}`
            : (name ?? say("Message", "Mensaje"))}
        </strong>
        <span>{content}</span>
      </button>
      {mode === "bar" && (
        <button
          type="button"
          className="message-icon"
          aria-label={say("Cancel reply", "Cancelar respuesta")}
          onClick={onClear}
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
