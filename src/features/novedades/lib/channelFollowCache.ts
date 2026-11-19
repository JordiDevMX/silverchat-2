import type { Channel, Follow } from "../types.ts";

export type ChannelInfoCache = {
  channel: Channel;
  follow: Follow | null;
} | null;

export function applyFollowOptimistic(
  current: ChannelInfoCache | undefined,
  userId: string,
  now = new Date().toISOString(),
): ChannelInfoCache | undefined {
  if (!current || current.follow) return current;
  return {
    channel: {
      ...current.channel,
      follower_count: current.channel.follower_count + 1,
    },
    follow: {
      channel_id: current.channel.id,
      user_id: userId,
      followed_at: now,
      last_read_at: now,
      muted_until: null,
    },
  };
}

export function applyUnfollowOptimistic(
  current: ChannelInfoCache | undefined,
): ChannelInfoCache | undefined {
  if (!current?.follow) return current;
  return {
    channel: {
      ...current.channel,
      follower_count: Math.max(0, current.channel.follower_count - 1),
    },
    follow: null,
  };
}
