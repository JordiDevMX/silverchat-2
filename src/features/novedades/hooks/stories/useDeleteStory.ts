import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cleanupUploads } from "@/features/messages/lib/upload";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshNovedades } from "../../lib/cache";
import type { Story } from "../../types";
export function useDeleteStory() {
  const { user } = useAuth();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async (story: Story) => {
      const r = await supabase.rpc("delete_story", { p_story_id: story.id });
      if (r.error) throw r.error;
      await cleanupUploads([story.upload, story.thumbnail].filter((u) => !!u));
    },
    onSuccess: () => refreshNovedades(cache, user?.id ?? ""),
  });
}
