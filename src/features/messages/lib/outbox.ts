import type { Message, Profile, SendInput } from "../types.ts";

export const outboxStoragePrefix = "silverchat_outbox_";
export const outboxEvent = "silverchat:outbox";
const OUTBOX_TTL_MS = 30 * 86400000;

export interface OutboxEntry {
  clientId: string;
  userId: string;
  chatId: string;
  channelMode: boolean;
  createdAt: string;
  status: "pending" | "failed";
  input: SendInput;
  sender?: Profile;
}

export function outboxStorageKey(userId: string) {
  return `${outboxStoragePrefix}${userId}`;
}

function defaultStorage(): Storage | undefined {
  return typeof localStorage !== "undefined" ? localStorage : undefined;
}

function notifyOutboxChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(outboxEvent));
  }
}

function isValidEntry(value: unknown, userId: string, now: number): value is OutboxEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Partial<OutboxEntry>;
  if (
    typeof e.clientId !== "string" ||
    !e.clientId ||
    typeof e.chatId !== "string" ||
    !e.chatId ||
    typeof e.createdAt !== "string" ||
    !Number.isFinite(Date.parse(e.createdAt)) ||
    now - Date.parse(e.createdAt) > OUTBOX_TTL_MS ||
    (e.status !== "pending" && e.status !== "failed") ||
    typeof e.channelMode !== "boolean" ||
    !e.input ||
    typeof e.input !== "object" ||
    typeof e.input.type !== "string"
  ) {
    return false;
  }
  return !e.userId || e.userId === userId;
}

export function readOutbox(
  storage: Storage | undefined = defaultStorage(),
  userId = "",
  now = Date.now(),
): OutboxEntry[] {
  if (!storage || !userId) return [];
  try {
    const raw = storage.getItem(outboxStorageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const entries: OutboxEntry[] = [];
    for (const item of parsed) {
      if (isValidEntry(item, userId, now)) {
        entries.push({ ...item, userId });
      }
    }
    return entries.sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.clientId.localeCompare(b.clientId),
    );
  } catch {
    return [];
  }
}

export function writeOutbox(
  userId: string,
  entries: OutboxEntry[],
  storage: Storage | undefined = defaultStorage(),
): boolean {
  if (!storage || !userId) return false;
  try {
    const key = outboxStorageKey(userId);
    if (entries.length) storage.setItem(key, JSON.stringify(entries));
    else storage.removeItem(key);
    notifyOutboxChange();
    return true;
  } catch {
    return false;
  }
}

export function enqueueOutboxEntry(
  entry: OutboxEntry,
  storage: Storage | undefined = defaultStorage(),
): OutboxEntry[] {
  const existing = readOutbox(storage, entry.userId).filter((m) => m.clientId !== entry.clientId);
  const next = [...existing, entry].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.clientId.localeCompare(b.clientId),
  );
  writeOutbox(entry.userId, next, storage);
  return next;
}

export function updateOutboxStatus(
  userId: string,
  clientId: string,
  status: "pending" | "failed",
  storage: Storage | undefined = defaultStorage(),
): OutboxEntry[] {
  const next = readOutbox(storage, userId).map((m) =>
    m.clientId === clientId ? { ...m, status } : m,
  );
  writeOutbox(userId, next, storage);
  return next;
}

export function removeOutboxEntry(
  userId: string,
  clientId: string,
  storage: Storage | undefined = defaultStorage(),
): OutboxEntry[] {
  const next = readOutbox(storage, userId).filter((m) => m.clientId !== clientId);
  writeOutbox(userId, next, storage);
  return next;
}

export function clearChatOutbox(
  userId: string,
  chatId: string,
  storage: Storage | undefined = defaultStorage(),
): OutboxEntry[] {
  const next = readOutbox(storage, userId).filter((m) => m.chatId !== chatId);
  writeOutbox(userId, next, storage);
  return next;
}

export function clearUserOutbox(
  userId: string,
  storage: Storage | undefined = defaultStorage(),
): void {
  if (!storage || !userId) return;
  try {
    storage.removeItem(outboxStorageKey(userId));
    notifyOutboxChange();
  } catch {
    /* Optional storage. */
  }
}

export function groupOutboxByChat(entries: OutboxEntry[]): Map<string, OutboxEntry[]> {
  const grouped = new Map<string, OutboxEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.chatId);
    if (list) list.push(entry);
    else grouped.set(entry.chatId, [entry]);
  }
  return grouped;
}

export function toOutboxMessage(entry: OutboxEntry): Message {
  const { upload, thumbnail, ...fields } = entry.input;
  return {
    channel_id: entry.channelMode ? entry.chatId : null,
    chat_id: entry.channelMode ? null : entry.chatId,
    reply_to_story_id: null,
    contact_data: null,
    created_at: entry.createdAt,
    deleted_at: null,
    deleted_for_everyone: false,
    edited_at: null,
    file_upload_id: null,
    id: `temp-${entry.clientId}`,
    clientId: entry.clientId,
    is_pinned_in_chat: false,
    location_data: null,
    media_thumbnail_upload_id: null,
    mentions: null,
    media_peaks: null,
    forwarded_from_message_id: null,
    reply_to_message_id: null,
    sender_id: entry.userId,
    ...fields,
    upload,
    thumbnail,
    sender: entry.sender,
    receipts: [],
    reactions: [],
    unreadForMe: false,
    localStatus: entry.status,
  };
}

export function getOutboxMessages(
  userId: string,
  chatId: string,
  storage: Storage | undefined = defaultStorage(),
): Message[] {
  return readOutbox(storage, userId)
    .filter((entry) => entry.chatId === chatId)
    .map(toOutboxMessage);
}

const NETWORK_ERROR_PATTERN =
  /failed to fetch|load failed|networkerror|network request failed|internet_disconnected/i;

export function isOfflineOrNetworkError(
  error: unknown,
  status?: number,
  online = typeof navigator !== "undefined" ? navigator.onLine : true,
): boolean {
  if (!online) return true;
  if (typeof status === "number") {
    if (status === 0) return true;
    if (status >= 400) return false;
  }
  if (error instanceof TypeError) return true;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && NETWORK_ERROR_PATTERN.test(message)) return true;
  }
  return false;
}

