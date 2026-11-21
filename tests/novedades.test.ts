import assert from "node:assert/strict";
import test from "node:test";
import {
  applyFollowOptimistic,
  applyUnfollowOptimistic,
} from "../src/features/novedades/lib/channelFollowCache.ts";
import {
  orderStoryGroups,
  slugify,
  validSlug,
} from "../src/features/novedades/lib/storyOrdering.ts";
import type { Channel, StoryGroup } from "../src/features/novedades/types.ts";

const group = (user_id: string, last_created_at: string, has_unwatched: boolean): StoryGroup => ({
  user_id,
  last_created_at,
  has_unwatched,
  stories: [],
});
test("stories keep mine separate, unseen before seen, newest first with stable ties", () => {
  const input = [
    group("seen", "2026-10-23", false),
    group("older", "2026-10-20", true),
    group("me", "2026-10-19", true),
    group("unseen", "2026-10-22", true),
    group("aaa", "2026-10-22", true),
  ];
  const result = orderStoryGroups(input, "me");
  assert.equal(result.mine?.user_id, "me");
  assert.deepEqual(
    result.unwatched.map((g) => g.user_id),
    ["aaa", "unseen", "older"],
  );
  assert.deepEqual(
    result.watched.map((g) => g.user_id),
    ["seen"],
  );
  assert.equal(input[0]?.user_id, "seen");
  assert.deepEqual(orderStoryGroups([], "me"), { mine: null, unwatched: [], watched: [] });
});
test("channel slugs normalize accents and enforce the locked length/character rules", () => {
  assert.equal(slugify("  Café — Novedades! "), "cafe-novedades");
  assert.equal(slugify("🗞️ News + More"), "news-more");
  assert.equal(slugify("a".repeat(80)).length, 50);
  for (const value of ["ab", "UPPER", "with space", "abc_123", "a".repeat(51), ""])
    assert.equal(validSlug(value), false, value);
  for (const value of ["abc", "abc-123", "a".repeat(50)])
    assert.equal(validSlug(value), true, value);
});
test("channel follow cache helpers update follower count and follow state optimistically", () => {
  const channel: Channel = {
    id: "ch-1",
    name: "Tech Updates",
    slug: "tech-updates",
    description: null,
    avatar_url: null,
    follower_count: 10,
    is_verified: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    last_message_id: null,
    last_message_at: null,
    last_message_preview: null,
  };
  const followed = applyFollowOptimistic(
    { channel, follow: null },
    "user-1",
    "2026-11-18T00:00:00Z",
  );
  assert.equal(followed?.channel.follower_count, 11);
  assert.equal(followed?.follow?.user_id, "user-1");
  assert.equal(followed?.follow?.channel_id, "ch-1");
  // Idempotent when already followed
  assert.equal(
    applyFollowOptimistic(followed, "user-1", "2026-11-18T00:01:00Z")?.channel.follower_count,
    11,
  );
  const unfollowed = applyUnfollowOptimistic(followed);
  assert.equal(unfollowed?.channel.follower_count, 10);
  assert.equal(unfollowed?.follow, null);
  // Clamps follower_count at zero
  assert.ok(followed?.follow);
  const zeroFloor = applyUnfollowOptimistic({
    channel: { ...channel, follower_count: 0 },
    follow: followed.follow,
  });
  assert.equal(zeroFloor?.channel.follower_count, 0);
  assert.equal(zeroFloor?.follow, null);
});

import { getAvailableActions } from "../src/features/messages/lib/actionMatrix.ts";
import type { Message } from "../src/features/messages/types.ts";
import { channelChat } from "../src/features/novedades/lib/channelChat.ts";

test("channel chat helper disables reactions and enforces OC-03 staff post deletion", () => {
  const ch: Channel = {
    id: "ch-1",
    name: "News",
    slug: "news",
    description: null,
    avatar_url: null,
    follower_count: 2,
    is_verified: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    last_message_at: null,
    last_message_id: null,
    last_message_preview: null,
  };
  const visitorDetails = channelChat(ch, null);
  assert.equal(visitorDetails.readOnly, true);
  assert.equal(visitorDetails.channelStaffRole, null);

  const post: Message = {
    id: "m-1",
    chat_id: null,
    channel_id: "ch-1",
    sender_id: "admin-1",
    type: "text",
    content: "Broadcast",
    created_at: new Date().toISOString(),
    deleted_at: null,
    deleted_for_everyone: false,
    edited_at: null,
    is_pinned_in_chat: false,
    reply_to_message_id: null,
    reply_to_story_id: null,
    file_upload_id: null,
    media_thumbnail_upload_id: null,
    mentions: null,
    media_peaks: null,
    forwarded_from_message_id: null,
    location_data: null,
    contact_data: null,
    receipts: [],
    reactions: [],
    unreadForMe: false,
  };

  const visitorActions = getAvailableActions(post, "follower-1", true, Date.now(), false, null);
  assert.ok(!visitorActions.includes("react"));
  assert.ok(visitorActions.includes("forward"));
  assert.ok(!visitorActions.includes("delete_for_everyone"));

  const adminOtherPostActions = getAvailableActions(
    { ...post, sender_id: "owner-1" },
    "admin-1",
    false,
    Date.now(),
    false,
    "admin",
  );
  assert.ok(!adminOtherPostActions.includes("delete_for_everyone"));

  const adminOwnActions = getAvailableActions(post, "admin-1", false, Date.now(), false, "admin");
  assert.ok(adminOwnActions.includes("delete_for_everyone"));

  const ownerAnyActions = getAvailableActions(post, "owner-1", false, Date.now(), false, "owner");
  assert.ok(ownerAnyActions.includes("delete_for_everyone"));
});
