import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { BadgeCheck, MoreVertical } from "lucide-react";
import { useCallback, useState } from "react";
import { ChatOptionsMenu } from "@/features/chat-settings/components/ChatOptionsMenu";
import { MuteSubmenu } from "@/features/chat-settings/components/MuteSubmenu";
import type { ChannelAction } from "@/features/chat-settings/lib/chatActions";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useMessageText } from "@/features/messages/i18n";
import { Avatar, NavLink } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { useFollowChannel } from "../../hooks/channels/useFollowChannel";
import { useMuteChannel } from "../../hooks/channels/useMuteChannel";
import { useUnfollowChannel } from "../../hooks/channels/useUnfollowChannel";
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
  const { say } = useMessageText();
  const { user } = useAuth();
  const cache = useQueryClient();
  const router = useRouter();
  const add = useFollowChannel();
  const remove = useUnfollowChannel();
  const mute = useMuteChannel(c.id);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const action = useMutation({
    mutationFn: async (choice: ChannelAction) => {
      switch (choice) {
        case "mute":
          setOpen(true);
          break;
        case "follow":
          await add.mutateAsync(c.id);
          break;
        case "unfollow":
          await remove.mutateAsync(c.id);
          break;
        case "view_channel_info":
          await router.navigate({ href: `/channels/${c.id}/info` });
          break;
        case "search_in_chat":
          if (onSearch) onSearch();
          else await router.navigate({ href: `/channels/${c.id}?search=true` });
          break;
        case "copy_channel_link":
          await navigator.clipboard.writeText(
            new URL(`/channels/${c.id}`, window.location.origin).href,
          );
          useChatUIStore.getState().notify(say("Channel link copied", "Enlace del canal copiado"));
          break;
        case "mark_unread": {
          // Leave the latest post unread using the existing follower read cursor.
          const lastRead = new Date(
            c.last_message_at ? Date.parse(c.last_message_at) - 1 : 0,
          ).toISOString();
          const result = await supabase
            .from("channel_followers")
            .update({ last_read_at: lastRead })
            .eq("channel_id", c.id)
            .eq("user_id", user?.id ?? "")
            .select("channel_id")
            .single();
          if (result.error) throw result.error;
          await Promise.all([
            cache.invalidateQueries({ queryKey: ["channels", user?.id] }),
            cache.invalidateQueries({ queryKey: ["channel-info", user?.id, c.id] }),
          ]);
          await router.navigate({ href: "/novedades" });
          break;
        }
      }
    },
  });
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
      </header>
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
