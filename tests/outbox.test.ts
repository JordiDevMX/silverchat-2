import assert from "node:assert/strict";
import test from "node:test";
import {
  clearChatOutbox,
  clearUserOutbox,
  enqueueOutboxEntry,
  isOfflineOrNetworkError,
  type OutboxEntry,
  outboxStorageKey,
  readOutbox,
  removeOutboxEntry,
  toOutboxMessage,
  updateOutboxStatus,
} from "../src/features/messages/lib/outbox.ts";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
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
}

const now = Date.now();
const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();

const entry = (patch: Partial<OutboxEntry> = {}): OutboxEntry => ({
  clientId: "11111111-1111-4111-8111-111111111111",
  userId: "alice",
  chatId: "chat-1",
  channelMode: false,
  createdAt: iso(-60_000),
  status: "pending",
  input: { type: "text", content: "Hola offline" },
  ...patch,
});

test("outbox persists per user in chronological order and tolerates corrupt or expired entries", () => {
  const storage = createMemoryStorage();

  enqueueOutboxEntry(
    entry({
      clientId: "c-2",
      createdAt: iso(-10_000),
      input: { type: "text", content: "Second" },
    }),
    storage,
  );
  enqueueOutboxEntry(
    entry({
      clientId: "c-1",
      createdAt: iso(-50_000),
      input: { type: "text", content: "First" },
    }),
    storage,
  );
  enqueueOutboxEntry(
    entry({
      userId: "bob",
      clientId: "c-bob",
      input: { type: "text", content: "Bob message" },
    }),
    storage,
  );

  const aliceItems = readOutbox(storage, "alice", now);
  assert.deepEqual(
    aliceItems.map((m) => m.clientId),
    ["c-1", "c-2"],
  );
  assert.equal(readOutbox(storage, "bob", now).length, 1);

  // Corrupt JSON does not throw.
  storage.setItem(outboxStorageKey("corrupt"), "{bad json");
  assert.deepEqual(readOutbox(storage, "corrupt", now), []);

  // Expired entries (> 30 days) are pruned on read.
  enqueueOutboxEntry(
    entry({
      clientId: "c-old",
      createdAt: iso(-31 * 86_400_000),
    }),
    storage,
  );
  assert.deepEqual(
    readOutbox(storage, "alice", now).map((m) => m.clientId),
    ["c-1", "c-2"],
  );
});

test("outbox supports status updates, single removal, chat clear and user clear", () => {
  const storage = createMemoryStorage();
  enqueueOutboxEntry(entry({ clientId: "c-1", chatId: "chat-1" }), storage);
  enqueueOutboxEntry(entry({ clientId: "c-2", chatId: "chat-2" }), storage);

  updateOutboxStatus("alice", "c-1", "failed", storage);
  assert.equal(readOutbox(storage, "alice").find((m) => m.clientId === "c-1")?.status, "failed");

  updateOutboxStatus("alice", "c-1", "pending", storage);
  assert.equal(readOutbox(storage, "alice").find((m) => m.clientId === "c-1")?.status, "pending");

  removeOutboxEntry("alice", "c-1", storage);
  assert.deepEqual(
    readOutbox(storage, "alice").map((m) => m.clientId),
    ["c-2"],
  );

  clearChatOutbox("alice", "chat-2", storage);
  assert.equal(readOutbox(storage, "alice").length, 0);
  assert.equal(storage.getItem(outboxStorageKey("alice")), null);

  enqueueOutboxEntry(entry({ clientId: "c-3", chatId: "chat-1" }), storage);
  clearUserOutbox("alice", storage);
  assert.equal(storage.getItem(outboxStorageKey("alice")), null);
});

test("toOutboxMessage builds temp message with matching localStatus and fields", () => {
  const msg = toOutboxMessage(
    entry({
      clientId: "uuid-1",
      chatId: "chat-9",
      channelMode: false,
      status: "pending",
      input: { type: "text", content: "Pending body", reply_to_message_id: "orig-1" },
    }),
  );
  assert.equal(msg.id, "temp-uuid-1");
  assert.equal(msg.clientId, "uuid-1");
  assert.equal(msg.chat_id, "chat-9");
  assert.equal(msg.channel_id, null);
  assert.equal(msg.sender_id, "alice");
  assert.equal(msg.content, "Pending body");
  assert.equal(msg.reply_to_message_id, "orig-1");
  assert.equal(msg.localStatus, "pending");
});

test("isOfflineOrNetworkError separates offline/transport failures from HTTP server errors", () => {
  assert.equal(isOfflineOrNetworkError(new Error("anything"), 503, false), true);
  assert.equal(isOfflineOrNetworkError({ message: "TypeError: Failed to fetch" }, 0, true), true);
  assert.equal(isOfflineOrNetworkError(new TypeError("Failed to fetch"), undefined, true), true);
  assert.equal(isOfflineOrNetworkError({ message: "Load failed" }, undefined, true), true);

  // HTTP 503 with message "Offline" while navigator is online is a server error, not offline transport.
  assert.equal(isOfflineOrNetworkError({ message: "Offline" }, 503, true), false);
  assert.equal(isOfflineOrNetworkError({ message: "new row violates RLS" }, 403, true), false);
  assert.equal(
    isOfflineOrNetworkError(
      { code: "42501", message: 'new row violates row-level security policy for table "messages"' },
      undefined,
      true,
    ),
    false,
  );
});
