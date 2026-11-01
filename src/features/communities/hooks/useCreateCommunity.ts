import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshCommunities } from "../lib/cache";
import { communityApi } from "../lib/communityApi";
export function useCreateCommunity() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const api = communityApi(supabase);

  return useMutation({
    mutationFn: (input: { name: string; description?: string }) => api.create(input),

    onSettled: () => refreshCommunities(cache, user?.id ?? ""),
  });
}
