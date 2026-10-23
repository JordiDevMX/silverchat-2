import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
import { refreshNovedades } from "../../lib/cache";
export function useCreateStory() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const storyId = useRef(crypto.randomUUID());
  return useMutation({
    mutationFn: async (args: Database["public"]["Functions"]["create_story"]["Args"]) => {
      const r = await supabase.rpc("create_story", { ...args, p_story_id: storyId.current });
      if (r.error) throw r.error;
      return r.data;
    },
    onSuccess: () => {
      storyId.current = crypto.randomUUID();
      return refreshNovedades(cache, user?.id ?? "");
    },
  });
}
