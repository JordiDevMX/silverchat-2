import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshNovedades } from "../../lib/cache";
export function useCreateChannel() {
  const { user } = useAuth();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; slug: string; description: string }) => {
      const r = await supabase.rpc("create_channel", {
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
