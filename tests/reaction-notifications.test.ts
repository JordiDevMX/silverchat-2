import assert from "node:assert/strict";
import test from "node:test";
import type { Chat } from "../src/features/chats/types.ts";
import {
  applyFilter,
  computeChatDisplay,
  navigationUnread,
} from "../src/features/chats/utils/computeChatDisplay.ts";
import {
  aggregateReactionSummary,
  buildChatReactionSummary,
  createReactionNotificationStore,
  isReactionUnread,
  isViewingChatPath,
  mergeChatReactionEntries,
  type ReactionNotificationEntry,
  shouldNotifyForReaction,
} from "../src/features/chats/utils/reactionNotifications.ts";

const baseEntry = (patch: Partial<ReactionNotificationEntry> = {}): ReactionNotificationEntry => ({
  messageId: "msg-1",
  chatId: "chat-1",
  communityId: null,
  reactorId: "user-b",
  reactorName: "Sofia Reyes",
  emoji: "👍",
  createdAt: "2026-11-18T12:00:00.000Z",
  messageType: "text",
  messageContent: "Hello there",
  ...patch,
});

test("shouldNotifyForReaction rejects self-reactions, non-authors, deleted, channel, self-chat, and blocked reactors", () => {
  const valid = {
    currentUserId: "user-a",
    messageSenderId: "user-a",
    reactorId: "user-b",
    chatId: "chat-1",
    deletedForEveryone: false,
    chatType: "direct" as const,
    isBlocked: false,
  };
  assert.equal(shouldNotifyForReaction(valid), true);
  assert.equal(shouldNotifyForReaction({ ...valid, reactorId: "user-a" }), false);
  assert.equal(shouldNotifyForReaction({ ...valid, messageSenderId: "user-c" }), false);
  assert.equal(shouldNotifyForReaction({ ...valid, messageSenderId: null }), false);
  assert.equal(shouldNotifyForReaction({ ...valid, chatId: null }), false);
  assert.equal(shouldNotifyForReaction({ ...valid, deletedForEveryone: true }), false);
  assert.equal(shouldNotifyForReaction({ ...valid, chatType: "self" }), false);
  assert.equal(shouldNotifyForReaction({ ...valid, isBlocked: true }), false);
});

test("isReactionUnread compares reaction timestamp against last_read_at or joined_at fallback", () => {
  assert.equal(
    isReactionUnread("2026-11-18T12:01:00Z", "2026-11-18T12:00:00Z", "2026-11-18T10:00:00Z"),
    true,
  );
  assert.equal(
    isReactionUnread("2026-11-18T12:00:00Z", "2026-11-18T12:00:00Z", "2026-11-18T10:00:00Z"),
    false,
  );
  assert.equal(isReactionUnread("2026-11-18T11:00:00Z", null, "2026-11-18T10:00:00Z"), true);
  assert.equal(isReactionUnread("2026-11-18T09:00:00Z", null, "2026-11-18T10:00:00Z"), false);
  assert.equal(isReactionUnread("2026-11-18T12:00:00Z", null, null), false);
});

