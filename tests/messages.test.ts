import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_QUERY_OPTIONS,
  createReconnectRefresh,
  getPresenceTargetIds,
  PRESENCE_QUERY_OPTIONS,
  shouldRefreshProfilesForMembershipEvent,
} from "../src/features/messages/lib/chatQueryPolicy.ts";
import { formatConversationText } from "../src/features/messages/lib/conversationStrings.ts";
import {
  grouped,
  groupMessages,
  shouldShowDateSeparator,
} from "../src/features/messages/lib/groupMessages.ts";
import { messageStatus } from "../src/features/messages/lib/messageStatus.ts";
import { formatSystemMessageText } from "../src/features/messages/lib/systemMessageText.ts";
import {
  canManageGroupWriteRule,
  isWriteRestricted,
} from "../src/features/messages/lib/writePermissions.ts";
import type { Member, Message, MessageRow } from "../src/features/messages/types.ts";
import { dateLabel, formatBytes } from "../src/features/messages/utils/formatMessageTime.ts";
import {
  computeSignedUrlRefreshMs,
  getSignedUrlPolicy,
  shouldRetrySignedUrl,
} from "../src/lib/signed-url-policy.ts";

const message = (patch: Partial<MessageRow> = {}): MessageRow => ({
  id: "one",
  sender_id: "alice",
  chat_id: "chat",
  channel_id: null,
  type: "text",
  content: "hello",
  created_at: "2026-01-01T12:00:00Z",
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
  ...patch,
});
test("grouping respects sender, five-minute boundary, local day and system breaks", () => {
  const a = message();
  assert.ok(grouped(a, message({ created_at: "2026-01-01T12:05:00Z" })));
  assert.equal(grouped(a, message({ created_at: "2026-01-01T12:05:01Z" })), false);
  assert.equal(grouped(a, message({ sender_id: "bob" })), false);
  assert.equal(grouped(a, message({ type: "system" })), false);
  const before = new Date(2026, 0, 1, 23, 59),
    after = new Date(2026, 0, 2, 0, 1);
  assert.equal(
    grouped(
      message({ created_at: before.toISOString() }),
      message({ created_at: after.toISOString() }),
    ),
    false,
  );
  const groups = groupMessages([a, message({ id: "two" })]);
  assert.equal(groups[0]?.groupedBefore, false);
  assert.equal(groups[1]?.groupedBefore, true);
});
test("receipt status is conservative for every intended recipient and failures override temporary IDs", () => {
  const m: Message = { ...message(), receipts: [], reactions: [], unreadForMe: false };
  const members: Pick<Member, "user_id" | "joined_at">[] = ["alice", "bob", "carol"].map(
    (user_id) => ({ user_id, joined_at: "2025-01-01" }),
  );
  assert.equal(messageStatus({ ...m, id: "temp-one", localStatus: "failed" }, members), "failed");
  assert.equal(messageStatus({ ...m, id: "temp-one" }, members), "pending");
  assert.equal(messageStatus(m, members), "sent");
  const receipt = (user_id: string, read_at: string | null) => ({
    message_id: "one",
    user_id,
    delivered_at: "2026-01-01",
    read_at,
  });
  m.receipts = [receipt("bob", "2026-01-01")];
  assert.equal(
    messageStatus(m, members),
    "sent",
    "A hidden receipt cannot imply delivery or reading",
  );
  m.receipts.push(receipt("carol", null));
  assert.equal(messageStatus(m, members), "delivered");
  const carol = m.receipts[1];
  assert.ok(carol);
  carol.read_at = "2026-01-01";
  assert.equal(messageStatus(m, members), "read");
  assert.equal(
    messageStatus(m, [...members, { user_id: "newcomer", joined_at: "2026-02-01" }]),
    "read",
    "Later joiners are not retroactive recipients",
  );
});
test("date labels cross year boundaries and bytes remain finite at zero", () => {
  const now = new Date(2026, 0, 1, 12),
    previous = new Date(2025, 11, 31, 12).toISOString();
  assert.equal(dateLabel(previous, "en", now), "Yesterday");
  assert.equal(dateLabel(previous, "es", now), "Ayer");
  assert.equal(formatBytes(0, "en"), "0 B");
  assert.equal(formatBytes(1536, "en"), "1.5 KB");
});
test("conversation strings resolve en/es translations and interpolate channel names safely", () => {
  assert.equal(formatConversationText("en", "conversation.start"), "Start of this conversation");
  assert.equal(formatConversationText("es", "conversation.start"), "Inicio de esta conversación");
  assert.equal(
    formatConversationText("en", "chat.encryptionNotice"),
    "Messages are end-to-end encrypted. No one outside of this chat can read or listen to them.",
  );
  assert.equal(
    formatConversationText("es", "chat.encryptionNotice"),
    "Los mensajes están cifrados de extremo a extremo. Nadie fuera de este chat puede leerlos ni escucharlos.",
  );
  assert.equal(
    formatConversationText("en", "channel.created", { name: "Deals $100" }),
    'Channel "Deals $100" was created',
  );
  assert.equal(
    formatConversationText("es", "channel.created", { name: "Novedades" }),
    'Se creó el canal "Novedades".',
  );
  assert.equal(formatConversationText("en", "channel.follow"), "Follow channel");
  assert.equal(formatConversationText("es", "channel.follow"), "Seguir canal");
});
test("date separator suppresses Today on the first message at conversation start but keeps other days", () => {
  const now = new Date(2026, 10, 18, 15, 0);
  const today = new Date(2026, 10, 18, 9, 0).toISOString();
  const yesterday = new Date(2026, 10, 17, 18, 0).toISOString();
  assert.equal(
    shouldShowDateSeparator({
      newDay: true,
      isFirstMessage: true,
      atConversationStart: true,
      createdAt: today,
      now,
    }),
    false,
  );
  assert.equal(
    shouldShowDateSeparator({
      newDay: true,
      isFirstMessage: true,
      atConversationStart: false,
      createdAt: today,
      now,
    }),
    true,
  );
  assert.equal(
    shouldShowDateSeparator({
      newDay: true,
      isFirstMessage: true,
      atConversationStart: true,
      createdAt: yesterday,
      now,
    }),
    true,
  );
  assert.equal(
    shouldShowDateSeparator({
      newDay: true,
      isFirstMessage: false,
      atConversationStart: true,
      createdAt: today,
      now,
    }),
    true,
  );
  assert.equal(
    shouldShowDateSeparator({
      newDay: false,
      isFirstMessage: false,
      atConversationStart: true,
      createdAt: today,
      now,
    }),
    false,
  );
});
test("chat query policy disables idle polling and window-focus bursts", () => {
  assert.equal("refetchInterval" in CHAT_QUERY_OPTIONS, false);
  assert.equal(CHAT_QUERY_OPTIONS.refetchOnWindowFocus, false);
  assert.equal(CHAT_QUERY_OPTIONS.staleTime, 60_000);
  assert.equal(PRESENCE_QUERY_OPTIONS.refetchInterval, 60_000);
  assert.equal(PRESENCE_QUERY_OPTIONS.refetchOnWindowFocus, false);
});
test("presence targets are restricted to direct chats with a known peer", () => {
  assert.deepEqual(getPresenceTargetIds({ type: "direct", other: { id: "bob" } }), ["bob"]);
  assert.deepEqual(getPresenceTargetIds({ type: "direct", other: undefined }), []);
  assert.deepEqual(getPresenceTargetIds({ type: "group", other: { id: "bob" } }), []);
  assert.deepEqual(getPresenceTargetIds({ type: "self", other: { id: "alice" } }), []);
  assert.deepEqual(getPresenceTargetIds({ type: "community_chat", other: { id: "bob" } }), []);
});
test("realtime subscribed handler skips initial mount fetch and refreshes on reconnect", () => {
  let calls = 0;
  const onStatus = createReconnectRefresh(() => {
    calls += 1;
  });
  onStatus("JOINING");
  onStatus("SUBSCRIBED");
  assert.equal(calls, 0);
  onStatus("CHANNEL_ERROR");
  onStatus("SUBSCRIBED");
  assert.equal(calls, 1);
  onStatus("SUBSCRIBED");
  assert.equal(calls, 2);
});
test("signed URL policies always expire cache and refresh strictly before Storage TTL", () => {
  for (const bucket of ["avatars", "chat-media", "story-media", "channel-media"]) {
    const policy = getSignedUrlPolicy(bucket);
    const ttlMs = policy.ttlSeconds * 1000;
    const minRefresh = computeSignedUrlRefreshMs(bucket, 0);
    const maxRefresh = computeSignedUrlRefreshMs(bucket, 1);
    assert.ok(policy.staleTimeMs < ttlMs, `${bucket}: staleTime must be shorter than TTL`);
    assert.ok(policy.gcTimeMs < ttlMs, `${bucket}: gcTime must be shorter than TTL`);
    assert.ok(policy.staleTimeMs <= policy.gcTimeMs, `${bucket}: staleTime <= gcTime`);
    assert.ok(minRefresh >= policy.staleTimeMs, `${bucket}: refresh should not beat staleTime`);
    assert.ok(maxRefresh < ttlMs, `${bucket}: max jittered refresh must occur before TTL expiry`);
  }
});
test("signed URL retry stops immediately on permanent 4xx errors and storage outages", () => {
  for (const status of [400, 401, 403, 404]) {
    assert.equal(shouldRetrySignedUrl(0, status, false), false);
  }
  assert.equal(shouldRetrySignedUrl(0, 500, true), false);
  assert.equal(shouldRetrySignedUrl(0, 504, false), true);
  assert.equal(shouldRetrySignedUrl(1, 504, false), false);
  assert.equal(shouldRetrySignedUrl(0, 500, false), true);
  assert.equal(shouldRetrySignedUrl(1, 500, false), true);
  assert.equal(shouldRetrySignedUrl(2, 500, false), false);
});
test("chat_members realtime updates do not trigger global profile and avatar invalidations", () => {
  assert.equal(shouldRefreshProfilesForMembershipEvent("INSERT"), true);
  assert.equal(shouldRefreshProfilesForMembershipEvent("DELETE"), true);
  assert.equal(shouldRefreshProfilesForMembershipEvent("UPDATE"), false);
  assert.equal(shouldRefreshProfilesForMembershipEvent(undefined), false);
});
test("systemMessageText localizes leave and removal notices including apostrophes and Member fallback", () => {
  assert.equal(formatSystemMessageText("'Alice' left the chat", "en"), "'Alice' left the chat");
  assert.equal(formatSystemMessageText("'Alice' left the chat", "es"), "'Alice' salió del chat");
  assert.equal(
    formatSystemMessageText("'O'Connor' left the chat", "es"),
    "'O'Connor' salió del chat",
  );
  assert.equal(formatSystemMessageText("'Member' left the chat", "es"), "'Miembro' salió del chat");
  assert.equal(
    formatSystemMessageText("'Alice' was removed from the chat", "es"),
    "'Alice' fue eliminado del chat",
  );
  assert.equal(
    formatSystemMessageText("'Member' was removed from the chat", "es"),
    "'Miembro' fue eliminado del chat",
  );
  assert.equal(formatSystemMessageText("'Alice' joined the chat", "en"), "'Alice' joined the chat");
  assert.equal(formatSystemMessageText("'Alice' joined the chat", "es"), "'Alice' se unió al chat");
  assert.equal(
    formatSystemMessageText("'O'Connor' joined the chat", "es"),
    "'O'Connor' se unió al chat",
  );
  assert.equal(
    formatSystemMessageText("'Member' joined the chat", "es"),
    "'Miembro' se unió al chat",
  );
  assert.equal(formatSystemMessageText("Custom notice", "es"), "Custom notice");
  assert.equal(formatSystemMessageText(null, "es"), "");
});
test("isWriteRestricted gates non-admin members in admin-only groups and community chats while excluding channels", () => {
  assert.equal(
    isWriteRestricted({
      type: "group",
      onlyAdminsCanSend: true,
      channelMode: false,
      own: { role: "member" } as never,
    }),
    true,
  );
  assert.equal(
    isWriteRestricted({
      type: "community_chat",
      onlyAdminsCanSend: true,
      channelMode: false,
      own: { role: "member" } as never,
    }),
    true,
  );
  assert.equal(
    isWriteRestricted({
      type: "group",
      onlyAdminsCanSend: true,
      channelMode: false,
      own: { role: "admin" } as never,
    }),
    false,
  );
  assert.equal(
    isWriteRestricted({
      type: "group",
      onlyAdminsCanSend: false,
      channelMode: false,
      own: { role: "member" } as never,
    }),
    false,
  );
  assert.equal(
    isWriteRestricted({
      type: "direct",
      onlyAdminsCanSend: true,
      channelMode: false,
      own: { role: "member" } as never,
    }),
    false,
  );
  assert.equal(
    isWriteRestricted({
      type: "direct",
      onlyAdminsCanSend: true,
      channelMode: true,
      own: undefined,
    }),
    false,
  );
});
test("canManageGroupWriteRule allows only group admins in group context and excludes community_chat", () => {
  assert.equal(canManageGroupWriteRule("group", "group", "admin"), true);
  assert.equal(canManageGroupWriteRule("group", "group", "member"), false);
  assert.equal(canManageGroupWriteRule("group", "community_chat", "admin"), false);
  assert.equal(canManageGroupWriteRule("community", "group", "admin"), false);
  assert.equal(canManageGroupWriteRule("community", "community_chat", "admin"), false);
});
