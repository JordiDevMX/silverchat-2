import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { detailKey, messageKey } from "../types";
export function useMarkAsRead(
  chatId: string,
  atBottom: boolean,
  lastId: string | undefined,
  unread: boolean,
  enabled: boolean,
) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const initial = useRef(true);
  const resumed = useRef(false);
  const [visible, setVisible] = useState(document.visibilityState === "visible");
  const [error, setError] = useState(false);
  useEffect(() => {
    const change = () => {
      resumed.current = document.visibilityState === "visible";
      setVisible(resumed.current);
    };
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useEffect(() => {
    if (!enabled || !visible || !atBottom || !unread || !lastId) return;
    let active = true;
    const timer = setTimeout(
      async () => {
        if (document.visibilityState !== "visible" || !active) return;
        const result = await supabase.rpc("mark_chat_as_read", { p_chat_id: chatId });
        if (!active) return;
        setError(!!result.error);
        if (!result.error) {
          initial.current = false;
          resumed.current = false;
          for (const key of [
            messageKey(user?.id ?? "", chatId),
            detailKey(user?.id ?? "", chatId),
            ["chats", user?.id ?? ""],
          ])
            void cache.invalidateQueries({ queryKey: key });
        }
      },
      resumed.current ? 0 : initial.current ? 1000 : 500,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [atBottom, cache, chatId, enabled, lastId, unread, user, visible]);
  return error;
}
