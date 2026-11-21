import type { Database } from "../../types/database.ts";

type Tables = Database["public"]["Tables"];
export type MessageRow = Omit<Tables["messages"]["Row"], "compute_message_preview">;
export type Upload = Omit<Tables["file_uploads"]["Row"], "uploader_id" | "hash_sha256"> & {
  uploader_id?: string | null;
  hash_sha256?: string | null;
  channelId?: string | null;
  messageId?: string | null;
};
export type Profile = Database["public"]["Views"]["profiles_visible"]["Row"];
export type Member = Tables["chat_members"]["Row"] & { profile?: Profile };
export type Receipt = Tables["message_receipts"]["Row"];
export type Message = MessageRow & {
  sender?: Profile;
  upload?: Upload;
  thumbnail?: Upload;
  reply?: MessageRow;
  replySender?: Profile;
  reactions: Tables["message_reactions"]["Row"][];
  receipts: Receipt[];
  unreadForMe: boolean;
  localStatus?: "pending" | "failed";
  clientId?: string;
};

import type { CommunityRole, CommunityWritePolicy } from "../roles/types.ts";

export interface ChatDetails {
  channelMode?: boolean;
  channelStaffRole?: "owner" | "admin" | null;
  status: Tables["chats"]["Row"]["status"];
  createdBy: string | null;
  ownerId?: string | null;
  createdAt: string;
  description: string | null;
  otherUserId?: string;
  id: string;
  type: Tables["chats"]["Row"]["type"];
  name: string;
  avatar: string | null;
  members: Member[];
  own?: Member;
  other?: Profile;
  communityId?: string | null;
  communityName?: string;
  communityOwnerId?: string | null;
  communityRole?: CommunityRole;
  communitySilencedUntil?: string | null;
  communityAuthorRoles?: Record<string, CommunityRole>;
  systemRole?: "announcements" | null;
  writePolicy?: CommunityWritePolicy;
  isAnnouncementWriter?: boolean;
  request?: Tables["chat_requests"]["Row"];
  onlyAdminsCanAddMembers?: boolean;
  onlyAdminsCanShareLink?: boolean;
  onlyAdminsCanSend?: boolean;
  onlyAdminsCanEditInfo?: boolean;
  requireAdminApproval?: boolean;
  readOnly: boolean;
}
export type SendInput = Pick<MessageRow, "type" | "content"> &
  Partial<
    Pick<
      MessageRow,
      | "file_upload_id"
      | "media_thumbnail_upload_id"
      | "contact_data"
      | "mentions"
      | "reply_to_message_id"
      | "media_peaks"
    >
  > & { upload?: Upload; thumbnail?: Upload };
export type Cursor = { at: string; id: string } | null;
export const messageKey = (userId: string, chatId: string) => ["messages", userId, chatId] as const;
export const detailKey = (userId: string, chatId: string) =>
  ["chat-detail", userId, chatId] as const;
export const outboxKey = (userId: string, chatId: string) =>
  ["message-outbox", userId, chatId] as const;
