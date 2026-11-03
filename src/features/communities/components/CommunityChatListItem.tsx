import { BellOff, MessageCircle } from "lucide-react";
import { useMessageText } from "@/features/messages/i18n";
import { NavLink } from "@/features/settings/components/shared";
import { formatCommunityTimestamp } from "../lib/communityActions";
import type { CommunityChat } from "../types";
export function CommunityChatListItem({
  chat,
  isActive = false,
}: {
  chat: CommunityChat;
  isActive?: boolean;
}) {
  const { say, language } = useMessageText();
  const muted =
    !!chat.membership.muted_until && Date.parse(chat.membership.muted_until) > Date.now();
  return (
    <NavLink
      href={`/communities/${chat.community_id}/chats/${chat.id}`}
      className={`flex min-w-0 items-center gap-3 border-b border-border p-3 text-foreground hover:bg-muted hover:no-underline ${isActive ? "bg-muted" : ""}`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <MessageCircle size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate">{chat.name}</strong>
        <span className="block truncate text-sm text-muted-foreground">
          {chat.last_message_preview ?? say("No messages yet", "Aún no hay mensajes")}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <time className="text-xs text-muted-foreground">
          {formatCommunityTimestamp(chat.last_message_at, language)}
        </time>
        {muted ? (
          <BellOff size={14} aria-label={say("Muted", "Silenciado")} />
        ) : chat.membership.manually_unread ? (
          <span
            className="size-2 rounded-full bg-primary"
            role="img"
            aria-label={say("Unread", "No leído")}
          />
        ) : chat.unreadCount > 0 ? (
          <span className="chat-badge">{chat.unreadCount > 99 ? "99+" : chat.unreadCount}</span>
        ) : null}
      </span>
    </NavLink>
  );
}
