import type { Database } from "../../types/database.ts";
export const filterKeys = [
  "all",
  "favorites",
  "unread",
  "groups",
  "archived",
  "muted",
  "blocked",
] as const;
export type FilterKey = (typeof filterKeys)[number];
export type MessageType = Database["public"]["Enums"]["message_type"];
export interface Chat {
  id: string;
  type: Database["public"]["Enums"]["chat_type"];
  displayName: string;
  avatarUrl: string | null;
  avatarInitials?: string | null;
  otherUserId?: string;
  otherUsername?: string;
  lastSeenAt?: string | null;
  memberNames: string[];
  senderName: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageType: MessageType | null;
  lastMessageStatus: "sent" | "delivered" | "read" | null;
  deletedForEveryone: boolean;
  isMyLastMessage: boolean;
  unreadCount: number;
  manuallyUnread: boolean;
  pinnedAt: string | null;
  favoritedAt: string | null;
  archivedAt: string | null;
  mutedUntil: string | null;
  isBlocked: boolean;
  isLastAdmin: boolean;
}
export interface MessageRequest {
  id: string;
  chatId: string;
  senderId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  preview: string | null;
}
export interface Draft {
  text: string;
  mediaUrls: string[];
  replyToId: string | null;
  updatedAt: string;
  ownerId?: string;
  failed?: boolean;
  pending?: boolean;
}
export type ChatAction = "pin" | "favorite" | "archive" | "mute" | "read" | "unread" | "delete";
