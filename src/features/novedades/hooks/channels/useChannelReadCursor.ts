import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
export function useChannelReadCursor(channelId: string, following: boolean) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [readError, setReadError] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  useEffect(() => {
    void readAttempt;
    if (!following || !user?.id) return;
    let disposed = false;
    void (async () => {
      const r = await supabase
        .from("channel_followers")
        .update({ last_read_at: new Date().toISOString() })
        .eq("channel_id", channelId)
        .eq("user_id", user.id);
      if (!disposed) setReadError(!!r.error);
      if (!r.error) void cache.invalidateQueries({ queryKey: ["channels", user.id] });
    })();
    return () => {
      disposed = true;
    };
  }, [following, user?.id, channelId, cache, readAttempt]);
  return { readError, retryRead: () => setReadAttempt((n) => n + 1) };
}
