import type { Database } from "../../types/database.ts";
import type { Profile, Upload } from "../messages/types.ts";

type T = Database["public"]["Tables"];
export type Story = T["stories"]["Row"] & {
  profile?: Profile;
  upload?: Upload;
  thumbnail?: Upload;
  viewed: boolean;
};
export type StoryGroup = {
  user_id: string;
  profile?: Profile;
  stories: Story[];
  last_created_at: string;
  has_unwatched: boolean;
};
type V = Database["public"]["Views"];
export type ChannelStaffRole = "owner" | "admin" | null;
export type Channel = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  follower_count: number;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_id: string | null;
  last_message_preview: string | null;
};
export function mapPublicChannelRow(row: V["channels_public"]["Row"]): Channel {
  return {
    id: row.id ?? "",
    name: row.name ?? "",
    slug: row.slug ?? "",
    description: row.description ?? null,
    avatar_url: row.avatar_url ?? null,
    follower_count: row.follower_count ?? 0,
    is_verified: Boolean(row.is_verified),
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
    last_message_at: row.last_message_at ?? null,
    last_message_id: row.last_message_id ?? null,
    last_message_preview: row.last_message_preview ?? null,
  };
}
export type Follow = T["channel_followers"]["Row"];
export type FollowedChannel = Channel & { follow: Follow; unread: number };
export type ChannelStaffMember =
  Database["public"]["Functions"]["get_channel_staff"]["Returns"][number];
export type ChannelInvitationSent = V["channel_invitations_sent"]["Row"];
export type ChannelInvitationReceived = V["channel_invitations_received"]["Row"] & {
  channel?: Channel | null;
};
