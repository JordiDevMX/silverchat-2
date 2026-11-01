import { type CSSProperties, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
import {
  type ChannelAction,
  type ChannelActionContext,
  type ChatAction,
  getAvailableChannelActions,
  getAvailableChatActions,
} from "../lib/chatActions";

type MenuProps = {
  point: { x: number; y: number };
  onClose: () => void;
  busy?: boolean;
} & (
  | { contextType?: "chat"; chat: ChatDetails; onChoose: (action: ChatAction) => void }
  | {
      contextType: "channel";
      channel: ChannelActionContext;
      onChoose: (action: ChannelAction) => void;
    }
);
export function ChatOptionsMenu(props: MenuProps) {
  const { point, onClose, busy } = props;
  const actions =
    props.contextType === "channel"
      ? getAvailableChannelActions(props.channel).map((action) => ({
          action,
          choose: () => props.onChoose(action),
        }))
      : getAvailableChatActions(props.chat).map((action) => ({
          action,
          choose: () => props.onChoose(action),
        }));
  const { say } = useMessageText();
  const ref = useRef<HTMLDivElement>(null);
  const labels: Record<ChatAction | ChannelAction, string> = {
    view_channel_info: say("Channel info", "Información del canal"),
    follow: say("Follow", "Seguir"),
    unfollow: say("Unfollow", "Dejar de seguir"),
    copy_channel_link: say("Copy channel link", "Copiar enlace del canal"),
    view_profile: say("View profile", "Ver perfil"),
    view_group_info: say("Group info", "Información del grupo"),
    view_community_info: say("Community info", "Información de la comunidad"),
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
      aria-label={
        props.contextType === "channel"
          ? say("Channel options", "Opciones del canal")
          : say("Chat options", "Opciones del chat")
      }
      className="chat-options-menu"
      style={
        {
          "--menu-left": `${Math.max(8, Math.min(point.x, innerWidth - 248))}px`,
          "--menu-top": `${Math.max(8, Math.min(point.y, innerHeight - 440))}px`,
        } as CSSProperties
      }
    >
      {actions.map(({ action, choose }) => (
        <div key={action}>
          {["block", "view_members", "leave_group"].includes(action) ||
          (props.contextType !== "channel" &&
            props.chat.type === "self" &&
            action === "clear_chat") ? (
            <hr />
          ) : null}
          <button
            role="menuitem"
            type="button"
            disabled={busy}
            className={["block", "leave_group", "clear_chat"].includes(action) ? "danger" : ""}
            onClick={choose}
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
