import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { enrichMessages } from "./useMessages";
export function usePinnedMessages(chatId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pinned", user?.id, chatId],
    refetchInterval: 30000,
    queryFn: async () => {
      const result = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .eq("is_pinned_in_chat", true)
        .eq("deleted_for_everyone", false)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(3);
      if (result.error) throw result.error;
      return enrichMessages(result.data ?? [], user?.id ?? "");
    },
  });
}
