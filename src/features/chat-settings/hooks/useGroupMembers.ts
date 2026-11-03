import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunityMembers } from "@/features/communities/hooks/useCommunityMembers";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshChatSettings } from "../lib/cache";
import { useGroupSettings } from "./useGroupSettings";
export function useGroupMembers(chatId: string, context: "group" | "community" = "group") {
  const { chat } = useGroupSettings(chatId, context);
  const community = useCommunityMembers(context === "community" ? chatId : "");
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
    membersQuery: context === "community" ? community : chat,
    members: [...(chat.data?.members ?? [])].sort(
      (a, b) =>
        Number(b.role === "admin") - Number(a.role === "admin") ||
        a.joined_at.localeCompare(b.joined_at) ||
        a.user_id.localeCompare(b.user_id),
    ),
    run: context === "community" ? community.run : mutation.mutateAsync,
    busy: context === "community" ? community.busy : mutation.isPending,
  };
}
