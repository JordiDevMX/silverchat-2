import { useQuery } from "@tanstack/react-query";
import { CHAT_QUERY_OPTIONS } from "@/features/messages/lib/chatQueryPolicy";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { directPairKey } from "../lib/chatActions";
export function useContactProfile(userId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["contact-profile", user?.id, userId],
    ...CHAT_QUERY_OPTIONS,
    queryFn: async () => {
      const [profile, chat] = await Promise.all([
        supabase.from("profiles_visible").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("chats")
          .select("id,status,type")
          .eq("type", "direct")
          .eq("direct_pair_key", directPairKey(userId, user?.id ?? ""))
          .maybeSingle(),
      ]);
      if (profile.error) throw profile.error;
      if (chat.error) throw chat.error;
      return { profile: profile.data, chat: chat.data };
    },
  });
}
