import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import type { ChannelAction } from "@/features/chat-settings/lib/chatActions";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useMessageText } from "@/features/messages/i18n";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { Channel } from "../../types";
import { useFollowChannel } from "./useFollowChannel";
import { useMuteChannel } from "./useMuteChannel";
import { useUnfollowChannel } from "./useUnfollowChannel";
export function useChannelHeaderActions(c: Channel, onSearch?: () => void) {
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
  return { say, user, add, remove, mute, open, setOpen, menu, setMenu, closeMenu, action };
}
