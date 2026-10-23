import { type CSSProperties, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
import { type ChatAction, getAvailableChatActions } from "../lib/chatActions";
export function ChatOptionsMenu({
  chat,
  point,
  onChoose,
  onClose,
}: {
  chat: ChatDetails;
  point: { x: number; y: number };
  onChoose: (action: ChatAction) => void;
  onClose: () => void;
}) {
  const { say } = useMessageText();
  const ref = useRef<HTMLDivElement>(null);
  const labels: Record<ChatAction, string> = {
    view_profile: say("View profile", "Ver perfil"),
    view_group_info: say("Group info", "Información del grupo"),
    search_in_chat: say("Search in chat", "Buscar en el chat"),
    mute: say("Mute", "Silenciar"),
    unmute: say("Unmute", "Activar sonido"),
    mark_unread: say("Mark as unread", "Marcar como no leído"),
    pin: say("Pin", "Fijar"),
    unpin: say("Unpin", "Desfijar"),
    clear_chat: say("Clear chat", "Vaciar chat"),
    block: say("Block", "Bloquear"),
    report: say("Report", "Reportar"),
    view_members: say("View members", "Ver miembros"),
    add_members: say("Add members", "Añadir miembros"),
    leave_group: say("Leave group", "Salir del grupo"),
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector("button")?.focus();
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab") onClose();
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const buttons = [...(ref.current?.querySelectorAll("button") ?? [])];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? buttons.length - 1
              : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length
        ]?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
      previous?.isConnected && previous.focus();
    };
  }, [onClose]);
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={say("Chat options", "Opciones del chat")}
      className="chat-options-menu"
      style={
        {
          "--menu-left": `${Math.max(8, Math.min(point.x, innerWidth - 248))}px`,
          "--menu-top": `${Math.max(8, Math.min(point.y, innerHeight - 440))}px`,
        } as CSSProperties
      }
    >
      {getAvailableChatActions(chat).map((action) => (
        <div key={action}>
          {["block", "view_members", "leave_group"].includes(action) ||
          (chat.type === "self" && action === "clear_chat") ? (
            <hr />
          ) : null}
          <button
            role="menuitem"
            type="button"
            className={["block", "leave_group", "clear_chat"].includes(action) ? "danger" : ""}
            onClick={() => onChoose(action)}
          >
            {labels[action]}
            {action === "mute" ? <span aria-hidden="true"> ›</span> : null}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
