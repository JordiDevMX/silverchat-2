import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshNovedades } from "../../lib/cache";
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
      await cache.cancelQueries({ queryKey: ["discover-channels", user?.id] });
      const old = cache.getQueryData<Channel[]>(["discover-channels", user?.id]);
      cache.setQueryData<Channel[]>(["discover-channels", user?.id], (rows) =>
        rows?.filter((c) => c.id !== id),
      );
      return old;
    },
    onError: (_error, _id, old) => {
      if (old) cache.setQueryData(["discover-channels", user?.id], old);
    },
    onSettled: () => refreshNovedades(cache, user?.id ?? ""),
  });
}
