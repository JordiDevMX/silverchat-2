import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunity } from "@/features/communities/hooks/useCommunity";
import { useCommunityMembers } from "@/features/communities/hooks/useCommunityMembers";
import { useUpdateCommunityInfo } from "@/features/communities/hooks/useUpdateCommunityInfo";
import { communityDetails } from "@/features/communities/lib/communityDetails";
import { useChat } from "@/features/messages/hooks/useChat";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshChatSettings } from "../lib/cache";
export function useGroupSettings(chatId: string, context: "group" | "community" = "group") {
  const group = useChat(context === "group" ? chatId : "");
  const community = useCommunity(context === "community" ? chatId : "");
  const members = useCommunityMembers(context === "community" ? chatId : "");
  const update = useUpdateCommunityInfo(chatId);
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
  const chat =
    context === "group"
      ? group
      : {
          ...community,
          data: community.data
            ? communityDetails(community.data, members.data ?? [], user?.id ?? "")
            : null,
        };
  return {
    chat,
    community: community.data,
    save: async (patch: { name?: string; description?: string; avatar_url?: string }) => {
      if (context === "community") await update.mutateAsync(patch);
      else await mutation.mutateAsync(patch);
    },
    busy: context === "community" ? update.isPending : mutation.isPending,
  };
}
