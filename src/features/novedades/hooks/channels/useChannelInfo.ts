import { useQuery } from "@tanstack/react-query";
import { CHAT_QUERY_OPTIONS } from "@/features/messages/lib/chatQueryPolicy";
import { resolveChannelRole } from "@/features/roles/lib/permissions";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { type ChannelStaffRole, mapPublicChannelRow } from "../../types";

export function useChannelInfo(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["channel-info", user?.id, id],
    ...CHAT_QUERY_OPTIONS,
    queryFn: async () => {
      const [channel, follow, viewerCtx] = await Promise.all([
        supabase.from("channels_public").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("channel_followers")
          .select("*")
          .eq("channel_id", id)
          .eq("user_id", user?.id ?? "")
          .maybeSingle(),
        user
          ? supabase.rpc("get_channel_viewer_context", { p_channel_id: id })
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (channel.error) throw channel.error;
      if (follow.error) throw follow.error;
      if (!channel.data) return null;
      const ctx = viewerCtx.data as { viewer_role?: string | null } | null;
      const staffRole: ChannelStaffRole =
        ctx?.viewer_role === "owner" || ctx?.viewer_role === "admin" ? ctx.viewer_role : null;
      const role = resolveChannelRole(staffRole, Boolean(follow.data));
      return {
        channel: mapPublicChannelRow(channel.data),
        follow: follow.data,
        staffRole,
        role,
      };
    },
  });
}