test("aggregateReactionSummary formats single, dual, and multi-reactor aggregations in EN and ES", () => {
  const single = aggregateReactionSummary([baseEntry()], "en");
  assert.equal(single?.text, 'Sofia Reyes reacted 👍 to "Hello there"');
  assert.equal(single?.href, "/chats/chat-1?scrollTo=msg-1");

  const singleEs = aggregateReactionSummary([baseEntry()], "es");
  assert.equal(singleEs?.text, "Sofia Reyes reaccionó 👍 a «Hello there»");

  const photo = aggregateReactionSummary(
    [baseEntry({ messageType: "image", messageContent: null })],
    "en",
  );
  assert.equal(photo?.text, "Sofia Reyes reacted 👍 to 📷 Photo");

  const twoSame = aggregateReactionSummary(
    [
      baseEntry({
        reactorId: "user-b",
        reactorName: "Sofia Reyes",
        createdAt: "2026-11-18T12:00:00Z",
      }),
      baseEntry({
        reactorId: "user-c",
        reactorName: "Mateo Cruz",
        createdAt: "2026-11-18T12:01:00Z",
      }),
    ],
    "en",
  );
  assert.equal(twoSame?.text, "Mateo Cruz and Sofia Reyes reacted 👍");

  const fourSame = aggregateReactionSummary(
    [
      baseEntry({ reactorId: "u1", reactorName: "Sofia Reyes", createdAt: "2026-11-18T12:00:00Z" }),
      baseEntry({ reactorId: "u2", reactorName: "Mateo Cruz", createdAt: "2026-11-18T12:01:00Z" }),
      baseEntry({
        reactorId: "u3",
        reactorName: "Nora Bennett",
        createdAt: "2026-11-18T12:02:00Z",
      }),
      baseEntry({ reactorId: "u4", reactorName: "Leo Park", createdAt: "2026-11-18T12:03:00Z" }),
    ],
    "en",
  );
  assert.equal(fourSame?.text, "Leo Park and 3 others reacted 👍");

  const fourSameEs = aggregateReactionSummary(
    [
      baseEntry({ reactorId: "u1", reactorName: "Sofia Reyes", createdAt: "2026-11-18T12:00:00Z" }),
      baseEntry({ reactorId: "u2", reactorName: "Mateo Cruz", createdAt: "2026-11-18T12:01:00Z" }),
      baseEntry({
        reactorId: "u3",
        reactorName: "Nora Bennett",
        createdAt: "2026-11-18T12:02:00Z",
      }),
      baseEntry({ reactorId: "u4", reactorName: "Leo Park", createdAt: "2026-11-18T12:03:00Z" }),
    ],
    "es",
  );
  assert.equal(fourSameEs?.text, "Leo Park y 3 más reaccionaron 👍");

  const mixed = aggregateReactionSummary(
    [
      baseEntry({
        reactorId: "u1",
        reactorName: "Sofia Reyes",
        emoji: "👍",
        createdAt: "2026-11-18T12:00:00Z",
      }),
      baseEntry({
        reactorId: "u2",
        reactorName: "Mateo Cruz",
        emoji: "❤️",
        createdAt: "2026-11-18T12:01:00Z",
      }),
      baseEntry({
        reactorId: "u3",
        reactorName: "Leo Park",
        emoji: "🔥",
        createdAt: "2026-11-18T12:02:00Z",
      }),
    ],
    "en",
  );
  assert.equal(mixed?.text, 'Leo Park and 2 others reacted to "Hello there"');

  const community = aggregateReactionSummary([baseEntry({ communityId: "comm-1" })], "en");
  assert.equal(community?.href, "/communities/comm-1/chats/chat-1?scrollTo=msg-1");
});

test("isViewingChatPath matches active visible direct and community conversations only", () => {
  assert.equal(isViewingChatPath("/chats/chat-1", "chat-1", "visible"), true);
  assert.equal(isViewingChatPath("/communities/comm-1/chats/chat-1", "chat-1", "visible"), true);
  assert.equal(isViewingChatPath("/chats/chat-1/info", "chat-1", "visible"), false);
  assert.equal(isViewingChatPath("/chats/chat-2", "chat-1", "visible"), false);
  assert.equal(isViewingChatPath("/chats", "chat-1", "visible"), false);
  assert.equal(isViewingChatPath("/chats/chat-1", "chat-1", "hidden"), false);
});

