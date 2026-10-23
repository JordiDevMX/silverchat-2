import { BadgeCheck } from "lucide-react";
import { useState } from "react";
import { MuteSubmenu } from "@/features/chat-settings/components/MuteSubmenu";
import { useMessageText } from "@/features/messages/i18n";
import { Avatar, NavLink } from "@/features/settings/components/shared";
import { useFollowChannel } from "../../hooks/channels/useFollowChannel";
import { useMuteChannel } from "../../hooks/channels/useMuteChannel";
import { useUnfollowChannel } from "../../hooks/channels/useUnfollowChannel";
import type { Channel, Follow } from "../../types";
export function ChannelHeader({ channel: c, follow }: { channel: Channel; follow: Follow | null }) {
  const { say } = useMessageText();
  const add = useFollowChannel();
  const remove = useUnfollowChannel();
  const mute = useMuteChannel(c.id);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  return (
    <>
      <header className="conversation-header channel-header">
        <NavLink href="/novedades">←</NavLink>
        <NavLink href={`/channels/${c.id}/info`} className="channel-header-identity">
          <Avatar
            profile={{ id: c.id, display_name: c.name, avatar_url: c.avatar_url }}
            size="small"
          />
          <span>
            <strong>
              {c.name}
              {c.is_verified && <BadgeCheck size={16} aria-label={say("Verified", "Verificado")} />}
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
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          ⋮
        </button>
      </header>
      {menu && (
        <nav className="channel-menu" aria-label={say("Channel actions", "Acciones del canal")}>
          <button
            type="button"
            disabled={add.isPending || remove.isPending}
            onClick={() => {
              if (follow) remove.mutate(c.id);
              else add.mutate(c.id);
            }}
          >
            {follow ? say("Unfollow", "Dejar de seguir") : say("Follow", "Seguir")}
          </button>
          {follow && (
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                setOpen(true);
              }}
            >
              {say("Mute notifications", "Silenciar notificaciones")}
            </button>
          )}
          <NavLink href={`/channels/${c.id}/info`}>
            {say("Channel info", "Información del canal")}
          </NavLink>
          <button type="button" onClick={() => setMenu(false)}>
            {say("Close", "Cerrar")}
          </button>
        </nav>
      )}
      {(add.isError || remove.isError || mute.isError) && (
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
