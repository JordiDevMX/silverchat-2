import { BellOff } from "lucide-react";
import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { ChannelRowContent } from "@/components/ui/channel-surfaces";
import { formatChatTimestamp } from "@/features/chats/utils/formatChatTimestamp";
import { useMessageText } from "@/features/messages/i18n";
import { Avatar, NavLink } from "@/features/settings/components/shared";
import { useInView } from "@/hooks/useInView";
import type { FollowedChannel } from "../../types";

export function ChannelListItem({ channel: c }: { channel: FollowedChannel }) {
  const { say, language } = useMessageText();
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { rootMargin: "100px" });
  const muted = !!c.follow.muted_until && Date.parse(c.follow.muted_until) > Date.now();
  return (
    <div ref={ref} className="channel-row-reveal">
      <NavLink href={`/channels/${c.id}`} className="channel-list-item">
        <ChannelRowContent
          avatar={
            <Avatar
              profile={{ id: c.id, display_name: c.name, avatar_url: c.avatar_url }}
              size="small"
              enabled={isInView}
            />
          }
          name={c.name}
          verified={c.is_verified}
          verifiedLabel={say("Verified", "Verificado")}
          detail={c.last_message_preview ?? say("No posts yet", "Aún no hay publicaciones")}
          meta={
            <>
              {c.last_message_at && (
                <time dateTime={c.last_message_at}>
                  {formatChatTimestamp(c.last_message_at, language)}
                </time>
              )}
              {muted ? (
                <BellOff size={16} aria-label={say("Muted", "Silenciado")} />
              ) : c.unread > 0 ? (
                <Badge
                  variant="neon"
                  role="img"
                  className="chat-badge"
                  aria-label={`${c.unread} ${say("unread", "sin leer")}`}
                >
                  {c.unread > 99 ? "99+" : c.unread}
                </Badge>
              ) : null}
            </>
          }
        />
      </NavLink>
    </div>
  );
}
