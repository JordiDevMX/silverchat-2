import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCommunity } from "@/features/communities/hooks/useCommunity";
import { useCommunityMembers } from "@/features/communities/hooks/useCommunityMembers";
import { useUpdateCommunityInfo } from "@/features/communities/hooks/useUpdateCommunityInfo";
import { communityDetails } from "@/features/communities/lib/communityDetails";
import { useChat } from "@/features/messages/hooks/useChat";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshChatSettings } from "../lib/cache";
export type GroupSettingsPatch = {
  name?: string;
  description?: string;
  avatar_url?: string;
  only_admins_can_add_members?: boolean;
  only_admins_can_share_link?: boolean;
  only_admins_can_send?: boolean;
  only_admins_can_edit_info?: boolean;
  require_admin_approval?: boolean;
};

export function useGroupSettings(chatId: string, context: "group" | "community" = "group") {
  const group = useChat(context === "group" ? chatId : "");
  const community = useCommunity(context === "community" ? chatId : "");
  const members = useCommunityMembers(context === "community" ? chatId : "");
  const update = useUpdateCommunityInfo(chatId);
  const cache = useQueryClient();
  const { user } = useAuth();
  const mutation = useMutation({
    mutationFn: async (patch: GroupSettingsPatch) => {
      const result = await supabase.rpc("update_group_info", {
        p_chat_id: chatId,
        p_name: patch.name,
        p_description: patch.description,
        p_avatar_url: patch.avatar_url,
        ...(patch.only_admins_can_add_members !== undefined
          ? { p_only_admins_can_add_members: patch.only_admins_can_add_members }
          : {}),
        ...(patch.only_admins_can_share_link !== undefined
          ? { p_only_admins_can_share_link: patch.only_admins_can_share_link }
          : {}),
        ...(patch.only_admins_can_send !== undefined
          ? { p_only_admins_can_send: patch.only_admins_can_send }
          : {}),
        ...(patch.only_admins_can_edit_info !== undefined
          ? { p_only_admins_can_edit_info: patch.only_admins_can_edit_info }
          : {}),
        ...(patch.require_admin_approval !== undefined
          ? { p_require_admin_approval: patch.require_admin_approval }
          : {}),
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
    save: async (patch: GroupSettingsPatch) => {
      if (context === "community") await update.mutateAsync(patch);
      else await mutation.mutateAsync(patch);
    },
    busy: context === "community" ? update.isPending : mutation.isPending,
  };
}
