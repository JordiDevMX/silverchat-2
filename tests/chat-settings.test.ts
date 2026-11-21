import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReportPayload,
  directPairKey,
  getAvailableChannelActions,
  getAvailableChatActions,
  muteUntil,
  toggleMember,
  validReport,
} from "../src/features/chat-settings/lib/chatActions.ts";
import type { ChatDetails, Member } from "../src/features/messages/types.ts";

const chat = (
  type: ChatDetails["type"] = "direct",
  role: Member["role"] = "member",
  overrides: Partial<ChatDetails> = {},
): ChatDetails => ({
  id: "chat",
  type,
  name: "Chat",
  avatar: null,
  members: [],
  readOnly: false,
  status: "active",
  createdBy: "owner-id",
  ownerId: "owner-id",
  onlyAdminsCanAddMembers: false,
  onlyAdminsCanShareLink: false,
  onlyAdminsCanSend: false,
  onlyAdminsCanEditInfo: false,
  requireAdminApproval: false,
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
  ...overrides,
});
test("chat menus distinguish direct, self, groups, communities, admins and pending recipients without report", () => {
  const directActions = getAvailableChatActions(chat());
  assert.equal(directActions.length, 7);
  assert.ok(directActions.includes("block"));
  assert.ok(!directActions.includes("report" as never));
  assert.deepEqual(getAvailableChatActions(chat("self")), ["search_in_chat", "pin", "clear_chat"]);
  // Group members follow onlyAdminsCanAddMembers (open defaults to member add allowed; restricted hides it)
  assert.ok(getAvailableChatActions(chat("group")).includes("add_members"));
  assert.ok(
    !getAvailableChatActions(chat("group", "member", { onlyAdminsCanAddMembers: true })).includes(
      "add_members",
    ),
  );
  assert.ok(
    getAvailableChatActions(chat("group", "admin", { onlyAdminsCanAddMembers: true })).includes(
      "add_members",
    ),
  );
  assert.deepEqual(getAvailableChatActions(chat("community_chat", "admin")), [
    "view_community_info",
    "change_chat_photo",
    "search_in_chat",
    "mute",
    "mark_unread",
    "pin",
    "clear_chat",
  ]);
  assert.ok(
    !getAvailableChatActions(chat("community_chat", "member")).includes("change_chat_photo"),
  );
  const direct = chat();
  if (direct.own) {
    direct.own.pinned_at = "2026-01-01";
    direct.own.muted_until = "9999-12-31T23:59:59Z";
  }
  assert.ok(getAvailableChatActions(direct).includes("unmute"));
  assert.ok(getAvailableChatActions(direct).includes("unpin"));
  assert.deepEqual(
    getAvailableChatActions({ ...chat(), readOnly: true, status: "pending_request" }),
    ["view_profile", "search_in_chat", "block"],
  );
});
test("channel menus enforce OC-02 staff unfollow lock and OC-04 admin reporting", () => {
  assert.deepEqual(
    getAvailableChannelActions({ following: true, canSearch: true, hasLink: true, isOwner: false }),
    [
      "view_channel_info",
      "search_in_chat",
      "mute",
      "mark_unread",
      "unfollow",
      "copy_channel_link",
      "report",
    ],
  );
  assert.deepEqual(
    getAvailableChannelActions({
      following: true,
      canSearch: true,
      hasLink: true,
      isAdmin: true,
      isOwner: false,
    }),
    ["view_channel_info", "search_in_chat", "mute", "mark_unread", "copy_channel_link", "report"],
  );
  assert.deepEqual(
    getAvailableChannelActions({ following: true, canSearch: true, hasLink: true, isOwner: true }),
    ["view_channel_info", "search_in_chat", "mute", "mark_unread", "copy_channel_link"],
  );
  assert.deepEqual(
    getAvailableChannelActions({ following: false, canSearch: false, hasLink: true }),
    ["view_channel_info", "follow", "copy_channel_link", "report"],
  );
  assert.deepEqual(
    getAvailableChannelActions({ following: false, canSearch: true, hasLink: false }),
    ["view_channel_info", "search_in_chat", "follow", "report"],
  );
});
test("member selection deduplicates, permits removal at capacity, and rejects a 51st", () => {
  const ids = Array.from({ length: 50 }, (_, i) => String(i));
  assert.throws(() => toggleMember(ids, "51"));
  assert.equal(toggleMember(ids, "1").length, 49);
  assert.deepEqual(toggleMember(["one"], "one"), []);
});
test("reports require an Other explanation, enforce length, and build public-only payloads", () => {
  assert.equal(validReport("other", "  "), false);
  assert.equal(validReport("other", "detail"), true);
  assert.equal(validReport("spam", ""), true);
  assert.equal(validReport("harassment", "a".repeat(501)), false);
  assert.equal(validReport("inappropriate", "a".repeat(500)), true);
  assert.equal(validReport("unknown", "detail"), false);
  assert.deepEqual(
    buildReportPayload(
      "me",
      { kind: "channel", channelId: "ch-1", name: "News" },
      "spam",
      "  promo links  ",
    ),
    {
      reporter_id: "me",
      reported_channel_id: "ch-1",
      reported_user_id: null,
      reason: "spam",
      description: "promo links",
    },
  );
  assert.deepEqual(
    buildReportPayload(
      "me",
      { kind: "user", userId: "u-2", name: "Bob", username: "bob", blockUserId: "u-2" },
      "harassment",
      "   ",
    ),
    {
      reporter_id: "me",
      reported_channel_id: null,
      reported_user_id: "u-2",
      reason: "harassment",
      description: null,
    },
  );
});
test("direct pair ordering is canonical and mute expiry distinguishes Always from unmute", () => {
  assert.equal(directPairKey("b", "a"), "a::b");
  assert.equal(directPairKey("a", "b"), "a::b");
  assert.equal(muteUntil(8, 0), "1970-01-01T08:00:00.000Z");
  assert.equal(muteUntil(Infinity), "9999-12-31T23:59:59Z");
  assert.equal(muteUntil(null), null);
});
