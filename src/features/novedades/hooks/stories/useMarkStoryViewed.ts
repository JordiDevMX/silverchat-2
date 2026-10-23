import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { StoryGroup } from "../../types";
export function useMarkStoryViewed() {
  const cache = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await supabase.rpc("mark_story_viewed", { p_story_id: id });
      if (r.error) throw r.error;
    },
    onSuccess: (_, id) =>
      cache.setQueryData<StoryGroup[]>(["stories", user?.id], (old) =>
        old?.map((g) => {
          const stories = g.stories.map((s) => (s.id === id ? { ...s, viewed: true } : s));
          return { ...g, stories, has_unwatched: stories.some((s) => !s.viewed) };
        }),
      ),
  });
}
