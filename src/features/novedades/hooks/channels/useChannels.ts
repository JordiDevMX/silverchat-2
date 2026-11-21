import { useQuery } from "@tanstack/react-query";
import { allRows } from "@/features/chats/hooks/useChats";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { type FollowedChannel, mapPublicChannelRow } from "../../types";

export function useChannels() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["channels", user?.id],
    // Focus refetches stay disabled to prevent request bursts when switching windows.
    refetchOnWindowFocus: false,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const follows = await allRows((from, to) =>
        supabase
          .from("channel_followers")
          .select("*")
          .eq("user_id", user?.id ?? "")
          .order("channel_id")
          .range(from, to),
      );
      if (!follows.length) return [];
      const channelIds = follows.map((f) => f.channel_id);
      const publicChannels = await allRows((from, to) =>
        supabase
          .from("channels_public")
          .select("*")
          .in("id", channelIds)
          .order("id")
          .range(from, to),
      );
      const byId = new Map(
        publicChannels
          .filter((row): row is typeof row & { id: string } => Boolean(row.id))
          .map((row) => [row.id, mapPublicChannelRow(row)]),
      );

      const result: FollowedChannel[] = [];
      for (let i = 0; i < follows.length; i += 8) {
        result.push(
          ...(
            await Promise.all(
              follows.slice(i, i + 8).map(async (follow) => {
                const channel = byId.get(follow.channel_id);
                if (!channel) return null;
                let unread = 0;
                if (channel.last_message_at && channel.last_message_at > follow.last_read_at) {
                  const r = await supabase.rpc("get_channel_messages", {
                    p_channel_id: channel.id,
                  });
                  if (!r.error && Array.isArray(r.data)) {
                    unread = r.data.filter(
                      (m) => m.created_at > follow.last_read_at && !m.deleted_for_everyone,
                    ).length;
                  }
                }
                return { ...channel, follow, unread };
              }),
            )
          ).filter((item): item is FollowedChannel => item !== null),
        );
      }
      return result.sort(
        (a, b) =>
          (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "") ||
          a.id.localeCompare(b.id),
      );
    },
  });
}
