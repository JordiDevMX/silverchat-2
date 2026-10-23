import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { enrichMessages } from "@/features/messages/hooks/useMessages";
import { type Cursor, type Message, messageKey, outboxKey } from "@/features/messages/types";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
export function useChannelMessages(id: string, enabled: boolean) {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const cache = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: messageKey(uid, id),
    enabled,
    refetchInterval: 30000,
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("messages")
        .select("*")
        .eq("channel_id", id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(50);
      if (pageParam)
        q = q.or(
          `created_at.lt.${pageParam.at},and(created_at.eq.${pageParam.at},id.lt.${pageParam.id})`,
        );
      const r = await q;
      if (r.error) throw r.error;
      const last = r.data.at(-1);
      return {
        rows: await enrichMessages(r.data, uid),
        cursor: r.data.length === 50 && last ? { at: last.created_at, id: last.id } : undefined,
      };
    },
    getNextPageParam: (p) => p.cursor,
  });
  const outbox = useQuery<Message[]>({
    queryKey: outboxKey(uid, id),
    queryFn: () => [],
    initialData: [],
    staleTime: Infinity,
    gcTime: Infinity,
  });
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`channel:${uid}:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${id}` },
        () => {
          void cache.invalidateQueries({ queryKey: messageKey(uid, id) });
          void cache.invalidateQueries({ queryKey: ["channels", uid] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, uid, cache, enabled]);
  const server = [
    ...new Map((query.data?.pages.flatMap((p) => p.rows) ?? []).map((m) => [m.id, m])).values(),
  ];
  return {
    ...query,
    messages: [
      ...server,
      ...outbox.data.filter((m) => !server.some((s) => s.id === m.clientId)),
    ].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)),
    firstUnread: undefined,
    unreadLoading: false,
    unreadError: null,
    refetchUnread: async () => {},
  };
}
