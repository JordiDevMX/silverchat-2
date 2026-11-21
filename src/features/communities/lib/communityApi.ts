import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/database.ts";
import type { CommunityWritePolicy } from "../../roles/types.ts";

type Client = Pick<SupabaseClient<Database>, "rpc">;
export type CommunityInfoPatch = { name?: string; description?: string; avatar_url?: string };
export function communityApi(client: Client) {
  async function result<T>(request: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
    const response = await request;
    if (response.error) throw response.error;
    return response.data;
  }
  return {
    create: (input: { name: string; description?: string }) =>
      result(
        client.rpc("create_community", {
          p_name: input.name.trim(),
          p_description: input.description ?? "",
        }),
      ),
    createChat: (
      id: string,
      input: { name: string; description?: string; writePolicy?: CommunityWritePolicy },
    ) =>
      result(
        client.rpc("create_community_chat", {
          p_community_id: id,
          p_name: input.name.trim(),
          p_description: input.description ?? "",
          ...(input.writePolicy ? { p_write_policy: input.writePolicy } : {}),
        }),
      ),
    leave: (id: string) => result(client.rpc("leave_community", { p_community_id: id })),
    mute: (id: string, until: string | null) =>
      result(
        // `p_muted_until` is nullable in SQL (NULL clears the mute), but the type
        // generator exposes function arguments as non-nullable.
        client.rpc("mute_community", { p_community_id: id, p_muted_until: until as string }),
      ),
    update: (id: string, patch: CommunityInfoPatch) =>
      result(
        client.rpc("update_community_info", {
          p_community_id: id,
          p_name: patch.name,
          p_description: patch.description,
          p_avatar_url: patch.avatar_url,
        }),
      ),
    updateChatInfo: (
      chatId: string,
      patch: CommunityInfoPatch & { writePolicy?: CommunityWritePolicy },
    ) =>
      result(
        client.rpc("update_community_chat_info", {
          p_chat_id: chatId,
          p_name: patch.name,
          p_description: patch.description,
          p_avatar_url: patch.avatar_url,
          ...(patch.writePolicy ? { p_write_policy: patch.writePolicy } : {}),
        }),
      ),
    deleteChat: (chatId: string) =>
      result(client.rpc("delete_community_chat", { p_chat_id: chatId })),
    delete: (id: string) => result(client.rpc("delete_community", { p_community_id: id })),
    member: (id: string, userId: string, action: "promote" | "demote" | "remove") =>
      result(
        client.rpc(
          action === "promote"
            ? "promote_community_admin"
            : action === "demote"
              ? "demote_community_admin"
              : "remove_community_member",
          { p_community_id: id, p_user_id: userId },
        ),
      ),
    appointModerator: (id: string, userId: string) =>
      result(client.rpc("appoint_community_moderator", { p_community_id: id, p_user_id: userId })),
    removeModerator: (id: string, userId: string) =>
      result(client.rpc("remove_community_moderator", { p_community_id: id, p_user_id: userId })),
    transferOwnership: (id: string, newOwnerId: string) =>
      result(
        client.rpc("transfer_community_ownership", {
          p_community_id: id,
          p_new_owner_id: newOwnerId,
        }),
      ),
    silenceMember: (id: string, userId: string, until: string, reason?: string) =>
      result(
        client.rpc("silence_community_member", {
          p_community_id: id,
          p_user_id: userId,
          p_silenced_until: until,
          ...(reason ? { p_reason: reason } : {}),
        }),
      ),
    unsilenceMember: (id: string, userId: string) =>
      result(client.rpc("unsilence_community_member", { p_community_id: id, p_user_id: userId })),
    expelMember: (id: string, userId: string, reason?: string, deleteMessages = false) =>
      result(
        client.rpc("expel_community_member", {
          p_community_id: id,
          p_user_id: userId,
          ...(reason ? { p_reason: reason } : {}),
          p_delete_messages: deleteMessages,
        }),
      ),
    unbanMember: (id: string, userId: string) =>
      result(client.rpc("unban_community_member", { p_community_id: id, p_user_id: userId })),
    setAnnouncementWriter: (id: string, userId: string, grant: boolean) =>
      result(
        client.rpc("set_announcement_writer", {
          p_community_id: id,
          p_user_id: userId,
          p_grant: grant,
        }),
      ),
    moderateDeleteMessage: (messageId: string) =>
      result(client.rpc("moderate_delete_community_message", { p_message_id: messageId })),
    join: (id: string, userId: string) =>
      result(client.rpc("join_community", { p_community_id: id, p_user_id: userId })),
  };
}