test("reaction notification store handles dedupe, swap, withdrawal, and chat read clearing", () => {
  const store = createReactionNotificationStore();

  const first = store.getState().upsert(baseEntry());
  assert.equal(first.status, "added");
  assert.equal(first.messageEntries.length, 1);

  const dup = store.getState().upsert(baseEntry());
  assert.equal(dup.status, "duplicate");

  const swap = store
    .getState()
    .upsert(baseEntry({ emoji: "❤️", createdAt: "2026-11-18T12:00:05.000Z" }));
  assert.equal(swap.status, "swapped");
  assert.equal(swap.messageEntries.length, 1);
  assert.equal(swap.messageEntries[0]?.emoji, "❤️");

  store.getState().setActiveToast("chat-1", "msg-1");

  const secondReactor = store.getState().upsert(
    baseEntry({
      reactorId: "user-c",
      reactorName: "Mateo Cruz",
      emoji: "❤️",
      createdAt: "2026-11-18T12:01:00.000Z",
    }),
  );
  assert.equal(secondReactor.status, "added");
  assert.equal(secondReactor.messageEntries.length, 2);

  const withdrawnOne = store.getState().withdraw("msg-1", "user-b");
  assert.equal(withdrawnOne.removed, true);
  assert.equal(withdrawnOne.wasActiveToast, true);
  assert.equal(withdrawnOne.remainingForMessage.length, 1);

  const withdrawnTwo = store.getState().withdraw("msg-1", "user-c");
  assert.equal(withdrawnTwo.removed, true);
  assert.equal(withdrawnTwo.remainingForMessage.length, 0);

  // Re-reacting after withdrawal notifies again instead of being blocked by stale dedupe.
  const reAdded = store.getState().upsert(baseEntry({ createdAt: "2026-11-18T12:02:00.000Z" }));
  assert.equal(reAdded.status, "added");

  // Clearing chat blocks stale replays before clearedAt, but allows newer reactions.
  const clearedAt = Date.parse("2026-11-18T12:05:00.000Z");
  store.getState().clearChat("chat-1", clearedAt);
  assert.equal(store.getState().getChatEntries("chat-1").length, 0);

  const stale = store
    .getState()
    .upsert(baseEntry({ reactorId: "user-d", createdAt: "2026-11-18T12:04:00.000Z" }));
  assert.equal(stale.status, "stale");

  const newer = store
    .getState()
    .upsert(baseEntry({ reactorId: "user-d", createdAt: "2026-11-18T12:06:00.000Z" }));
  assert.equal(newer.status, "added");
});

test("mergeChatReactionEntries, computeChatDisplay, applyFilter, and navigationUnread reflect unread reactions and respect mute/archive", () => {
  const store = createReactionNotificationStore();
  const dbEntry = baseEntry({
    reactorId: "user-b",
    reactorName: "Sofia Reyes",
    emoji: "👍",
    createdAt: "2026-11-18T12:01:00.000Z",
  });
  store.getState().upsert(
    baseEntry({
      reactorId: "user-c",
      reactorName: "Mateo Cruz",
      emoji: "👍",
      createdAt: "2026-11-18T12:02:00.000Z",
    }),
  );

  const merged = mergeChatReactionEntries("chat-1", [dbEntry], store.getState());
  assert.equal(merged.length, 2);
  const summary = buildChatReactionSummary(merged);
  assert.equal(summary.unreadReactionCount, 2);

  const chat: Chat = {
    id: "chat-1",
    type: "direct",
    displayName: "Sofia Reyes",
    avatarUrl: null,
    memberNames: [],
    senderName: "Alice",
    lastMessageAt: "2026-11-18T12:00:00.000Z",
    lastMessagePreview: "Hello there",
    lastMessageType: "text",
    lastMessageStatus: "read",
    deletedForEveryone: false,
    isMyLastMessage: true,
    unreadCount: 0,
    unreadReactionCount: summary.unreadReactionCount,
    unreadReactions: merged,
    reactionSummary: summary.reactionSummary,
    manuallyUnread: false,
    pinnedAt: null,
    favoritedAt: null,
    archivedAt: null,
    mutedUntil: null,
    isBlocked: false,
    isLastAdmin: false,
  };

  const displayEn = computeChatDisplay(chat, undefined, "en");
  assert.equal(displayEn.state, "reaction");
  assert.equal(displayEn.text, "Mateo Cruz and Sofia Reyes reacted 👍");

  const displayEs = computeChatDisplay(chat, undefined, "es");
  assert.equal(displayEs.state, "reaction");
  assert.equal(displayEs.text, "Mateo Cruz y Sofia Reyes reaccionaron 👍");

  assert.equal(applyFilter([chat], "unread").length, 1);

  const mutedChat: Chat = { ...chat, id: "chat-muted", mutedUntil: "9999-12-31T00:00:00Z" };
  const archivedChat: Chat = { ...chat, id: "chat-arch", archivedAt: "2026-11-18T00:00:00Z" };
  const nav = navigationUnread([chat, mutedChat, archivedChat]);
  assert.equal(nav.chatUnread, 2);

  // Withdrawing user-b immediately suppresses the cached DB entry before refetch completes.
  store.getState().withdraw("msg-1", "user-b", Date.parse("2026-11-18T12:03:00.000Z"));
  const afterWithdraw = mergeChatReactionEntries("chat-1", [dbEntry], store.getState());
  assert.equal(afterWithdraw.length, 1);
  assert.equal(afterWithdraw[0]?.reactorId, "user-c");
});
