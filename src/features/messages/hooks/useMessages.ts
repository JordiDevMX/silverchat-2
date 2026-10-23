import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { allRows } from "@/features/chats/hooks/useChats";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { type Cursor, type Message, type MessageRow, messageKey, outboxKey } from "../types";
export async function enrichMessages(rows: MessageRow[], userId: string): Promise<Message[]> {
  if (!rows.length) return [];
  const ids = rows.map((m) => m.id);
  const replyIds = rows.flatMap((m) => (m.reply_to_message_id ? [m.reply_to_message_id] : []));
  const replies = replyIds.length
    ? await allRows((from, to) =>
        supabase.from("messages").select("*").in("id", replyIds).order("id").range(from, to),
      )
    : [];
  const profileIds = [
    ...new Set([...rows, ...replies].flatMap((m) => (m.sender_id ? [m.sender_id] : []))),
  ];
  const uploadIds = rows.flatMap((m) =>
    [m.file_upload_id, m.media_thumbnail_upload_id].filter((id): id is string => !!id),
  );
  const [profiles, uploads, receipts, reactions] = await Promise.all([
    profileIds.length
      ? allRows((from, to) =>
          supabase
            .from("profiles_visible")
            .select("*")
            .in("id", profileIds)
            .order("id")
            .range(from, to),
        )
      : [],
    uploadIds.length
      ? allRows((from, to) =>
          supabase.from("file_uploads").select("*").in("id", uploadIds).order("id").range(from, to),
        )
      : [],
    allRows((from, to) =>
      supabase
        .from("message_receipts")
        .select("*")
        .in("message_id", ids)
        .order("message_id")
        .order("user_id")
        .range(from, to),
    ),
    allRows((from, to) =>
      supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", ids)
        .order("id")
        .range(from, to),
    ),
  ]);
  return rows.map((m) => {
    const reply = replies.find((r) => r.id === m.reply_to_message_id && r.chat_id === m.chat_id);
    return {
      ...m,
      sender: profiles.find((p) => p.id === m.sender_id),
      upload: uploads.find((u) => u.id === m.file_upload_id),
      thumbnail: uploads.find((u) => u.id === m.media_thumbnail_upload_id),
      reply,
      replySender: profiles.find((p) => p.id === reply?.sender_id),
      receipts: receipts.filter((r) => r.message_id === m.id),
      reactions: m.deleted_for_everyone ? [] : reactions.filter((r) => r.message_id === m.id),
      unreadForMe: receipts.some(
        (r) => r.message_id === m.id && r.user_id === userId && !r.read_at,
      ),
    };
  });
}
export function useMessages(chatId: string) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const query = useInfiniteQuery({
    queryKey: messageKey(userId, chatId),
    initialPageParam: null as Cursor,
    refetchInterval: 30000,
    queryFn: async ({ pageParam }) => {
      const result = await supabase.rpc("get_chat_messages", {
        p_chat_id: chatId,
        ...(pageParam ? { p_before_at: pageParam.at, p_before_id: pageParam.id } : {}),
      });
      if (result.error) throw result.error;
      const rows = result.data ?? [];
      const last = rows.at(-1);
      return {
        rows: await enrichMessages(rows, userId),
        cursor: rows.length === 50 && last ? { at: last.created_at, id: last.id } : undefined,
      };
    },
    getNextPageParam: (page) => page.cursor,
  });
  const outbox = useQuery<Message[]>({
    queryKey: outboxKey(userId, chatId),
    queryFn: () => [],
    initialData: [],
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const earliest = useQuery({
    queryKey: ["first-unread", userId, chatId],
    staleTime: Infinity,
    queryFn: async () => {
      const r = await supabase
        .from("message_receipts")
        .select("message_id,message:messages!inner(chat_id,created_at)")
        .eq("user_id", userId)
        .is("read_at", null)
        .eq("message.chat_id", chatId)
        .order("message(created_at)")
        .order("message_id")
        .limit(1)
        .maybeSingle();
      if (r.error) throw r.error;
      return r.data?.message_id ?? null;
    },
  });
  const server = [
    ...new Map((query.data?.pages.flatMap((p) => p.rows) ?? []).map((m) => [m.id, m])).values(),
  ];
  const messages = [
    ...server,
    ...outbox.data.filter((m) => !server.some((s) => s.id === m.clientId)),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  return {
    ...query,
    messages,
    firstUnread: earliest.data,
    unreadLoading: earliest.isPending,
    unreadError: earliest.error,
    refetchUnread: earliest.refetch,
  };
}
