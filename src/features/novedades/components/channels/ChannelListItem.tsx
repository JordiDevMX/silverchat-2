import { BadgeCheck, BellOff } from "lucide-react";
import { useRef } from "react";
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
    <div ref={ref}>
      <NavLink href={`/channels/${c.id}`} className="channel-list-item">
        <Avatar
          profile={{ id: c.id, display_name: c.name, avatar_url: c.avatar_url }}
          size="small"
          enabled={isInView}
        />
        <span className="channel-row-copy">
          <strong>
            {c.name}
            {c.is_verified && <BadgeCheck size={16} aria-label={say("Verified", "Verificado")} />}
          </strong>
          <small>{c.last_message_preview ?? say("No posts yet", "Aún no hay publicaciones")}</small>
        </span>
        <span className="channel-row-meta">
          {c.last_message_at && (
            <time>
              {new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit" }).format(
                new Date(c.last_message_at),
              )}
            </time>
          )}
          {muted ? (
            <BellOff size={16} aria-label={say("Muted", "Silenciado")} />
          ) : c.unread > 0 ? (
            <span
              role="img"
              className="chat-badge"
              aria-label={`${c.unread} ${say("unread", "sin leer")}`}
            >
              {c.unread > 99 ? "99+" : c.unread}
            </span>
          ) : null}
        </span>
      </NavLink>
    </div>
  );
}
