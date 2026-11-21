import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CommunityWritePolicy } from "@/features/roles/types";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshCommunities } from "../lib/cache";
import { communityApi } from "../lib/communityApi";
export function useCreateCommunityChat(communityId: string) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const api = communityApi(supabase);

  return useMutation({
    mutationFn: (input: {
      name: string;
      description?: string;
      writePolicy?: CommunityWritePolicy;
    }) => api.createChat(communityId, input),

    onSettled: () => refreshCommunities(cache, user?.id ?? ""),
  });
}
