import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshNovedades } from "../../lib/cache";
export function useCreateChannel() {
  const { user } = useAuth();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      channelId?: string;
      name: string;
      slug: string;
      description: string;
    }) => {
      const r = await supabase.rpc("create_channel", {
        ...(input.channelId ? { p_channel_id: input.channelId } : {}),
        p_name: input.name,
        p_slug: input.slug,
        p_description: input.description,
      });
      if (r.error) throw r.error;
      return r.data;
    },
    onSuccess: () => refreshNovedades(cache, user?.id ?? ""),
  });
}
