import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
export function useStoryViewers(storyId: string, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["story-viewers", user?.id, storyId],
    enabled,
    refetchOnMount: "always",
    queryFn: async () => {
      const r = await supabase.rpc("get_story_viewers", { p_story_id: storyId });
      if (r.error) throw r.error;
      return r.data;
    },
  });
}
