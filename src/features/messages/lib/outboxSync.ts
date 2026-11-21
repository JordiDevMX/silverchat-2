import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { type Message, messageKey, outboxKey, type Profile, type SendInput } from "../types";
import {
  enqueueOutboxEntry,
  groupOutboxByChat,
  isOfflineOrNetworkError,
  type OutboxEntry,
  readOutbox,
  removeOutboxEntry,
  toOutboxMessage,
  updateOutboxStatus,
} from "./outbox";

class OfflineTransportError extends Error {
  constructor(cause?: unknown) {
    super(cause instanceof Error ? cause.message : "Offline transport failure");
    this.name = "OfflineTransportError";
  }
}

type Waiter = {
  resolve: () => void;
  reject: (error: unknown) => void;
};

const activeFlushes = new Map<string, Promise<void>>();
const rerunRequested = new Set<string>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const retryAttempts = new Map<string, number>();
const entryWaiters = new Map<string, Waiter[]>();

function settleWaiters(clientId: string, error?: unknown) {
  const waiters = entryWaiters.get(clientId);
  if (!waiters) return;
  entryWaiters.delete(clientId);
  for (const waiter of waiters) {
    if (error !== undefined) waiter.reject(error);
    else waiter.resolve();
  }
}

function addWaiter(clientId: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const existing = entryWaiters.get(clientId);
    if (existing) existing.push({ resolve, reject });
    else entryWaiters.set(clientId, [{ resolve, reject }]);
  });
}

function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function clearOutboxRetryTimer(userId: string) {
  const timer = retryTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    retryTimers.delete(userId);
  }
}

export function resetOutboxBackoff(userId: string) {
  retryAttempts.delete(userId);
  clearOutboxRetryTimer(userId);
}

function scheduleOutboxRetry(cache: QueryClient, userId: string) {
  if (!userId || retryTimers.has(userId) || !isOnline()) return;
  const attempt = retryAttempts.get(userId) ?? 0;
  retryAttempts.set(userId, attempt + 1);
  const delay = Math.min(2000 * 2 ** attempt, 30_000);
  const timer = setTimeout(() => {
    retryTimers.delete(userId);
    void flushOutbox(cache, userId);
  }, delay);
  retryTimers.set(userId, timer);
}

export function syncChatOutboxCache(cache: QueryClient, userId: string, chatId: string) {
  if (!userId || !chatId) return;
  const messages = readOutbox(undefined, userId)
    .filter((entry) => entry.chatId === chatId)
    .map(toOutboxMessage);
  cache.setQueryData<Message[]>(outboxKey(userId, chatId), messages);
}

export function hydrateOutboxCache(cache: QueryClient, userId: string) {
  if (!userId) return;
  const grouped = groupOutboxByChat(readOutbox(undefined, userId));
  const cachedQueries = cache.getQueryCache().findAll({ queryKey: ["message-outbox", userId] });
  for (const query of cachedQueries) {
    const chatId = query.queryKey[2];
    if (typeof chatId === "string" && !grouped.has(chatId)) {
      cache.setQueryData<Message[]>(outboxKey(userId, chatId), []);
    }
  }
  for (const [chatId, entries] of grouped) {
    cache.setQueryData<Message[]>(outboxKey(userId, chatId), entries.map(toOutboxMessage));
  }
}

function isPermanentPolicyError(error: unknown, status?: number): boolean {
  if (status === 403) return true;
  if (error && typeof error === "object" && "code" in error && error.code === "42501") return true;
  return false;
}

