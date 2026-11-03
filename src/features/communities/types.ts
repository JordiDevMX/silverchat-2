import type { Database } from "../../types/database.ts";
import type { Profile } from "../messages/types.ts";

type Tables = Database["public"]["Tables"];
export type Community = Tables["communities"]["Row"] & {
  role: "admin" | "member";
  joined_at: string;
};
export type CommunityMember = Tables["community_members"]["Row"] & { profile?: Profile };
export type CommunityChat = Tables["chats"]["Row"] & {
  membership: Tables["chat_members"]["Row"];
  unreadCount: number;
};
