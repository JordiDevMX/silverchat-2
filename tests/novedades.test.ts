import assert from "node:assert/strict";
import test from "node:test";
import {
  orderStoryGroups,
  slugify,
  validSlug,
} from "../src/features/novedades/lib/storyOrdering.ts";
import type { StoryGroup } from "../src/features/novedades/types.ts";

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
