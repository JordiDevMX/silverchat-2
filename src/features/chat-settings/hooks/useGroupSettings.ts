import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@/features/messages/hooks/useChat";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshChatSettings } from "../lib/cache";
export function useGroupSettings(chatId: string) {
  const chat = useChat(chatId);
  const cache = useQueryClient();
  const { user } = useAuth();
  const mutation = useMutation({
    mutationFn: async (patch: { name?: string; description?: string; avatar_url?: string }) => {
      const result = await supabase.rpc("update_group_info", {
        p_chat_id: chatId,
        p_name: patch.name,
        p_description: patch.description,
        p_avatar_url: patch.avatar_url,
      });
      if (result.error) throw result.error;
    },
    onSettled: () => refreshChatSettings(cache, user?.id ?? "", chatId),
  });
  return { chat, save: mutation.mutateAsync, busy: mutation.isPending };
}
