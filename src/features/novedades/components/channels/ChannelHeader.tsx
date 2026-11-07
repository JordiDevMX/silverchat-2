import { BadgeCheck, ChevronLeft, MoreVertical } from "lucide-react";
import { ConversationHeaderSurface } from "@/components/ui/conversation-surface";
import { ChatOptionsMenu } from "@/features/chat-settings/components/ChatOptionsMenu";
import { MuteSubmenu } from "@/features/chat-settings/components/MuteSubmenu";
import { Avatar, NavLink } from "@/features/settings/components/shared";
import { useChannelHeaderActions } from "../../hooks/channels/useChannelHeaderActions";
import type { Channel, Follow } from "../../types";
import "@/styles/chat-settings.css";

export function ChannelHeader({
  channel: c,
  follow,
  onSearch,
}: {
  channel: Channel;
  follow: Follow | null;
  onSearch?: () => void;
}) {
  const { say, user, add, remove, mute, open, setOpen, menu, setMenu, closeMenu, action } =
    useChannelHeaderActions(c, onSearch);
  return (
    <>
      <ConversationHeaderSurface className="channel-header">
        <NavLink
          className="message-icon"
          href="/novedades"
          aria-label={say("Back to updates", "Volver a novedades")}
        >
          <ChevronLeft size={22} />
        </NavLink>
        <NavLink href={`/channels/${c.id}/info`} className="channel-header-identity">
          <Avatar
            profile={{ id: c.id, display_name: c.name, avatar_url: c.avatar_url }}
            size="small"
          />
          <span>
            <strong>
              {c.name}
              {c.is_verified && (
                <BadgeCheck
                  className="text-primary"
                  size={16}
                  aria-label={say("Verified", "Verificado")}
                />
              )}
            </strong>
            <small>
              {c.follower_count} {say("followers", "seguidores")}
            </small>
          </span>
        </NavLink>
        <button
          type="button"
          className="message-icon"
          aria-label={say("Channel options", "Opciones del canal")}
          aria-haspopup="menu"
          aria-expanded={!!menu}
          disabled={action.isPending}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setMenu(menu ? null : { x: rect.right - 240, y: rect.bottom + 4 });
          }}
        >
          <MoreVertical size={20} />
        </button>
      </ConversationHeaderSurface>
      {menu && (
        <ChatOptionsMenu
          contextType="channel"
          channel={{
            following: !!follow,
            canSearch: !!follow || c.owner_id === user?.id,
            hasLink: true,
          }}
          point={menu}
          onClose={closeMenu}
          onChoose={(choice) => {
            closeMenu();
            action.mutate(choice);
          }}
        />
      )}
      {(action.isError || add.isError || remove.isError || mute.isError) && (
        <p role="alert">
          {say(
            "Unable to update channel. Try again.",
            "No se pudo actualizar el canal. Reinténtalo.",
          )}
        </p>
      )}
      {open && (
        <MuteSubmenu
          muted={!!follow?.muted_until && Date.parse(follow.muted_until) > Date.now()}
          busy={mute.isPending}
          onClose={() => setOpen(false)}
          onChoose={(until) => mute.mutate(until, { onSuccess: () => setOpen(false) })}
        />
      )}
    </>
  );
}
