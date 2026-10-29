import { useQuery } from "@tanstack/react-query";
import { allRows, chunks } from "@/features/chats/hooks/useChats";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { type ChatDetails, detailKey } from "../types";
export function useChat(chatId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: detailKey(user?.id ?? "", chatId),
    refetchInterval: 30000,
    queryFn: async (): Promise<ChatDetails | null> => {
      const [chat, members, requests] = await Promise.all([
        supabase.from("chats").select("*").eq("id", chatId).maybeSingle(),
        allRows((from, to) =>
          supabase
            .from("chat_members")
            .select("*")
            .eq("chat_id", chatId)
            .order("user_id")
            .range(from, to),
        ),
        supabase
          .from("chat_requests")
          .select("*")
          .eq("chat_id", chatId)
          .eq("status", "pending")
          .limit(1)
          .maybeSingle(),
      ]);
      if (chat.error) throw chat.error;
      if (requests.error) throw requests.error;
      const own = members.find((m) => m.user_id === (user?.id ?? ""));
      const request = requests.data ?? undefined;
      const pendingRecipient = request?.recipient_id === (user?.id ?? "");
      if ((!chat.data || !own) && !pendingRecipient) return null;
      if (chat.data?.status === "rejected") return null;
      const ids = [
        ...new Set([
          ...members.map((m) => m.user_id),
          ...(request ? [request.sender_id, request.recipient_id] : []),
        ]),
      ];
      const profiles = (
        await Promise.all(
          chunks(ids).map((part) =>
            allRows((from, to) =>
              supabase
                .from("profiles_visible")
                .select("*")
                .in("id", part)
                .order("id")
                .range(from, to),
            ),
          ),
        )
      ).flat();
      const other = profiles.find((p) => p.id !== (user?.id ?? ""));
      let communityName: string | undefined;
      if (chat.data?.community_id) {
        const c = await supabase
          .from("communities")
          .select("name")
          .eq("id", chat.data.community_id)
          .maybeSingle();
        if (c.error) throw c.error;
        communityName = c.data?.name;
      }
      return {
        id: chatId,
        status: chat.data?.status ?? "pending_request",
        createdBy: chat.data?.created_by ?? null,
        createdAt: chat.data?.created_at ?? "",
        description: chat.data?.description ?? null,
        otherUserId:
          chat.data?.type === "direct"
            ? (chat.data.direct_pair_key?.split("::").find((id) => id !== user?.id) ??
              other?.id ??
              undefined)
            : request
              ? pendingRecipient
                ? request.sender_id
                : request.recipient_id
              : (other?.id ?? undefined),
        type: chat.data?.type ?? "direct",
        name: chat.data?.name ?? other?.display_name ?? "SilverChat",
        avatar:
          chat.data?.type === "group" || chat.data?.type === "community_chat"
            ? chat.data.avatar_url
            : (chat.data?.avatar_url ?? other?.avatar_url ?? null),
        members: members.map((m) => ({ ...m, profile: profiles.find((p) => p.id === m.user_id) })),
        own,
        other,
        communityId: chat.data?.community_id ?? null,
        communityName,
        request,
        readOnly: pendingRecipient,
      };
    },
  });
}
