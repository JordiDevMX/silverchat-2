import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshCommunities } from "../lib/cache";
import { communityApi } from "../lib/communityApi";
export function useLeaveCommunity(communityId: string) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const api = communityApi(supabase);
  const router = useRouter();
  return useMutation({
    mutationFn: () => api.leave(communityId),
    onSuccess: () => {
      void router.navigate({ href: "/communities" });
    },
    onSettled: () => refreshCommunities(cache, user?.id ?? ""),
  });
}
