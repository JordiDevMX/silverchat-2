import { Link } from "@tanstack/react-router";
import { ChevronLeft, MoreVertical, Phone, Video } from "lucide-react";
import { Avatar } from "@/features/settings/components/shared";
import { useChatPresence } from "../hooks/useChatPresence";
import { useMessageText } from "../i18n";
import type { ChatDetails } from "../types";
export function ChatHeader({ chat }: { chat: ChatDetails }) {
  const { say, language } = useMessageText();
  const presence = useChatPresence(chat);
  const last = presence.data?.find((p) => p.id === chat.other?.id)?.last_seen_at;
  const elapsed = last ? Math.max(0, Date.now() - Date.parse(last)) : Infinity;
  const online = elapsed < 120000;
  const relative = Number.isFinite(elapsed)
    ? new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(
        -Math.floor(
          elapsed / (elapsed < 3600000 ? 60000 : elapsed < 86400000 ? 3600000 : 86400000),
        ),
        elapsed < 3600000 ? "minute" : elapsed < 86400000 ? "hour" : "day",
      )
    : "";
  const subtitle =
    chat.type === "self"
      ? say("Message yourself", "Envíate un mensaje")
      : chat.type === "community_chat"
        ? chat.communityName
        : chat.type === "group"
          ? `${chat.members.length} ${say("members", "miembros")}`
          : online
            ? say("Online", "En línea")
            : last
              ? `${say("Last seen", "Última conexión")} ${relative}`
              : say("Offline", "Desconectado");
  const name = chat.type === "self" ? say("You", "Tú") : chat.name;
  const identity = (
    <>
      <Avatar
        profile={
          chat.type === "direct"
            ? (chat.other ?? {})
            : { id: chat.id, display_name: name, avatar_url: chat.avatar }
        }
        size="small"
      />
      <span>
        <strong>{name}</strong>
        <small>
          {online && chat.type === "direct" && <i className="presence-dot" />}
          {subtitle}
        </small>
      </span>
    </>
  );
  return (
    <header className="conversation-header glass-surface">
      <Link
        to="/chats"
        search={{ filter: "all", q: "", selectedIds: "", select: undefined, notice: undefined }}
        className="message-icon conversation-back"
        aria-label={say("Back to chats", "Volver a chats")}
      >
        <ChevronLeft />
      </Link>
      {chat.type === "direct" && chat.other?.username ? (
        <Link
          className="conversation-identity"
          to="/profile/$username"
          params={{ username: chat.other.username }}
        >
          {identity}
        </Link>
      ) : (
        <div className="conversation-identity">{identity}</div>
      )}
      <div className="conversation-actions">
        {[
          { Icon: Phone, label: say("Voice calls coming soon", "Llamadas próximamente") },
          { Icon: Video, label: say("Video calls coming soon", "Videollamadas próximamente") },
          {
            Icon: MoreVertical,
            label: say("Chat options coming soon", "Opciones del chat próximamente"),
          },
        ].map(({ Icon, label }) => (
          <button
            key={label}
            className="message-icon"
            type="button"
            disabled
            aria-label={label}
            title={label}
          >
            <Icon size={20} />
          </button>
        ))}
      </div>
    </header>
  );
}
