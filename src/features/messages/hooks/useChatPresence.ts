import { useQuery } from "@tanstack/react-query";
import { allRows, chunks } from "@/features/chats/hooks/useChats";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { getPresenceTargetIds, PRESENCE_QUERY_OPTIONS } from "../lib/chatQueryPolicy";
import type { ChatDetails } from "../types";
export function useChatPresence(chat: ChatDetails) {
  const { user } = useAuth();
  const ids = getPresenceTargetIds(chat);
  return useQuery({
    queryKey: ["chat-presence", user?.id ?? "", chat.id, ids],
    enabled: ids.length > 0,
    ...PRESENCE_QUERY_OPTIONS,
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
