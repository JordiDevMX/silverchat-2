import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshNovedades } from "../../lib/cache";
export function useMuteChannel(id: string) {
  const { user } = useAuth();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (until: string | null) => {
      const r = await supabase
        .from("channel_followers")
        .update({ muted_until: until })
        .eq("channel_id", id)
        .eq("user_id", user?.id ?? "")
        .select("channel_id")
        .single();
      if (r.error) throw r.error;
    },
    onSettled: () => refreshNovedades(cache, user?.id ?? ""),
  });
}
