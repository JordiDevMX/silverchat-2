import { useQuery } from "@tanstack/react-query";
import { allRows } from "@/features/chats/hooks/useChats";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { FollowedChannel } from "../../types";
export function useChannels() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["channels", user?.id],
    // Focus refetches stay staleTime-gated instead of firing on every tab switch.
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    queryFn: async () => {
      const follows = await allRows((from, to) =>
        supabase
          .from("channel_followers")
          .select("*,channel:channels!inner(*)")
          .eq("user_id", user?.id ?? "")
          .order("channel_id")
          .range(from, to),
      );
      const result: FollowedChannel[] = [];
      // Bound parallel requests instead of issuing one unbounded request per subscription.
      for (let i = 0; i < follows.length; i += 8) {
        result.push(
          ...(await Promise.all(
            follows.slice(i, i + 8).map(async ({ channel, ...follow }) => {
              const r = await supabase
                .from("messages")
                .select("id", { count: "exact", head: true })
                .eq("channel_id", channel.id)
                .gt("created_at", follow.last_read_at)
                .is("deleted_at", null)
                .eq("deleted_for_everyone", false);
              if (r.error) throw r.error;
              return { ...channel, follow, unread: r.count ?? 0 };
            }),
          )),
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
