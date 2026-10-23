import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
export function useChannelInfo(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["channel-info", user?.id, id],
    refetchInterval: 30000,
    queryFn: async () => {
      const [channel, follow] = await Promise.all([
        supabase.from("channels").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("channel_followers")
          .select("*")
          .eq("channel_id", id)
          .eq("user_id", user?.id ?? "")
          .maybeSingle(),
      ]);
      if (channel.error) throw channel.error;
      if (follow.error) throw follow.error;
      return channel.data ? { channel: channel.data, follow: follow.data } : null;
    },
  });
}
