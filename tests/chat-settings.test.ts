import assert from "node:assert/strict";
import test from "node:test";
import {
  directPairKey,
  getAvailableChatActions,
  muteUntil,
  toggleMember,
  validReport,
} from "../src/features/chat-settings/lib/chatActions.ts";
import type { ChatDetails, Member } from "../src/features/messages/types.ts";

const chat = (
  type: ChatDetails["type"] = "direct",
  role: Member["role"] = "member",
): ChatDetails => ({
  id: "chat",
  type,
  name: "Chat",
  avatar: null,
  members: [],
  readOnly: false,
  status: "active",
  createdBy: "me",
  createdAt: "2026-01-01",
  description: null,
  own: {
    chat_id: "chat",
    user_id: "me",
    role,
    joined_at: "2026-01-01",
    last_read_at: null,
    archived_at: null,
    favorited_at: null,
    pinned_at: null,
    muted_until: null,
    manually_unread: false,
  },
});
test("chat menus distinguish direct, self, groups, communities, admins and pending recipients", () => {
  assert.equal(getAvailableChatActions(chat()).length, 8);
  assert.deepEqual(getAvailableChatActions(chat("self")), ["search_in_chat", "pin", "clear_chat"]);
  assert.ok(!getAvailableChatActions(chat("group")).includes("add_members"));
  assert.ok(getAvailableChatActions(chat("group", "admin")).includes("add_members"));
  assert.deepEqual(getAvailableChatActions(chat("community_chat", "admin")), [
    "view_community_info",
    "search_in_chat",
    "mute",
    "mark_unread",
    "pin",
    "clear_chat",
  ]);
  const direct = chat();
  if (direct.own) {
    direct.own.pinned_at = "2026-01-01";
    direct.own.muted_until = "9999-12-31T23:59:59Z";
  }
  assert.ok(getAvailableChatActions(direct).includes("unmute"));
  assert.ok(getAvailableChatActions(direct).includes("unpin"));
  assert.deepEqual(
    getAvailableChatActions({ ...chat(), readOnly: true, status: "pending_request" }),
    ["view_profile", "search_in_chat", "block", "report"],
  );
});
test("member selection deduplicates, permits removal at capacity, and rejects a 51st", () => {
  const ids = Array.from({ length: 50 }, (_, i) => String(i));
  assert.throws(() => toggleMember(ids, "51"));
  assert.equal(toggleMember(ids, "1").length, 49);
  assert.deepEqual(toggleMember(["one"], "one"), []);
});
test("reports require an Other explanation, enforce length, and accept four reasons only", () => {
  assert.equal(validReport("other", "  "), false);
  assert.equal(validReport("other", "detail"), true);
  assert.equal(validReport("spam", ""), true);
  assert.equal(validReport("harassment", "a".repeat(501)), false);
  assert.equal(validReport("inappropriate", "a".repeat(500)), true);
  assert.equal(validReport("unknown", "detail"), false);
});
test("direct pair ordering is canonical and mute expiry distinguishes Always from unmute", () => {
  assert.equal(directPairKey("b", "a"), "a::b");
  assert.equal(directPairKey("a", "b"), "a::b");
  assert.equal(muteUntil(8, 0), "1970-01-01T08:00:00.000Z");
  assert.equal(muteUntil(Infinity), "9999-12-31T23:59:59Z");
  assert.equal(muteUntil(null), null);
});
