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
export type Channel = T["channels"]["Row"];
export type Follow = T["channel_followers"]["Row"];
export type FollowedChannel = Channel & { follow: Follow; unread: number };
