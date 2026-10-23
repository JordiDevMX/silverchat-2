import { useInfiniteQuery } from "@tanstack/react-query";
import { enrichMessages } from "@/features/messages/hooks/useMessages";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
export function useSharedMedia(chatId: string, type: "media" | "files", enabled = true) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["shared-media", user?.id, chatId, type],
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const result = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .in("type", type === "media" ? ["image", "video"] : ["file"])
        .is("deleted_at", null)
        .eq("deleted_for_everyone", false)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(pageParam, pageParam + 29);
      if (result.error) throw result.error;
      return enrichMessages(result.data ?? [], user?.id ?? "");
    },
    getNextPageParam: (last, pages) => (last.length === 30 ? pages.length * 30 : undefined),
  });
}
