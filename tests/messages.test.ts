import assert from "node:assert/strict";
import test from "node:test";
import { grouped, groupMessages } from "../src/features/messages/lib/groupMessages.ts";
import { messageStatus } from "../src/features/messages/lib/messageStatus.ts";
import type { Member, Message, MessageRow } from "../src/features/messages/types.ts";
import { dateLabel, formatBytes } from "../src/features/messages/utils/formatMessageTime.ts";

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
  file_upload_id: null,
  media_thumbnail_upload_id: null,
  mentions: null,
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
