import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshNovedades } from "../../lib/cache";
export function useUpdateChannelInfo(id: string) {
  const { user } = useAuth();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (patch: {
      name?: string;
      slug?: string;
      description?: string;
      avatar_url?: string;
    }) => {
      const r = await supabase.rpc("update_channel_info", {
        p_channel_id: id,
        p_name: patch.name,
        p_slug: patch.slug,
        p_description: patch.description,
        p_avatar_url: patch.avatar_url,
      });
      if (r.error) throw r.error;
    },
    onSettled: () => refreshNovedades(cache, user?.id ?? ""),
  });
}
