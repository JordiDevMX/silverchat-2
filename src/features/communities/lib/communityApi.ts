import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/database.ts";

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
    createChat: (id: string, input: { name: string; description?: string }) =>
      result(
        client.rpc("create_community_chat", {
          p_community_id: id,
          p_name: input.name.trim(),
          p_description: input.description ?? "",
        }),
      ),
    leave: (id: string) => result(client.rpc("leave_community", { p_community_id: id })),
    mute: (id: string, until: string | null) =>
      result(client.rpc("mute_community", { p_community_id: id, p_muted_until: until })),
    update: (id: string, patch: CommunityInfoPatch) =>
      result(
        client.rpc("update_community_info", {
          p_community_id: id,
          p_name: patch.name,
          p_description: patch.description,
          p_avatar_url: patch.avatar_url,
        }),
      ),
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
    join: (id: string, userId: string) =>
      result(client.rpc("join_community", { p_community_id: id, p_user_id: userId })),
  };
}
