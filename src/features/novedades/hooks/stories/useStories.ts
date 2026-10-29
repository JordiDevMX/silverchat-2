import { useQuery } from "@tanstack/react-query";
import { allRows, chunks } from "@/features/chats/hooks/useChats";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { Story, StoryGroup } from "../../types";
export function useStories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["stories", user?.id],
    // Focus refetches stay disabled to prevent request bursts when switching windows.
    refetchOnWindowFocus: false,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const rows = await allRows((from, to) =>
        supabase
          .from("stories")
          .select("*")
          .gt("expires_at", new Date().toISOString())
          .order("created_at")
          .order("id")
          .range(from, to),
      );
      if (!rows.length) return [] as StoryGroup[];
      const owners = [...new Set(rows.map((s) => s.user_id))],
        ids = rows.map((s) => s.id),
        uploadIds = rows.flatMap((s) =>
          [s.file_upload_id, s.media_thumbnail_upload_id].filter((id): id is string => !!id),
        );
      const [profiles, uploads, views] = await Promise.all([
        Promise.all(
          chunks(owners).map((ids) =>
            allRows((from, to) =>
              supabase
                .from("profiles_visible")
                .select("*")
                .in("id", ids)
                .order("id")
                .range(from, to),
            ),
          ),
        ).then((p) => p.flat()),
        Promise.all(
          chunks(uploadIds).map((ids) =>
            allRows((from, to) =>
              supabase.from("file_uploads").select("*").in("id", ids).order("id").range(from, to),
            ),
          ),
        ).then((p) => p.flat()),
        Promise.all(
          chunks(ids).map((ids) =>
            allRows((from, to) =>
              supabase
                .from("story_views")
                .select("story_id")
                .eq("viewer_id", user?.id ?? "")
                .in("story_id", ids)
                .order("story_id")
                .range(from, to),
            ),
          ),
        ).then((p) => p.flat()),
      ]);
      const seen = new Set(views.map((v) => v.story_id));
      return owners.map((id) => {
        const stories: Story[] = rows
          .filter((s) => s.user_id === id)
          .map((s) => ({
            ...s,
            profile: profiles.find((p) => p.id === id),
            upload: uploads.find((u) => u.id === s.file_upload_id),
            thumbnail: uploads.find((u) => u.id === s.media_thumbnail_upload_id),
            viewed: seen.has(s.id),
          }));
        return {
          user_id: id,
          profile: profiles.find((p) => p.id === id),
          stories,
          last_created_at: stories.at(-1)?.created_at ?? "",
          has_unwatched: stories.some((s) => !s.viewed),
        };
      });
    },
  });
}
