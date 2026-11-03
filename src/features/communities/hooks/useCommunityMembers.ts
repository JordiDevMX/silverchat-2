import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { allRows, chunks } from "@/features/chats/hooks/useChats";
import type { Profile } from "@/features/messages/types";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshCommunities } from "../lib/cache";
import { communityApi } from "../lib/communityApi";
export function useCommunityMembers(communityId: string) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["community-members", user?.id, communityId],
    enabled: !!user && !!communityId,
    staleTime: 30_000,
    queryFn: async () => {
      const rows = await allRows((from, to) =>
        supabase
          .from("community_members")
          .select("*")
          .eq("community_id", communityId)
          .order("user_id")
          .range(from, to),
      );
      const profiles = new Map<string, Profile>();
      for (const part of chunks(rows.map((row) => row.user_id))) {
        const result = await supabase.from("profiles_visible").select("*").in("id", part);
        if (result.error) throw result.error;
        for (const profile of result.data) if (profile.id) profiles.set(profile.id, profile);
      }
      return rows
        .map((row) => ({ ...row, profile: profiles.get(row.user_id) }))
        .sort(
          (a, b) =>
            Number(b.role === "admin") - Number(a.role === "admin") ||
            a.joined_at.localeCompare(b.joined_at) ||
            a.user_id.localeCompare(b.user_id),
        );
    },
  });
  const mutation = useMutation({
    mutationFn: (input: { action: "promote" | "demote" | "remove"; userId: string }) =>
      communityApi(supabase).member(communityId, input.userId, input.action),
    onSettled: () => refreshCommunities(cache, user?.id ?? ""),
  });
  return { ...query, run: mutation.mutateAsync, busy: mutation.isPending };
}
