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
  navigationUnread,
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
test("navigation badges split community chats and skip muted or archived chats", () => {
  const rows = [
    { ...chat, id: "a", unreadCount: 4 },
    { ...chat, id: "b", type: "community_chat" as const, unreadCount: 3 },
    { ...chat, id: "c", type: "community_chat" as const, unreadCount: 5, mutedUntil: "9999-12-31" },
    { ...chat, id: "d", type: "community_chat" as const, unreadCount: 2, archivedAt: "2026-01-01" },
    { ...chat, id: "e", unreadCount: 7, mutedUntil: "9999-12-31" },
    { ...chat, id: "f", type: "group" as const, unreadCount: 6, manuallyUnread: true },
  ];
  const totals = navigationUnread(rows);
  assert.equal(totals.chatUnread, 10);
  assert.equal(totals.communityUnread, 3);
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
  const draftDisplay = computeChatDisplay(chat, draft);
  assert.equal(draftDisplay.state, "draft");
  assert.equal(draftDisplay.prefix, "");
  assert.equal(draftDisplay.text, "Draft text");
  assert.equal(draftDisplay.translateText, false);
  const blankDraft = computeChatDisplay(chat, { ...draft, text: "   " });
  assert.equal(blankDraft.state, "draft");
  assert.equal(blankDraft.text, "Attachment");
  assert.equal(blankDraft.translateText, true);
  assert.equal(computeChatDisplay(chat, { ...draft, failed: true }).state, "failed");
  const pendingBlank = computeChatDisplay(chat, { ...draft, text: " ", pending: true });
  assert.equal(pendingBlank.state, "pending");
  assert.equal(pendingBlank.text, "Attachment");
  assert.equal(pendingBlank.translateText, true);
  assert.equal(
    computeChatDisplay({ ...chat, deletedForEveryone: true, isMyLastMessage: true }).status,
    null,
  );
  assert.equal(computeChatDisplay({ ...chat, isMyLastMessage: true }).prefix, "You");
  assert.equal(computeChatDisplay({ ...chat, type: "self", isMyLastMessage: true }).prefix, "");
  assert.equal(computeChatDisplay({ ...chat, type: "group" }).prefix, "Alice");
  assert.equal(computeChatDisplay(chat, { ...draft, updatedAt: "2025-01-01" }).state, "message");
});
test("media previews strip duplicated DB icon/label prefixes while preserving captions, filenames, fallbacks and text messages", () => {
  const ownFile = computeChatDisplay({
    ...chat,
    isMyLastMessage: true,
    lastMessageType: "file",
    lastMessagePreview: "📄 Q4-report.pdf",
    lastMessageStatus: "read",
  });
  assert.deepEqual(ownFile, {
    state: "message",
    text: "Q4-report.pdf",
    translateText: false,
    prefix: "You",
    status: "read",
  });

  const fallbackFile = computeChatDisplay({
    ...chat,
    lastMessageType: "file",
    lastMessagePreview: "📄 File",
  });
  assert.equal(fallbackFile.text, "File");
  assert.equal(fallbackFile.translateText, true);

  assert.equal(
    computeChatDisplay({ ...chat, lastMessageType: "file", lastMessagePreview: "📄   " }).text,
    "File",
  );
  assert.equal(
    computeChatDisplay({ ...chat, lastMessageType: "file", lastMessagePreview: "📄 📄 notes.pdf" })
      .text,
    "📄 notes.pdf",
  );

  const captionedPhoto = computeChatDisplay({
    ...chat,
    type: "group",
    senderName: "Sofia",
    lastMessageType: "image",
    lastMessagePreview: "📷 Photo — Sunset at the beach",
  });
  assert.deepEqual(captionedPhoto, {
    state: "message",
    text: "Sunset at the beach",
    translateText: false,
    prefix: "Sofia",
    status: null,
  });

  const photoWordCaption = computeChatDisplay({
    ...chat,
    lastMessageType: "image",
    lastMessagePreview: "📷 Photo — Photography tips",
  });
  assert.equal(photoWordCaption.text, "Photography tips");
  assert.equal(photoWordCaption.translateText, false);

  for (const raw of ["📷 Photo", "📷 Photo —   ", "", null]) {
    const emptyPhoto = computeChatDisplay({
      ...chat,
      lastMessageType: "image",
      lastMessagePreview: raw,
    });
    assert.equal(emptyPhoto.text, "Photo");
    assert.equal(emptyPhoto.translateText, true);
  }

  assert.equal(
    computeChatDisplay({
      ...chat,
      lastMessageType: "video",
      lastMessagePreview: "🎥 Video — Demo clip",
    }).text,
    "Demo clip",
  );
  assert.equal(
    computeChatDisplay({ ...chat, lastMessageType: "video", lastMessagePreview: "🎥 Video" }).text,
    "Video",
  );
  assert.equal(
    computeChatDisplay({ ...chat, lastMessageType: "audio", lastMessagePreview: "🎤 Audio" }).text,
    "Audio",
  );
  assert.equal(
    computeChatDisplay({ ...chat, lastMessageType: "sticker", lastMessagePreview: "🎨 Sticker" })
      .text,
    "Sticker",
  );
  assert.equal(
    computeChatDisplay({ ...chat, lastMessageType: "location", lastMessagePreview: "📍 Location" })
      .text,
    "Location",
  );
  assert.equal(
    computeChatDisplay({ ...chat, lastMessageType: "contact", lastMessagePreview: "👤 Contact" })
      .text,
    "Contact",
  );

  // Plain text messages must never have emoji prefixes stripped.
  const plainWithEmoji = computeChatDisplay({
    ...chat,
    lastMessageType: "text",
    lastMessagePreview: "📷 Photo — not an attachment",
  });
  assert.equal(plainWithEmoji.text, "📷 Photo — not an attachment");
  assert.equal(plainWithEmoji.translateText, false);
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
