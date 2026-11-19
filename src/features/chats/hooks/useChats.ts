import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { useI18n } from "@/app/providers/i18n-provider";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import {
  createReconnectRefresh,
  shouldRefreshProfilesForMembershipEvent,
} from "@/features/messages/lib/chatQueryPolicy";
import { detailKey, messageKey } from "@/features/messages/types";
import { inAppNotification, playNotificationSound } from "@/features/settings/notifications";
import { usePreferences } from "@/features/settings/preferences-provider";
import { useAuth } from "@/lib/auth-provider";
import { getInitials } from "@/lib/avatar";
import { supabase } from "@/lib/supabase";
import type { Chat, MessageType } from "../types";
import { isMuted, orderChats, receiptStatus } from "../utils/computeChatDisplay";
import {
  aggregateReactionSummary,
  buildChatReactionSummary,
  isReactionUnread,
  isViewingChatPath,
  mergeChatReactionEntries,
  type ReactionNotificationEntry,
  reactionNotificationStore,
  shouldNotifyForReaction,
} from "../utils/reactionNotifications";

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
    chat_id, user_id, joined_at, last_read_at, pinned_at, favorited_at, archived_at, muted_until, manually_unread,
    chat:chats!chat_members_chat_id_fkey!inner(
      id,type,status,community_id,name,avatar_url,direct_pair_key,last_message_at,last_message_preview,last_message_id,
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
  const [members, unread, lastReceipts, blocks, hidden, reactionRows] = await Promise.all([
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
    Promise.all(
      chunks(ids).map((part) =>
        allRows((from, to) =>
          supabase
            .from("message_reactions")
            .select(
              "message_id,user_id,emoji,created_at,message:messages!inner(id,chat_id,sender_id,type,content,deleted_for_everyone)",
            )
            .eq("message.sender_id", userId)
            .neq("user_id", userId)
            .eq("message.deleted_for_everyone", false)
            .in("message.chat_id", part)
            .order("created_at", { ascending: false })
            .order("message_id")
            .order("user_id")
            .range(from, to),
        ),
      ),
    ).then((x) => x.flat()),
  ]);
  const hiddenIds = new Set(hidden.map((row) => row.message_id));
  const blockedIds = new Set(blocks.map((b) => b.blocked_id));
  const membershipByChat = new Map(memberships.map((m) => [m.chat_id, m]));
  const unreadReactions = reactionRows.flatMap((row) => {
    const msg = Array.isArray(row.message) ? row.message[0] : row.message;
    if (!msg?.chat_id || msg.deleted_for_everyone || msg.sender_id !== userId) return [];
    if (row.user_id === userId || blockedIds.has(row.user_id)) return [];
    const membership = membershipByChat.get(msg.chat_id);
    if (
      !membership ||
      !isReactionUnread(
        row.created_at,
        (membership as { last_read_at?: string | null }).last_read_at,
        (membership as { joined_at?: string | null }).joined_at,
      )
    ) {
      return [];
    }
    return [{ row, msg }];
  });
  const people = [
    ...new Set([
      ...members.map((m) => m.user_id),
      ...unreadReactions.map((item) => item.row.user_id),
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
  const allHydratedEntries: ReactionNotificationEntry[] = unreadReactions.map(({ row, msg }) => {
    const m = membershipByChat.get(msg.chat_id ?? "");
    return {
      messageId: row.message_id,
      chatId: msg.chat_id ?? "",
      communityId: m?.chat.community_id ?? null,
      reactorId: row.user_id,
      reactorName: profiles.find((p) => p.id === row.user_id)?.display_name ?? "Someone",
      emoji: row.emoji,
      createdAt: row.created_at,
      messageType: msg.type,
      messageContent: msg.content ?? null,
    };
  });
  reactionNotificationStore.getState().hydrateFromDb(allHydratedEntries);
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
      const chatReactionEntries = allHydratedEntries.filter((entry) => entry.chatId === c.id);
      const reactionData = buildChatReactionSummary(chatReactionEntries);
      return {
        id: c.id,
        type: c.type,
        communityId: c.community_id ?? null,
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
        unreadReactionCount: reactionData.unreadReactionCount,
        unreadReactions: chatReactionEntries,
        reactionSummary: reactionData.reactionSummary,
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
  const query = useQuery({
    queryKey: chatKey(user?.id ?? ""),
    queryFn: () => fetchChats(user?.id ?? ""),
    enabled: !!user && !mfaRequired,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const entries = useStore(reactionNotificationStore, (s) => s.entries);
  const clearedAtByChat = useStore(reactionNotificationStore, (s) => s.clearedAtByChat);
  const withdrawnAtByKey = useStore(reactionNotificationStore, (s) => s.withdrawnAtByKey);
  const data = useMemo(() => {
    if (!query.data) return query.data;
    return query.data.map((chat) => {
      const merged = mergeChatReactionEntries(chat.id, chat.unreadReactions ?? [], {
        entries,
        clearedAtByChat,
        withdrawnAtByKey,
      });
      if (!merged.length && !chat.unreadReactionCount) return chat;
      const summary = buildChatReactionSummary(merged);
      return {
        ...chat,
        unreadReactionCount: summary.unreadReactionCount,
        unreadReactions: merged,
        reactionSummary: summary.reactionSummary,
      };
    });
  }, [query.data, entries, clearedAtByChat, withdrawnAtByKey]);
  return { ...query, data };
}

type ReactionPayload = {
  eventType?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
};

async function resolveReactionTarget(
  cache: ReturnType<typeof useQueryClient>,
  userId: string,
  messageId: string,
  reactorId: string,
) {
  const messageResult = await supabase
    .from("messages")
    .select("id,chat_id,channel_id,sender_id,type,content,deleted_for_everyone")
    .eq("id", messageId)
    .maybeSingle();
  const msg = messageResult.data;
  if (messageResult.error || !msg?.chat_id || msg.deleted_for_everyone) return null;

  const cachedChat = cache.getQueryData<Chat[]>(chatKey(userId))?.find((c) => c.id === msg.chat_id);
  let chatMeta = cachedChat
    ? {
        type: cachedChat.type,
        communityId: cachedChat.communityId ?? null,
        muted: isMuted(cachedChat),
        archived: !!cachedChat.archivedAt,
        blocked: cachedChat.isBlocked,
      }
    : null;

  if (!chatMeta) {
    const [memberRes, blockRes] = await Promise.all([
      supabase
        .from("chat_members")
        .select(
          "muted_until,archived_at,chat:chats!chat_members_chat_id_fkey!inner(type,status,community_id)",
        )
        .eq("chat_id", msg.chat_id)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", userId)
        .eq("blocked_id", reactorId)
        .maybeSingle(),
    ]);
    const member = memberRes.data;
    const chatRow = member ? (Array.isArray(member.chat) ? member.chat[0] : member.chat) : null;
    if (!member || !chatRow || chatRow.status !== "active") return null;
    chatMeta = {
      type: chatRow.type,
      communityId: chatRow.community_id ?? null,
      muted: isMuted({ mutedUntil: member.muted_until }),
      archived: !!member.archived_at,
      blocked: !!blockRes.data,
    };
  }

  if (
    !shouldNotifyForReaction({
      currentUserId: userId,
      messageSenderId: msg.sender_id,
      reactorId,
      chatId: msg.chat_id,
      deletedForEveryone: msg.deleted_for_everyone,
      chatType: chatMeta.type,
      isBlocked: chatMeta.blocked,
    })
  ) {
    return null;
  }

  const cachedDetails = cache.getQueryData<{
    members?: { user_id: string; profile?: { display_name?: string | null } }[];
  }>(detailKey(userId, msg.chat_id));
  let reactorName = cachedDetails?.members?.find((m) => m.user_id === reactorId)?.profile
    ?.display_name;
  if (!reactorName) {
    const profileRes = await supabase
      .from("profiles_visible")
      .select("id,display_name")
      .eq("id", reactorId)
      .maybeSingle();
    reactorName = profileRes.data?.display_name ?? undefined;
  }

  return {
    chatId: msg.chat_id,
    communityId: chatMeta.communityId,
    muted: chatMeta.muted,
    archived: chatMeta.archived,
    messageType: msg.type as MessageType,
    messageContent: msg.content ?? null,
    reactorName: reactorName || "Someone",
  };
}

// Mounted once in the authenticated shell. Unfiltered authorized events include
// newly created chats and other recipients' acknowledgements, not just our own.
export function useChatsRealtime() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const cache = useQueryClient();
  const { settings } = usePreferences();
  const { language } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const languageRef = useRef(language);
  languageRef.current = language;
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (!userId) {
      reactionNotificationStore.getState().reset();
      if (useChatUIStore.getState().noticeAction?.kind === "reaction") {
        useChatUIStore.getState().notify("");
      }
      return;
    }
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let refreshProfiles = false;
    const refresh = (includeProfiles = false) => {
      if (includeProfiles) refreshProfiles = true;
      if (timer) return;
      timer = setTimeout(() => {
        const shouldRefreshProfiles = refreshProfiles;
        timer = undefined;
        refreshProfiles = false;
        void cache.invalidateQueries({ queryKey: chatKey(userId) });
        void cache.invalidateQueries({ queryKey: ["community-chats", userId] });
        void cache.invalidateQueries({ queryKey: ["message-requests", userId] });
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

    const getNotifSettings = () => ({
      notifications_enabled: settingsRef.current?.notifications_enabled ?? true,
      notification_sound_enabled: settingsRef.current?.notification_sound_enabled ?? true,
      notification_previews_enabled: settingsRef.current?.notification_previews_enabled ?? true,
    });

    const showToastForEntries = (entries: ReactionNotificationEntry[], playSound: boolean) => {
      const lang = languageRef.current;
      const summary = aggregateReactionSummary(entries, lang);
      if (!summary) return;
      const notif = inAppNotification(
        getNotifSettings(),
        summary.text,
        lang === "es" ? "Nueva reacción" : "New reaction",
      );
      if (!notif) return;
      reactionNotificationStore.getState().setActiveToast(summary.chatId, summary.messageId);
      useChatUIStore.getState().notify(notif.text, {
        kind: "reaction",
        href: summary.href,
        chatId: summary.chatId,
        messageId: summary.messageId,
      });
      if (playSound && notif.sound) void playNotificationSound().catch(() => undefined);
    };

    const handleReaction = async (payload: ReactionPayload) => {
      const eventType = payload.eventType;
      if (eventType === "DELETE") {
        const oldRow = payload.old;
        const messageId = typeof oldRow?.message_id === "string" ? oldRow.message_id : "";
        const reactorId = typeof oldRow?.user_id === "string" ? oldRow.user_id : "";
        if (!messageId || !reactorId || reactorId === userId) return;
        const result = reactionNotificationStore.getState().withdraw(messageId, reactorId);
        refresh(false);
        if (result.wasActiveToast) {
          if (result.remainingForMessage.length) {
            showToastForEntries(result.remainingForMessage, false);
          } else if (useChatUIStore.getState().noticeAction?.kind === "reaction") {
            useChatUIStore.getState().notify("");
          }
        }
        return;
      }

      const newRow = payload.new;
      const messageId = typeof newRow?.message_id === "string" ? newRow.message_id : "";
      const reactorId = typeof newRow?.user_id === "string" ? newRow.user_id : "";
      const emoji = typeof newRow?.emoji === "string" ? newRow.emoji : "";
      const createdAt =
        typeof newRow?.created_at === "string" ? newRow.created_at : new Date().toISOString();
      if (!messageId || !reactorId || !emoji || reactorId === userId) return;

      const target = await resolveReactionTarget(cache, userId, messageId, reactorId);
      if (!active || !target) return;

      if (isViewingChatPath(pathnameRef.current, target.chatId, document.visibilityState)) {
        void cache.invalidateQueries({ queryKey: messageKey(userId, target.chatId) });
        refresh(false);
        return;
      }

      const { status, messageEntries } = reactionNotificationStore.getState().upsert({
        messageId,
        chatId: target.chatId,
        communityId: target.communityId,
        reactorId,
        reactorName: target.reactorName,
        emoji,
        createdAt,
        messageType: target.messageType,
        messageContent: target.messageContent,
      });
      refresh(false);
      if (status === "duplicate" || status === "stale") return;
      if (!target.muted && !target.archived) {
        showToastForEntries(messageEntries, status === "added");
      }
    };

    const channel = supabase
      .channel(`chats-list:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () =>
        refresh(false),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        (payload) => void handleReaction(payload as ReactionPayload),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_members", filter: `user_id=eq.${userId}` },
        (payload) => refresh(shouldRefreshProfilesForMembershipEvent(payload.eventType)),
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
          filter: `recipient_id=eq.${userId}`,
        },
        () => refresh(true),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_requests", filter: `sender_id=eq.${userId}` },
        () => refresh(true),
      )
      .subscribe(createReconnectRefresh(() => refresh(false)));
    return () => {
      active = false;
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [cache, userId]);
}
