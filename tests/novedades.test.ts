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
    owner_id: "owner-1",
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
