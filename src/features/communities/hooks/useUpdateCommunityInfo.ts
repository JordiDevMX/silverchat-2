import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshCommunities } from "../lib/cache";
import { type CommunityInfoPatch, communityApi } from "../lib/communityApi";
export function useUpdateCommunityInfo(communityId: string) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const api = communityApi(supabase);

  return useMutation({
    mutationFn: (input: CommunityInfoPatch) => api.update(communityId, input),

    onSettled: () => refreshCommunities(cache, user?.id ?? ""),
  });
}
