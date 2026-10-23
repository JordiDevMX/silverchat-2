import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { detailKey, messageKey } from "../types";
export function useRealtimeMessages(chatId: string) {
  const { user } = useAuth();
  const cache = useQueryClient();
  useEffect(() => {
    const userId = user?.id ?? "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        for (const key of [
          messageKey(userId, chatId),
          detailKey(userId, chatId),
          ["chats", userId],
        ])
          void cache.invalidateQueries({ queryKey: key });
      }, 100);
    };
    const refreshVisible = (payload: { new: unknown; old: unknown }) => {
      const row = (
        payload.new && typeof payload.new === "object" && "message_id" in payload.new
          ? payload.new
          : payload.old
      ) as { message_id?: string };
      const loaded = cache.getQueryData<{ pages: { rows: { id: string }[] }[] }>(
        messageKey(userId, chatId),
      );
      if (
        !row.message_id ||
        loaded?.pages.some((page) => page.rows.some((message) => message.id === row.message_id))
      )
        refresh();
    };
    const channel = supabase
      .channel(`conversation:${userId}:${chatId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_receipts" },
        refreshVisible,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        refreshVisible,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_members", filter: `chat_id=eq.${chatId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_requests", filter: `chat_id=eq.${chatId}` },
        refresh,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [cache, chatId, user]);
}
