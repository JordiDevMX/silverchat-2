import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshChatSettings } from "../lib/cache";
export function useClearChat(chatId: string) {
  const { user } = useAuth();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await supabase.rpc("clear_chat_for_me", { p_chat_id: chatId });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => refreshChatSettings(cache, user?.id ?? "", chatId),
  });
}
