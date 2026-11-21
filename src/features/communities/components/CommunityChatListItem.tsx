import { BellOff, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CommunityChatRowContent } from "@/components/ui/community-surfaces";
import { useMessageText } from "@/features/messages/i18n";
import { Avatar, NavLink } from "@/features/settings/components/shared";
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
      className="community-chat-row"
      aria-current={isActive ? "page" : undefined}
    >
      <CommunityChatRowContent
        name={chat.name}
        avatar={
          chat.avatar_url && (
            <Avatar
              profile={{ id: chat.id, display_name: chat.name, avatar_url: chat.avatar_url }}
              size="small"
            />
          )
        }
        pinned={
          <>
            {chat.system_role === "announcements" && (
              <Badge variant="default">{say("Official", "Oficial")}</Badge>
            )}
            {chat.membership.pinned_at && <Pin size={14} aria-label={say("Pinned", "Fijado")} />}
          </>
        }
        preview={chat.last_message_preview ?? say("No messages yet", "Aún no hay mensajes")}
        timestamp={formatCommunityTimestamp(chat.last_message_at, language)}
        status={
          muted ? (
            <BellOff size={14} aria-label={say("Muted", "Silenciado")} />
          ) : chat.membership.manually_unread ? (
            <span
              className="community-unread-dot"
              role="img"
              aria-label={say("Unread", "No leído")}
            />
          ) : chat.unreadCount > 0 ? (
            <Badge variant="neon">{chat.unreadCount > 99 ? "99+" : chat.unreadCount}</Badge>
          ) : null
        }
      />
    </NavLink>
  );
}
