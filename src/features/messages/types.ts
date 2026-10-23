import type { Database } from "../../types/database.ts";

type Tables = Database["public"]["Tables"];
export type MessageRow = Omit<Tables["messages"]["Row"], "compute_message_preview">;
export type Upload = Tables["file_uploads"]["Row"];
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
export interface ChatDetails {
  status: Tables["chats"]["Row"]["status"];
  createdBy: string | null;
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
  communityName?: string;
  request?: Tables["chat_requests"]["Row"];
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
