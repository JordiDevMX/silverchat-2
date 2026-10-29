import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-provider";
import { getInitials } from "@/lib/avatar";
import { supabase } from "@/lib/supabase";
import type { Chat } from "../types";
import { orderChats, receiptStatus } from "../utils/computeChatDisplay";

export const chatKey = (userId: string) => ["chats", userId] as const;
export function chunks<T>(items: T[], size = 50): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );
}
// PostgREST caps a response at 1,000 rows; paginate batched child queries too.
export async function allRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await fetchPage(from, from + 499);
    if (result.error) throw result.error;
    rows.push(...(result.data ?? []));
    if (!result.data || result.data.length < 500) return rows;
  }
}
export async function fetchChats(userId: string): Promise<Chat[]> {
  // Order membership fields on the root, and message time on the to-one embed.
  // The roadmap's root-chats order(pinned_at) targets a nonexistent column.
  const result = await supabase
    .from("chat_members")
    .select(`
    chat_id, user_id, pinned_at, favorited_at, archived_at, muted_until, manually_unread,
    chat:chats!chat_members_chat_id_fkey!inner(
      id,type,status,name,avatar_url,direct_pair_key,last_message_at,last_message_preview,last_message_id,
      last_message:messages!chats_last_message_id_fkey(id,sender_id,type,deleted_for_everyone)
    )`)
    .eq("user_id", userId)
    .eq("chat.status", "active")
    .order("pinned_at", { ascending: false, nullsFirst: false })
    .order("chat(last_message_at)", { ascending: false, nullsFirst: false })
    .limit(200);
  if (result.error) throw result.error;
  const memberships = result.data ?? [];
  const ids = memberships.map((m) => m.chat_id);
  if (!ids.length) return [];
  const lastIds = memberships.flatMap((m) =>
    m.chat.last_message_id ? [m.chat.last_message_id] : [],
  );
  const [members, unread, lastReceipts, blocks, hidden] = await Promise.all([
    Promise.all(
      chunks(ids).map((part) =>
        allRows((from, to) =>
          supabase
            .from("chat_members")
            .select("chat_id,user_id,role")
            .in("chat_id", part)
            .order("chat_id")
            .order("user_id")
            .range(from, to),
        ),
      ),
    ).then((x) => x.flat()),
    Promise.all(
      chunks(ids).map((part) =>
        allRows((from, to) =>
          supabase
            .from("message_receipts")
            .select("message_id,messages!inner(chat_id)")
            .eq("user_id", userId)
            .is("read_at", null)
            .in("messages.chat_id", part)
            .order("message_id")
            .range(from, to),
        ),
      ),
    ).then((x) => x.flat()),
    Promise.all(
      chunks(lastIds).map((part) =>
        allRows((from, to) =>
          supabase
            .from("message_receipts")
            .select("message_id,user_id,delivered_at,read_at")
            .in("message_id", part)
            .order("message_id")
            .order("user_id")
            .range(from, to),
        ),
      ),
    ).then((x) => x.flat()),
    allRows((from, to) =>
      supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", userId)
        .order("blocked_id")
        .range(from, to),
    ),
    Promise.all(
      chunks(lastIds).map((part) =>
        allRows((from, to) =>
          supabase
            .from("message_deletions")
            .select("message_id")
            .eq("user_id", userId)
            .in("message_id", part)
            .order("message_id")
            .range(from, to),
        ),
      ),
    ).then((rows) => rows.flat()),
  ]);
  const hiddenIds = new Set(hidden.map((row) => row.message_id));
  const people = [
    ...new Set([
      ...members.map((m) => m.user_id),
      ...memberships.flatMap((m) =>
        m.chat.type === "direct" ? (m.chat.direct_pair_key ?? "").split("::") : [],
      ),
      ...memberships.flatMap((m) =>
        m.chat.last_message?.sender_id ? [m.chat.last_message.sender_id] : [],
      ),
    ]),
  ];
  const profiles = (
    await Promise.all(
      chunks(people).map((part) =>
        allRows((from, to) =>
          supabase
            .from("profiles_visible")
            .select("id,display_name,username,avatar_url,last_seen_at")
            .in("id", part)
            .order("id")
            .range(from, to),
        ),
      ),
    )
  ).flat();
  const blockedProfiles = blocks.map((b) => {
    const shortId = b.blocked_id.replace(/-/g, "").slice(0, 8);
    return {
      id: b.blocked_id,
      display_name: `User ${shortId}`,
      username: `user_${shortId}`,
    };
  });
  return orderChats(
    memberships.map((m) => {
      const c = m.chat;
      const cleared = !!c.last_message_id && hiddenIds.has(c.last_message_id);
      const others = members.filter(
        (member) => member.chat_id === c.id && member.user_id !== userId,
      );
      const otherId =
        c.type === "direct"
          ? c.direct_pair_key?.split("::").find((id) => id !== userId)
          : undefined;
      const other = profiles.find((p) => p.id === otherId);
      const fallback = blockedProfiles.find((p) => p.id === otherId);
      const own = profiles.find((p) => p.id === userId);
      const sender = profiles.find((p) => p.id === c.last_message?.sender_id);
      const otherProfile = other ?? fallback;
      const recipients = c.type === "direct" && otherId ? [otherId] : others.map((o) => o.user_id);
      return {
        id: c.id,
        type: c.type,
        displayName:
          c.type === "self"
            ? "Message yourself"
            : c.type === "direct"
              ? (other?.display_name ?? fallback?.display_name ?? "Unavailable contact")
              : (c.name ?? "Group"),
        avatarUrl:
          c.type === "direct"
            ? (other?.avatar_url ?? null)
            : c.type === "self"
              ? (own?.avatar_url ?? null)
              : c.avatar_url,
        avatarInitials:
          c.type === "direct" && otherProfile
            ? getInitials({
                display_name: otherProfile.display_name ?? "",
                username: otherProfile.username ?? "",
              })
            : c.type === "self" && own
              ? getInitials({ display_name: own.display_name ?? "", username: own.username ?? "" })
              : undefined,
        otherUserId: otherId,
        otherUsername: other?.username ?? fallback?.username ?? undefined,
        lastSeenAt: other?.last_seen_at,
        memberNames: others.map(
          (o) => profiles.find((p) => p.id === o.user_id)?.display_name ?? "",
        ),
        senderName: sender?.display_name ?? "Someone",
        lastMessageAt: c.last_message_at,
        lastMessagePreview: cleared ? null : c.last_message_preview,
        lastMessageType: cleared ? null : (c.last_message?.type ?? null),
        lastMessageStatus:
          !cleared && c.last_message?.sender_id === userId
            ? receiptStatus(
                lastReceipts.filter((r) => r.message_id === c.last_message_id),
                recipients,
              )
            : null,
        deletedForEveryone:
          !cleared &&
          (!!c.last_message?.deleted_for_everyone ||
            (!c.last_message && c.last_message_preview === "This message was deleted")),
        isMyLastMessage: c.last_message?.sender_id === userId,
        unreadCount: unread.filter((r) => r.messages.chat_id === c.id).length,
        manuallyUnread: m.manually_unread,
        pinnedAt: m.pinned_at,
        favoritedAt: m.favorited_at,
        archivedAt: m.archived_at,
        mutedUntil: m.muted_until,
        isBlocked: blocks.some((b) => b.blocked_id === otherId),
        isLastAdmin:
          members.some(
            (member) =>
              member.chat_id === c.id && member.user_id === userId && member.role === "admin",
          ) && !others.some((o) => o.role === "admin"),
      };
    }),
  );
}
export function useChats() {
  const { user, mfaRequired } = useAuth();
  return useQuery({
    queryKey: chatKey(user?.id ?? ""),
    queryFn: () => fetchChats(user?.id ?? ""),
    enabled: !!user && !mfaRequired,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
// Mounted once in the authenticated shell. Unfiltered authorized events include
// newly created chats and other recipients' acknowledgements, not just our own.
export function useChatsRealtime() {
  const { user } = useAuth();
  const cache = useQueryClient();
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let refreshProfiles = false;
    let subscribedOnce = false;
    const refresh = (includeProfiles = false) => {
      if (includeProfiles) refreshProfiles = true;
      if (timer) return;
      timer = setTimeout(() => {
        const shouldRefreshProfiles = refreshProfiles;
        timer = undefined;
        refreshProfiles = false;
        void cache.invalidateQueries({ queryKey: chatKey(user.id) });
        void cache.invalidateQueries({ queryKey: ["message-requests", user.id] });
        if (shouldRefreshProfiles) {
          for (const key of [
            "direct-contacts",
            "contacts",
            "user-search",
            "contact-profile",
            "chat-members",
            "chat-messages",
            "chat-detail",
            "avatar-url",
          ]) {
            void cache.invalidateQueries({ queryKey: [key] });
          }
        }
      }, 100);
    };
    const channel = supabase
      .channel(`chats-list:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () =>
        refresh(false),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_members", filter: `user_id=eq.${user.id}` },
        () => refresh(true),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_receipts" }, () =>
        refresh(false),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_requests",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => refresh(true),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_requests", filter: `sender_id=eq.${user.id}` },
        () => refresh(true),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (subscribedOnce) refresh(false);
          subscribedOnce = true;
        }
      });
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [cache, user]);
}
