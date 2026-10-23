import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@/features/messages/hooks/useChat";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshChatSettings } from "../lib/cache";
export function useGroupMembers(chatId: string) {
  const chat = useChat(chatId);
  const cache = useQueryClient();
  const { user } = useAuth();
  const mutation = useMutation({
    mutationFn: async ({
      action,
      userId,
    }: {
      action: "remove" | "promote" | "demote";
      userId: string;
    }) => {
      const result = await supabase.rpc(
        action === "remove"
          ? "remove_chat_member"
          : action === "promote"
            ? "promote_chat_admin"
            : "demote_chat_admin",
        { p_chat_id: chatId, p_user_id: userId },
      );
      if (result.error) throw result.error;
    },
    onSettled: () => refreshChatSettings(cache, user?.id ?? "", chatId),
  });
  return {
    chat,
    members: [...(chat.data?.members ?? [])].sort(
      (a, b) =>
        Number(b.role === "admin") - Number(a.role === "admin") ||
        a.joined_at.localeCompare(b.joined_at) ||
        a.user_id.localeCompare(b.user_id),
    ),
    run: mutation.mutateAsync,
    busy: mutation.isPending,
  };
}
