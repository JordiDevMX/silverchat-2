import { useQuery } from "@tanstack/react-query";
import { allRows, chunks } from "@/features/chats/hooks/useChats";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { ChatDetails } from "../types";
export function useChatPresence(chat: ChatDetails) {
  const { user } = useAuth();
  const ids =
    chat.type === "direct"
      ? [chat.other?.id].filter((id): id is string => !!id)
      : chat.members.map((m) => m.user_id);
  return useQuery({
    queryKey: ["chat-presence", user?.id ?? "", chat.id, ids],
    enabled: ids.length > 0,
    refetchInterval: chat.type === "direct" ? 30000 : 60000,
    queryFn: async () =>
      (
        await Promise.all(
          chunks(ids).map((part) =>
            allRows((from, to) =>
              supabase
                .from("profiles_visible")
                .select("id,last_seen_at")
                .in("id", part)
                .order("id")
                .range(from, to),
            ),
          ),
        )
      ).flat(),
  });
}
