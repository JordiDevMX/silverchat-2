import type { Chat, Draft, FilterKey, MessageType } from "../types.ts";
import { aggregateReactionSummary } from "./reactionNotifications.ts";

const mediaPreviewRules: Partial<Record<MessageType, { prefix: RegExp; fallback: string }>> = {
  image: { prefix: /^📷\s*(?:Photo(?:\s*—\s*|$))?/u, fallback: "Photo" },
  video: { prefix: /^🎥\s*(?:Video(?:\s*—\s*|$))?/u, fallback: "Video" },
  audio: { prefix: /^🎤\s*(?:Audio(?:\s*—\s*|$))?/u, fallback: "Audio" },
  file: { prefix: /^📄\s*/u, fallback: "File" },
  sticker: { prefix: /^🎨\s*(?:Sticker(?:\s*—\s*|$))?/u, fallback: "Sticker" },
  location: { prefix: /^📍\s*(?:Location(?:\s*—\s*|$))?/u, fallback: "Location" },
  contact: { prefix: /^👤\s*(?:Contact(?:\s*—\s*|$))?/u, fallback: "Contact" },
};

function resolveMessagePreview(
  type: MessageType | null,
  rawPreview: string | null,
): { text: string; translateText: boolean } {
  const rule = type ? mediaPreviewRules[type] : undefined;
  if (rule) {
    const cleaned = (rawPreview ?? "").trim().replace(rule.prefix, "").trim();
    if (!cleaned || cleaned === rule.fallback) {
      return { text: rule.fallback, translateText: true };
    }
    return { text: cleaned, translateText: false };
  }
  if (!rawPreview) return { text: "No messages yet", translateText: true };
  return { text: rawPreview, translateText: false };
}
export function isMuted(chat: Pick<Chat, "mutedUntil">, now = Date.now()) {
  return !!chat.mutedUntil && Date.parse(chat.mutedUntil) > now;
}
export function applyFilter(chats: Chat[], filter: FilterKey) {
  return chats.filter((c) => {
    if (filter === "archived") return !!c.archivedAt;
    if (filter === "blocked") return c.type === "direct" && c.isBlocked;
    if (c.archivedAt) return false;
    switch (filter) {
      case "favorites":
        return !!c.favoritedAt;
      case "unread":
        return c.manuallyUnread || c.unreadCount > 0 || (c.unreadReactionCount ?? 0) > 0;
      case "groups":
        return c.type === "group" || c.type === "community_chat";
      case "muted":
        return isMuted(c);
      default:
        return true;
    }
  });
}
export function applySearch(chats: Chat[], query: string) {
  const q = query.trim().toLocaleLowerCase();
  return !q
    ? chats
    : chats.filter((c) =>
        [
          c.displayName,
          c.lastMessagePreview,
          c.otherUsername,
          ...(c.type === "group" || c.type === "community_chat" ? c.memberNames : []),
        ].some((text) => text?.toLocaleLowerCase().includes(q)),
      );
}
export function orderChats(chats: Chat[]) {
  return [...chats].sort((a, b) => {
    const pin =
      (b.pinnedAt ? Date.parse(b.pinnedAt) : 0) - (a.pinnedAt ? Date.parse(a.pinnedAt) : 0);
    return (
      pin ||
      (b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0) -
        (a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0) ||
      a.id.localeCompare(b.id)
    );
  });
}
export function receiptStatus(
  receipts: { user_id: string; delivered_at: string | null; read_at: string | null }[],
  recipients: string[],
): "sent" | "delivered" | "read" {
  // Missing/hidden receipts never imply delivery or read. Respect fair-trade RLS.
  if (!recipients.length) return "sent";
  const rows = recipients.map((id) => receipts.find((r) => r.user_id === id));
  if (rows.every((r) => r?.read_at)) return "read";
  if (rows.every((r) => r?.delivered_at)) return "delivered";
  return "sent";
}
export function computeChatDisplay(chat: Chat, draft?: Draft, language: "en" | "es" = "en") {
  const latestActivity = Math.max(
    chat.lastMessageAt ? Date.parse(chat.lastMessageAt) : 0,
    chat.reactionSummary?.createdAt ? Date.parse(chat.reactionSummary.createdAt) : 0,
  );
  const newer = draft && Date.parse(draft.updatedAt) > latestActivity;
  if (newer && draft.failed)
    return {
      state: "failed",
      text: "Message failed to send",
      translateText: true,
      prefix: "",
      status: null,
    } as const;
  if (newer && draft.pending) {
    const text = draft.text.trim();
    return {
      state: "pending",
      text: text || "Attachment",
      translateText: !text,
      prefix: "",
      status: null,
    } as const;
  }
  if (newer) {
    const text = draft.text.trim();
    return {
      state: "draft",
      text: text || "Attachment",
      translateText: !text,
      prefix: "",
      status: null,
    } as const;
  }
  if (
    chat.reactionSummary?.entries.length &&
    (!chat.lastMessageAt ||
      Date.parse(chat.reactionSummary.createdAt) >= Date.parse(chat.lastMessageAt))
  ) {
    const summary = aggregateReactionSummary(chat.reactionSummary.entries, language);
    if (summary)
      return {
        state: "reaction",
        text: summary.text,
        translateText: false,
        prefix: "",
        status: null,
      } as const;
  }
  if (chat.deletedForEveryone)
    return {
      state: "deleted",
      text: "This message was deleted",
      translateText: true,
      prefix: "",
      status: null,
    } as const;
  const prefix =
    chat.type === "self"
      ? ""
      : chat.isMyLastMessage
        ? "You"
        : chat.type === "group" || chat.type === "community_chat"
          ? chat.senderName
          : "";
  const preview = resolveMessagePreview(chat.lastMessageType, chat.lastMessagePreview);
  return {
    state: "message",
    text: preview.text,
    translateText: preview.translateText,
    prefix,
    status: chat.isMyLastMessage ? chat.lastMessageStatus : null,
  } as const;
}
export function badgeText(count: number) {
  return count > 99 ? "99+" : String(count);
}
/** Navigation badge totals. Community chats belong to the Communities tab; the rest to Chats. */
export function navigationUnread(
  chats: Pick<Chat, "type" | "unreadCount" | "unreadReactionCount" | "archivedAt" | "mutedUntil">[],
) {
  let chatUnread = 0;
  let communityUnread = 0;
  for (const chat of chats) {
    if (chat.archivedAt || isMuted(chat)) continue;
    const total = chat.unreadCount + (chat.unreadReactionCount ?? 0);
    if (chat.type === "community_chat") communityUnread += total;
    else chatUnread += total;
  }
  return { chatUnread, communityUnread };
}
