import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
export function useCommunity(communityId: string) {
  const { user } = useAuth();
  const router = useRouter();
  const query = useQuery({
    queryKey: ["community", user?.id, communityId],
    enabled: !!user && !!communityId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const result = await supabase
        .from("community_members")
        .select("role,joined_at,community:communities!inner(*)")
        .eq("user_id", user?.id ?? "")
        .eq("community_id", communityId)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data
        ? { ...result.data.community, role: result.data.role, joined_at: result.data.joined_at }
        : null;
    },
  });
  useEffect(() => {
    if (communityId && query.isSuccess && !query.data)
      void router.navigate({ href: "/communities", replace: true });
  }, [communityId, query.isSuccess, query.data, router]);
  return query;
}
