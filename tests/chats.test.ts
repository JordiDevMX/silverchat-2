import assert from "node:assert/strict";
import test from "node:test";
import { cleanupDrafts, readDrafts } from "../src/features/chats/drafts.ts";
import type { Chat } from "../src/features/chats/types.ts";
import { validateChatSearch } from "../src/features/chats/utils/chatSearch.ts";
import {
  applyFilter,
  applySearch,
  badgeText,
  computeChatDisplay,
  isMuted,
  orderChats,
  receiptStatus,
} from "../src/features/chats/utils/computeChatDisplay.ts";
import { formatChatTimestamp } from "../src/features/chats/utils/formatChatTimestamp.ts";

const chat: Chat = {
  id: "a",
  type: "direct",
  displayName: "Alice",
  avatarUrl: null,
  memberNames: [],
  senderName: "Alice",
  lastMessageAt: "2026-01-01T00:00:00Z",
  lastMessagePreview: "Hi",
  lastMessageType: "text",
  lastMessageStatus: "sent",
  deletedForEveryone: false,
  isMyLastMessage: false,
  unreadCount: 0,
  manuallyUnread: false,
  pinnedAt: null,
  favoritedAt: null,
  archivedAt: null,
  mutedUntil: null,
  isBlocked: false,
  isLastAdmin: false,
};
test("seven filters scope local search; archived and blocked semantics", () => {
  const rows = [
    chat,
    { ...chat, id: "b", displayName: "Old", archivedAt: "2026-01-01", isBlocked: true },
    {
      ...chat,
      id: "c",
      type: "group" as const,
      memberNames: ["Caroline"],
      manuallyUnread: true,
      favoritedAt: "2026-01-01",
      mutedUntil: "9999-12-31",
    },
  ];
  assert.equal(applyFilter(rows, "all").length, 2);
  assert.equal(applyFilter(rows, "favorites").length, 1);
  assert.equal(applyFilter(rows, "unread")[0]?.id, "c");
  assert.equal(applyFilter(rows, "groups")[0]?.id, "c");
  assert.equal(applyFilter(rows, "archived")[0]?.id, "b");
  assert.equal(applyFilter(rows, "blocked")[0]?.id, "b");
  assert.equal(applyFilter(rows, "muted")[0]?.id, "c");
  assert.equal(applySearch(applyFilter(rows, "all"), "old").length, 0);
  assert.equal(applySearch(rows, "caroline")[0]?.id, "c");
  assert.equal(isMuted({ ...chat, mutedUntil: "2020-01-01" }), false);
  assert.equal(badgeText(100), "99+");
});
test("pin timestamp wins; equal pin falls back to last message and null sorts last", () => {
  const rows = [
    chat,
    { ...chat, id: "b", pinnedAt: "2026-01-01", lastMessageAt: null },
    { ...chat, id: "c", pinnedAt: "2026-01-01", lastMessageAt: "2026-01-03" },
  ];
  assert.deepEqual(
    orderChats(rows).map((c) => c.id),
    ["c", "b", "a"],
  );
  assert.equal(rows[0]?.id, "a");
});
test("receipt aggregation respects hidden/partial recipients and read privacy", () => {
  const r = { user_id: "b", delivered_at: "now", read_at: "now" };
  assert.equal(receiptStatus([r], ["b", "c"]), "sent");
  assert.equal(receiptStatus([r], ["b"]), "read");
  assert.equal(receiptStatus([{ ...r, read_at: null }], ["b"]), "delivered");
  assert.equal(receiptStatus([], []), "sent");
});
test("drafts override older previews without changing unread; deleted ignores receipts", () => {
  const draft = { text: "Draft text", mediaUrls: [], replyToId: null, updatedAt: "2026-01-02" };
  assert.equal(computeChatDisplay(chat, draft).state, "draft");
  assert.equal(computeChatDisplay(chat, { ...draft, failed: true }).state, "failed");
  assert.equal(computeChatDisplay(chat, { ...draft, pending: true }).state, "pending");
  assert.equal(
    computeChatDisplay({ ...chat, deletedForEveryone: true, isMyLastMessage: true }).status,
    null,
  );
  assert.equal(computeChatDisplay({ ...chat, isMyLastMessage: true }).prefix, "You");
  assert.equal(computeChatDisplay({ ...chat, type: "self", isMyLastMessage: true }).prefix, "");
  assert.equal(computeChatDisplay({ ...chat, type: "group" }).prefix, "Alice");
  assert.equal(computeChatDisplay(chat, { ...draft, updatedAt: "2025-01-01" }).state, "message");
});
test("yesterday works across month/year boundaries and uses locale", () => {
  const now = new Date(2026, 0, 1, 12);
  const yesterday = new Date(2025, 11, 31, 12).toISOString();
  assert.equal(formatChatTimestamp(yesterday, "en", now), "yesterday");
  assert.equal(formatChatTimestamp(yesterday, "es", now), "ayer");
  assert.equal(formatChatTimestamp("invalid", "en", now), "");
  assert.equal(formatChatTimestamp(null, "en", now), "");
});
test("draft storage tolerates malformed JSON, removes expired entries and isolates owners", () => {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => {
      values.set(k, v);
    },
    removeItem: (k) => {
      values.delete(k);
    },
    key: (i) => [...values.keys()][i] ?? null,
    clear: () => values.clear(),
  };
  const valid = {
    text: "Saved",
    mediaUrls: [],
    replyToId: null,
    updatedAt: "2026-01-31",
    ownerId: "alice",
  };
  storage.setItem("silverchat_draft_a", JSON.stringify(valid));
  storage.setItem("silverchat_draft_b", "broken");
  storage.setItem("silverchat_draft_c", JSON.stringify({ ...valid, updatedAt: "2025-01-01" }));
  storage.setItem("unrelated", "keep");
  const now = Date.parse("2026-02-01");
  assert.equal(readDrafts(storage, "alice", now).size, 1);
  assert.equal(readDrafts(storage, "bob", now).size, 0);
  cleanupDrafts(storage, now);
  assert.equal(storage.length, 2);
  assert.equal(storage.getItem("unrelated"), "keep");
});

test("URL validation handles TanStack JSON-decoded booleans and numeric searches", () => {
  assert.equal(validateChatSearch({ select: true, q: 123 }).select, "true");
  assert.equal(validateChatSearch({ select: "true", q: 123 }).q, "123");
  assert.equal(validateChatSearch({ filter: "requests", selectedIds: "invalid" }).filter, "all");
  assert.equal(validateChatSearch({ selectedIds: "invalid" }).selectedIds, "");
  assert.equal(validateChatSearch({ q: "a".repeat(400) }).q.length, 200);
});
