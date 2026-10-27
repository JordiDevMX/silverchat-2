import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { MessageRequest } from "../types";
import { allRows, chunks } from "./useChats";
export function useMessageRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["message-requests", user?.id],
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<MessageRequest[]> => {
      const rows = await allRows((from, to) =>
        supabase
          .from("chat_requests")
          .select("id,sender_id,chat_id,created_at")
          .eq("recipient_id", user?.id ?? "")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
      );
      const ids = [...new Set(rows.map((r) => r.sender_id))];
      // Query the privacy view separately: it is not an FK relationship.
      // Pending recipients may read messages but cannot SELECT the parent chat.
      // Fetch the first visible message since THIS request, not the last message
      // or a preview from a previous rejected request in the same direct chat.
      const [profiles, messages] = await Promise.all([
        Promise.all(
          chunks(ids).map((part) =>
            allRows((from, to) =>
              supabase
                .from("profiles_visible")
                .select("id,username,display_name,avatar_url")
                .in("id", part)
                .order("id")
                .range(from, to),
            ),
          ),
        ).then((x) => x.flat()),
        Promise.all(
          chunks(rows).map((part) =>
            allRows((from, to) =>
              supabase
                .from("messages")
                .select("id,chat_id,content,type,deleted_for_everyone,created_at")
                .in(
                  "chat_id",
                  part.map((r) => r.chat_id),
                )
                .gte(
                  "created_at",
                  new Date(Math.min(...part.map((r) => Date.parse(r.created_at)))).toISOString(),
                )
                .order("created_at")
                .order("id")
                .range(from, to),
            ),
          ),
        ).then((x) => x.flat()),
      ]);
      return rows.map((r) => {
        const p = profiles.find((p) => p.id === r.sender_id);
        const first = messages.find(
          (m) => m.chat_id === r.chat_id && Date.parse(m.created_at) >= Date.parse(r.created_at),
        );
        return {
          id: r.id,
          chatId: r.chat_id,
          senderId: r.sender_id,
          name: p?.display_name ?? "Unavailable contact",
          username: p?.username ?? "",
          avatarUrl: p?.avatar_url ?? null,
          preview: first
            ? first.deleted_for_everyone
              ? "This message was deleted"
              : first.content || (first.type === "text" ? null : "Attachment")
            : null,
        };
      });
    },
  });
}
export function useRequestMutation() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const run = async (request: MessageRequest, accept: boolean) => {
    if (!user || busy) return;
    setBusy(true);
    const key = ["message-requests", user.id];
    await cache.cancelQueries({ queryKey: key });
    cache.setQueryData<MessageRequest[]>(key, (old) => old?.filter((r) => r.id !== request.id));
    try {
      const r = await supabase.rpc(accept ? "accept_chat_request" : "reject_chat_request", {
        p_request_id: request.id,
      });
      if (r.error) throw r.error;
    } catch (error) {
      cache.setQueryData<MessageRequest[]>(key, (old) => [
        ...(old ?? []).filter((r) => r.id !== request.id),
        request,
      ]);
      throw error;
    } finally {
      setBusy(false);
      await Promise.all([
        ...["message-requests", "chats"].map((k) =>
          cache.invalidateQueries({ queryKey: [k, user.id] }),
        ),
        ...[
          "direct-contacts",
          "contacts",
          "user-search",
          "contact-profile",
          "chat-members",
          "chat-messages",
          "chat-detail",
          "avatar-url",
        ].map((k) => cache.invalidateQueries({ queryKey: [k] })),
      ]);
    }
  };
  return { run, busy };
}
