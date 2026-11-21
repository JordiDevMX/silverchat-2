import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { allRows } from "@/features/chats/hooks/useChats";
import {
  CHAT_QUERY_OPTIONS,
  createReconnectRefresh,
} from "@/features/messages/lib/chatQueryPolicy";
import { getOutboxMessages } from "@/features/messages/lib/outbox";
import {
  type Cursor,
  type Message,
  type MessageRow,
  messageKey,
  outboxKey,
  type Upload,
} from "@/features/messages/types";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";

export function useChannelMessages(id: string, enabled = true) {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const cache = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: messageKey(uid, id),
    enabled,
    ...CHAT_QUERY_OPTIONS,
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam }) => {
      const r = await supabase.rpc("get_channel_messages", {
        p_channel_id: id,
        ...(pageParam ? { p_before_at: pageParam.at, p_before_id: pageParam.id } : {}),
      });
      if (r.error) throw r.error;
      const rawRows = (r.data ?? []) as MessageRow[];
      const uploadIds = [
        ...new Set(
          rawRows.flatMap((m) =>
            [m.file_upload_id, m.media_thumbnail_upload_id].filter((u): u is string => !!u),
          ),
        ),
      ];
      const mediaRows = uploadIds.length
        ? await allRows((from, to) =>
            supabase
              .from("message_media_public")
              .select("*")
              .in("id", uploadIds)
              .order("id")
              .range(from, to),
          )
        : [];
      const uploads: Upload[] = mediaRows
        .filter(
          (
            u,
          ): u is typeof u & {
            id: string;
            bucket: string;
            path: string;
            mime_type: string;
            original_filename: string;
            size_bytes: number;
            created_at: string;
            status: NonNullable<typeof u.status>;
          } =>
            !!u.id &&
            !!u.bucket &&
            !!u.path &&
            !!u.mime_type &&
            !!u.original_filename &&
            u.size_bytes !== null &&
            !!u.created_at &&
            !!u.status,
        )
        .map((u) => ({ ...u }));

      const rows: Message[] = rawRows.map((m) => {
        const rawUpload = uploads.find((u) => u.id === m.file_upload_id);
        const rawThumb = uploads.find((u) => u.id === m.media_thumbnail_upload_id);
        const ctx = { channelId: id, messageId: m.id };
        return {
          ...m,
          upload: rawUpload ? { ...rawUpload, ...ctx } : undefined,
          thumbnail: rawThumb ? { ...rawThumb, ...ctx } : undefined,
          receipts: [],
          reactions: [],
          unreadForMe: false,
        };
      });
      const last = rawRows.at(-1);
      return {
        rows,
        cursor: rawRows.length === 50 && last ? { at: last.created_at, id: last.id } : undefined,
      };
    },
    getNextPageParam: (p) => p.cursor,
  });
  const outbox = useQuery<Message[]>({
    queryKey: outboxKey(uid, id),
    queryFn: () => (uid ? getOutboxMessages(uid, id) : []),
    initialData: () => (uid ? getOutboxMessages(uid, id) : []),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  useEffect(() => {
    if (!enabled || !uid) return;
    const refresh = () => {
      void cache.invalidateQueries({ queryKey: messageKey(uid, id) });
      void cache.invalidateQueries({ queryKey: ["channel-info", uid, id] });
      void cache.invalidateQueries({ queryKey: ["channels", uid] });
    };
    const channel = supabase
      .channel(`channel:${uid}:${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channel_feed_events",
          filter: `channel_id=eq.${id}`,
        },
        refresh,
      )
      .subscribe(createReconnectRefresh(refresh));
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
