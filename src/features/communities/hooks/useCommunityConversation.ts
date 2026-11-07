import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useChat } from "@/features/messages/hooks/useChat";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
export function useCommunityConversation(communityId: string, chatId: string) {
  const chat = useChat(chatId);
  const { user } = useAuth();
  const cache = useQueryClient();
  const valid = chat.data?.type === "community_chat" && chat.data.communityId === communityId;
  const [readError, setReadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    void attempt;
    if (!valid || !user) return;
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        const result = await supabase.rpc("mark_chat_as_read", { p_chat_id: chatId });
        if (active) setReadError(!!result.error);
        if (!result.error) {
          void cache.invalidateQueries({ queryKey: ["community-chats", user.id, communityId] });
          void cache.invalidateQueries({ queryKey: ["chats", user.id] });
        }
      })();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [valid, user, chatId, communityId, cache, attempt]);
  return { chat, valid, readError, retryRead: () => setAttempt((a) => a + 1) };
}
