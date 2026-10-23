import type { Chat, Draft, FilterKey } from "../types.ts";
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
        return c.manuallyUnread || c.unreadCount > 0;
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
export function computeChatDisplay(chat: Chat, draft?: Draft) {
  const newer =
    draft &&
    Date.parse(draft.updatedAt) > (chat.lastMessageAt ? Date.parse(chat.lastMessageAt) : 0);
  if (newer && draft.failed)
    return { state: "failed", text: "Message failed to send", prefix: "", status: null } as const;
  if (newer && draft.pending)
    return { state: "pending", text: draft.text, prefix: "", status: null } as const;
  if (newer)
    return {
      state: "draft",
      text: draft.text || "Attachment",
      prefix: "Draft",
      status: null,
    } as const;
  if (chat.deletedForEveryone)
    return {
      state: "deleted",
      text: "This message was deleted",
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
  return {
    state: "message",
    text: chat.lastMessagePreview || "No messages yet",
    prefix,
    status: chat.isMyLastMessage ? chat.lastMessageStatus : null,
  } as const;
}
export function badgeText(count: number) {
  return count > 99 ? "99+" : String(count);
}
