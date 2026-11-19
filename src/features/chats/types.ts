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
export interface ReactionChatSummary {
  messageId: string;
  createdAt: string;
  entries: {
    messageId: string;
    chatId: string;
    communityId?: string | null;
    reactorId: string;
    reactorName: string;
    emoji: string;
    createdAt: string;
    messageType: MessageType;
    messageContent: string | null;
  }[];
}
export interface Chat {
  id: string;
  type: Database["public"]["Enums"]["chat_type"];
  communityId?: string | null;
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
  unreadReactionCount?: number;
  unreadReactions?: ReactionChatSummary["entries"];
  reactionSummary?: ReactionChatSummary | null;
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
