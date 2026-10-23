import { useQuery } from "@tanstack/react-query";
import { allRows } from "@/features/chats/hooks/useChats";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { Channel } from "../../types";
export function useDiscoverChannels() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["discover-channels", user?.id],
    refetchOnWindowFocus: "always",
    queryFn: async () => {
      const follows = await allRows((from, to) =>
        supabase
          .from("channel_followers")
          .select("channel_id")
          .eq("user_id", user?.id ?? "")
          .order("channel_id")
          .range(from, to),
      );
      const ids = new Set(follows.map((f) => f.channel_id));
      const result: Channel[] = [];
      // Scan ordered pages to return exactly the top 20 not followed, without an oversized NOT IN URL.
      for (let offset = 0; result.length < 20; offset += 100) {
        const r = await supabase
          .from("channels")
          .select("*")
          .order("follower_count", { ascending: false })
          .order("id")
          .range(offset, offset + 99);
        if (r.error) throw r.error;
        result.push(...r.data.filter((c) => !ids.has(c.id)));
        if (r.data.length < 100) break;
      }
      return result.slice(0, 20);
    },
  });
}
