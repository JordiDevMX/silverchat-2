import { Link, useRouter } from "@tanstack/react-router";
import { ChevronLeft, MoreVertical, Phone, Search, Users, Video } from "lucide-react";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { Avatar } from "@/features/settings/components/shared";
import { useChatPresence } from "../hooks/useChatPresence";
import { useMessageText } from "../i18n";
import type { ChatDetails } from "../types";
export function ChatHeader({ chat, onSearch }: { chat: ChatDetails; onSearch: () => void }) {
  const ui = useChatUIStore();
  const router = useRouter();
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
      {(chat.type === "group" || chat.type === "community_chat") && !chat.avatar ? (
        <span className="group-avatar-placeholder small">
          <Users size={22} />
        </span>
      ) : (
        <Avatar
          profile={
            chat.type === "direct"
              ? (chat.other ?? {})
              : { id: chat.id, display_name: name, avatar_url: chat.avatar }
          }
          size="small"
        />
      )}
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
      {chat.type === "self" ? (
        <div className="conversation-identity">{identity}</div>
      ) : (
        <button
          type="button"
          className="conversation-identity"
          onClick={() => {
            if (chat.type === "direct") {
              if (chat.otherUserId) ui.open(chat.id, { kind: "contact", userId: chat.otherUserId });
            } else void router.navigate({ href: `/chats/${chat.id}/info` });
          }}
        >
          {identity}
        </button>
      )}
      <div className="conversation-actions">
        <button
          type="button"
          className="message-icon"
          aria-label={say("Search messages", "Buscar mensajes")}
          onClick={onSearch}
        >
          <Search size={20} />
        </button>
        {[
          { Icon: Phone, label: say("Voice calls coming soon", "Llamadas próximamente") },
          { Icon: Video, label: say("Video calls coming soon", "Videollamadas próximamente") },
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
        <button
          type="button"
          className="message-icon"
          aria-label={say("Chat options", "Opciones del chat")}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            ui.open(chat.id, { kind: "menu", x: rect.right - 240, y: rect.bottom + 4 });
          }}
        >
          <MoreVertical size={20} />
        </button>
      </div>
    </header>
  );
}