async function deliverOutboxEntry(cache: QueryClient, entry: OutboxEntry) {
  const { upload: _upload, thumbnail: _thumbnail, ...fields } = entry.input;
  try {
    const result = await supabase
      .from("messages")
      .insert({
        ...fields,
        id: entry.clientId,
        ...(entry.channelMode ? { channel_id: entry.chatId } : { chat_id: entry.chatId }),
        sender_id: entry.userId,
      })
      .select("id")
      .single();
    if (result.error) {
      if (isPermanentPolicyError(result.error, result.status)) {
        throw result.error;
      }
      if (isOfflineOrNetworkError(result.error, result.status)) {
        throw new OfflineTransportError(result.error);
      }
      // An ambiguous failure may already have committed. Reconcile with the same client UUID.
      const existing = await supabase
        .from("messages")
        .select("id")
        .eq("id", entry.clientId)
        .eq(entry.channelMode ? "channel_id" : "chat_id", entry.chatId)
        .eq("sender_id", entry.userId)
        .maybeSingle();
      if (existing.error && isOfflineOrNetworkError(existing.error, existing.status)) {
        throw new OfflineTransportError(existing.error);
      }
      if (existing.error || !existing.data) throw result.error;
    }
  } catch (error) {
    if (error instanceof OfflineTransportError || isOfflineOrNetworkError(error)) {
      throw error instanceof OfflineTransportError ? error : new OfflineTransportError(error);
    }
    throw error;
  }

  await Promise.all([
    cache.invalidateQueries({ queryKey: messageKey(entry.userId, entry.chatId) }),
    cache.invalidateQueries({
      queryKey: [entry.channelMode ? "channels" : "chats", entry.userId],
    }),
  ]);
  removeOutboxEntry(entry.userId, entry.clientId);
  syncChatOutboxCache(cache, entry.userId, entry.chatId);
}

export async function flushOutbox(cache: QueryClient, userId: string): Promise<void> {
  if (!userId) return;
  const existing = activeFlushes.get(userId);
  if (existing) {
    rerunRequested.add(userId);
    return existing;
  }

  const run = (async () => {
    do {
      rerunRequested.delete(userId);
      const pending = readOutbox(undefined, userId).filter((entry) => entry.status === "pending");
      if (!pending.length) {
        resetOutboxBackoff(userId);
        break;
      }
      if (!isOnline()) {
        for (const entry of pending) settleWaiters(entry.clientId);
        break;
      }

      let transportBlocked = false;
      for (const entry of pending) {
        if (!isOnline()) {
          transportBlocked = true;
          break;
        }
        try {
          await deliverOutboxEntry(cache, entry);
          resetOutboxBackoff(userId);
          settleWaiters(entry.clientId);
        } catch (error) {
          if (error instanceof OfflineTransportError) {
            transportBlocked = true;
            settleWaiters(entry.clientId);
            scheduleOutboxRetry(cache, userId);
            break;
          }
          updateOutboxStatus(userId, entry.clientId, "failed");
          syncChatOutboxCache(cache, userId, entry.chatId);
          settleWaiters(entry.clientId, error);
        }
      }

      if (transportBlocked) {
        for (const entry of readOutbox(undefined, userId)) {
          if (entry.status === "pending") settleWaiters(entry.clientId);
        }
        break;
      }
    } while (rerunRequested.has(userId));
  })().finally(() => {
    activeFlushes.delete(userId);
  });

  activeFlushes.set(userId, run);
  return run;
}

export async function enqueueAndSendMessage({
  cache,
  userId,
  chatId,
  channelMode,
  input,
  sender,
  clientId = crypto.randomUUID(),
}: {
  cache: QueryClient;
  userId: string;
  chatId: string;
  channelMode: boolean;
  input: SendInput;
  sender?: Profile;
  clientId?: string;
}): Promise<void> {
  const existing = readOutbox(undefined, userId);
  const lastTime = existing.reduce(
    (max, item) => Math.max(max, Date.parse(item.createdAt) || 0),
    0,
  );
  const createdAt = new Date(Math.max(Date.now(), lastTime + 1)).toISOString();

  enqueueOutboxEntry({
    clientId,
    userId,
    chatId,
    channelMode,
    createdAt,
    status: "pending",
    input,
    sender,
  });
  syncChatOutboxCache(cache, userId, chatId);

  if (!isOnline()) {
    return;
  }

  resetOutboxBackoff(userId);
  const wait = addWaiter(clientId);
  void flushOutbox(cache, userId);
  return wait;
}
