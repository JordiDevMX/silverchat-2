import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshNovedades } from "../../lib/cache";
import { applyFollowOptimistic, type ChannelInfoCache } from "../../lib/channelFollowCache";
import type { Channel } from "../../types";
export function useFollowChannel() {
  const { user } = useAuth();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await supabase.rpc("follow_channel", { p_channel_id: id });
      if (r.error) throw r.error;
    },
    onMutate: async (id) => {
      await Promise.all([
        cache.cancelQueries({ queryKey: ["discover-channels", user?.id] }),
        cache.cancelQueries({ queryKey: ["channel-info", user?.id, id] }),
      ]);
      const prevDiscover = cache.getQueryData<Channel[]>(["discover-channels", user?.id]);
      const prevInfo = cache.getQueryData<ChannelInfoCache>(["channel-info", user?.id, id]);
      cache.setQueryData<Channel[]>(["discover-channels", user?.id], (rows) =>
        rows?.filter((c) => c.id !== id),
      );
      cache.setQueryData<ChannelInfoCache>(["channel-info", user?.id, id], (current) =>
        applyFollowOptimistic(current, user?.id ?? ""),
      );
      return { prevDiscover, prevInfo };
    },
    onError: (_error, id, ctx) => {
      if (ctx?.prevDiscover !== undefined)
        cache.setQueryData(["discover-channels", user?.id], ctx.prevDiscover);
      if (ctx?.prevInfo !== undefined)
        cache.setQueryData(["channel-info", user?.id, id], ctx.prevInfo);
    },
    onSettled: () => refreshNovedades(cache, user?.id ?? ""),
  });
}
