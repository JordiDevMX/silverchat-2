import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshCommunities } from "../lib/cache";
import { communityApi } from "../lib/communityApi";
export function useMuteCommunity(communityId: string) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const api = communityApi(supabase);

  return useMutation({
    mutationFn: (input: string | null) => api.mute(communityId, input),

    onSettled: () => refreshCommunities(cache, user?.id ?? ""),
  });
}
