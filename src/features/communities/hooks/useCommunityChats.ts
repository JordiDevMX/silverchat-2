import { useQuery } from "@tanstack/react-query";
import { allRows, chunks } from "@/features/chats/hooks/useChats";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { orderCommunityChats } from "../lib/communityActions";
export function useCommunityChats(communityId: string, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["community-chats", user?.id, communityId],
    enabled: !!user && !!communityId && enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const rows = await allRows((from, to) =>
        supabase
          .from("chat_members")
          .select("*,chat:chats!chat_members_chat_id_fkey!inner(*)")
          .eq("user_id", user?.id ?? "")
          .eq("chat.community_id", communityId)
          .eq("chat.type", "community_chat")
          .order("chat_id")
          .range(from, to),
      );
      const unread = new Map<string, number>();
      const hidden = new Set<string>();
      // Bounded batches, never one unread request per chat or avatar signing per row.
      for (const part of chunks(rows.map((row) => row.chat_id))) {
        const receipts = await allRows((from, to) =>
          supabase
            .from("message_receipts")
            .select("message_id,messages!inner(chat_id)")
            .eq("user_id", user?.id ?? "")
            .is("read_at", null)
            .in("messages.chat_id", part)
            .order("message_id")
            .range(from, to),
        );
        for (const row of receipts)
          if (row.messages.chat_id)
            unread.set(row.messages.chat_id, (unread.get(row.messages.chat_id) ?? 0) + 1);
      }
      for (const part of chunks(
        rows.flatMap((row) => (row.chat.last_message_id ? [row.chat.last_message_id] : [])),
      )) {
        const deletions = await allRows((from, to) =>
          supabase
            .from("message_deletions")
            .select("message_id")
            .eq("user_id", user?.id ?? "")
            .in("message_id", part)
            .order("message_id")
            .range(from, to),
        );
        for (const row of deletions) hidden.add(row.message_id);
      }
      return orderCommunityChats(
        rows.map(({ chat, ...membership }) => ({
          ...chat,
          last_message_preview:
            chat.last_message_id && hidden.has(chat.last_message_id)
              ? null
              : chat.last_message_preview,
          membership,
          unreadCount: unread.get(chat.id) ?? 0,
        })),
      );
    },
  });
}
