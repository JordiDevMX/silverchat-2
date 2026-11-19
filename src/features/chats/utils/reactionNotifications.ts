import { createStore } from "zustand/vanilla";
import type { Database } from "../../../types/database.ts";
import type { MessageType } from "../types.ts";

export interface ReactionNotificationEntry {
  messageId: string;
  chatId: string;
  communityId?: string | null;
  reactorId: string;
  reactorName: string;
  emoji: string;
  createdAt: string;
  messageType: MessageType;
  messageContent: string | null;
}

export function reactionEntryKey(messageId: string, reactorId: string) {
  return `${messageId}:${reactorId}`;
}

export function shouldNotifyForReaction(input: {
  currentUserId: string;
  messageSenderId: string | null | undefined;
  reactorId: string;
  chatId: string | null | undefined;
  deletedForEveryone: boolean;
  chatType?: Database["public"]["Enums"]["chat_type"];
  isBlocked?: boolean;
}) {
  if (!input.currentUserId || !input.chatId || input.deletedForEveryone) return false;
  if (input.chatType === "self") return false;
  if (input.reactorId === input.currentUserId) return false;
  if (input.messageSenderId !== input.currentUserId) return false;
  if (input.isBlocked) return false;
  return true;
}

export function isReactionUnread(
  createdAt: string,
  lastReadAt: string | null | undefined,
  joinedAt: string | null | undefined,
) {
  const watermark = lastReadAt ?? joinedAt;
  if (!watermark) return false;
  const createdMs = Date.parse(createdAt);
  const watermarkMs = Date.parse(watermark);
  if (Number.isNaN(createdMs) || Number.isNaN(watermarkMs)) return false;
  return createdMs > watermarkMs;
}

export function isViewingChatPath(
  pathname: string,
  chatId: string,
  visibilityState: string = "visible",
) {
  if (visibilityState !== "visible" || !chatId) return false;
  const normalized = pathname.replace(/\/$/, "");
  if (normalized === `/chats/${chatId}`) return true;
  if (normalized.startsWith("/communities/")) {
    const parts = normalized.split("/");
    return parts.length === 5 && parts[3] === "chats" && parts[4] === chatId;
  }
  return false;
}

export function formatMessageSnippet(
  type: MessageType,
  content: string | null,
  language: "en" | "es",
) {
  const es = language === "es";
  const trimmed = (content ?? "").replace(/\s+/g, " ").trim();
  if (type === "text" || (trimmed && (type === "image" || type === "video"))) {
    const short = trimmed.length > 40 ? `${trimmed.slice(0, 39)}…` : trimmed;
    if (short) return es ? `«${short}»` : `"${short}"`;
  }
  switch (type) {
    case "image":
      return es ? "📷 Foto" : "📷 Photo";
    case "video":
      return "🎥 Video";
    case "audio":
      return "🎤 Audio";
    case "file":
      return es ? "📄 Archivo" : "📄 File";
    case "sticker":
      return "🎨 Sticker";
    case "location":
      return es ? "📍 Ubicación" : "📍 Location";
    case "contact":
      return es ? "👤 Contacto" : "👤 Contact";
    default:
      return es ? "tu mensaje" : "your message";
  }
}

function sortEntriesNewestFirst(entries: ReactionNotificationEntry[]) {
  return [...entries].sort(
    (a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.reactorId.localeCompare(b.reactorId),
  );
}

export function aggregateReactionSummary(
  entries: ReactionNotificationEntry[],
  language: "en" | "es",
) {
  if (!entries.length) return null;
  const deduped = new Map<string, ReactionNotificationEntry>();
  for (const entry of sortEntriesNewestFirst(entries)) {
    if (!deduped.has(entry.reactorId)) deduped.set(entry.reactorId, entry);
  }
  const distinct = [...deduped.values()];
  const newest = distinct[0];
  if (!newest) return null;

  const sameEmoji = distinct.every((e) => e.emoji === newest.emoji);
  const snippet = formatMessageSnippet(newest.messageType, newest.messageContent, language);
  const es = language === "es";
  let text: string;
  if (distinct.length === 1) {
    text = es
      ? `${newest.reactorName} reaccionó ${newest.emoji} a ${snippet}`
      : `${newest.reactorName} reacted ${newest.emoji} to ${snippet}`;
  } else if (distinct.length === 2) {
    const second = distinct[1];
    if (sameEmoji) {
      text = es
        ? `${newest.reactorName} y ${second?.reactorName ?? ""} reaccionaron ${newest.emoji}`
        : `${newest.reactorName} and ${second?.reactorName ?? ""} reacted ${newest.emoji}`;
    } else {
      text = es
        ? `${newest.reactorName} y ${second?.reactorName ?? ""} reaccionaron a ${snippet}`
        : `${newest.reactorName} and ${second?.reactorName ?? ""} reacted to ${snippet}`;
    }
  } else {
    const others = distinct.length - 1;
    if (sameEmoji) {
      text = es
        ? `${newest.reactorName} y ${others} más reaccionaron ${newest.emoji}`
        : `${newest.reactorName} and ${others} others reacted ${newest.emoji}`;
    } else {
      text = es
        ? `${newest.reactorName} y ${others} más reaccionaron a ${snippet}`
        : `${newest.reactorName} and ${others} others reacted to ${snippet}`;
    }
  }
  const href = newest.communityId
    ? `/communities/${newest.communityId}/chats/${newest.chatId}?scrollTo=${newest.messageId}`
    : `/chats/${newest.chatId}?scrollTo=${newest.messageId}`;
  return {
    text,
    href,
    chatId: newest.chatId,
    messageId: newest.messageId,
    createdAt: newest.createdAt,
  };
}

export function buildChatReactionSummary(entries: ReactionNotificationEntry[]): {
  unreadReactionCount: number;
  reactionSummary: {
    messageId: string;
    createdAt: string;
    entries: ReactionNotificationEntry[];
  } | null;
} {
  if (!entries.length) return { unreadReactionCount: 0, reactionSummary: null };
  const sorted = sortEntriesNewestFirst(entries);
  const newest = sorted[0];
  if (!newest) return { unreadReactionCount: 0, reactionSummary: null };
  const forNewestMessage = sorted.filter((e) => e.messageId === newest.messageId);
  return {
    unreadReactionCount: sorted.length,
    reactionSummary: {
      messageId: newest.messageId,
      createdAt: newest.createdAt,
      entries: forNewestMessage,
    },
  };
}

export function mergeChatReactionEntries(
  chatId: string,
  dbEntries: ReactionNotificationEntry[],
  storeState: Pick<
    ReactionNotificationStoreState,
    "entries" | "clearedAtByChat" | "withdrawnAtByKey"
  >,
): ReactionNotificationEntry[] {
  const clearedAt = storeState.clearedAtByChat[chatId] ?? 0;
  const merged = new Map<string, ReactionNotificationEntry>();
  for (const entry of dbEntries) {
    const key = reactionEntryKey(entry.messageId, entry.reactorId);
    const createdMs = Date.parse(entry.createdAt);
    if (!Number.isNaN(createdMs) && createdMs <= clearedAt) continue;
    const withdrawnAt = storeState.withdrawnAtByKey[key];
    if (withdrawnAt !== undefined && !Number.isNaN(createdMs) && createdMs <= withdrawnAt) continue;
    merged.set(key, entry);
  }
  for (const [key, entry] of Object.entries(storeState.entries)) {
    if (entry.chatId !== chatId) continue;
    const createdMs = Date.parse(entry.createdAt);
    if (!Number.isNaN(createdMs) && createdMs <= clearedAt) continue;
    const prev = merged.get(key);
    if (!prev || Date.parse(entry.createdAt) >= Date.parse(prev.createdAt)) {
      merged.set(key, entry);
    }
  }
  return sortEntriesNewestFirst([...merged.values()]);
}

export interface ReactionNotificationStoreState {
  entries: Record<string, ReactionNotificationEntry>;
  seenSignatures: Record<string, string>;
  withdrawnAtByKey: Record<string, number>;
  clearedAtByChat: Record<string, number>;
  activeToastChatId: string | null;
  activeToastMessageId: string | null;
  pendingNavigation: { chatId: string; messageId: string; serial: number } | null;
  setActiveToast: (chatId: string | null, messageId: string | null) => void;
  upsert: (entry: ReactionNotificationEntry) => {
    status: "added" | "swapped" | "duplicate" | "stale";
    messageEntries: ReactionNotificationEntry[];
  };
  withdraw: (
    messageId: string,
    reactorId: string,
    atMs?: number,
  ) => {
    removed: boolean;
    wasActiveToast: boolean;
    remainingForMessage: ReactionNotificationEntry[];
    remainingForChat: ReactionNotificationEntry[];
  };
  clearChat: (chatId: string, upToMs?: number) => boolean;
  hydrateFromDb: (dbEntries: ReactionNotificationEntry[]) => void;
  getChatEntries: (chatId: string) => ReactionNotificationEntry[];
  requestNavigation: (chatId: string, messageId: string) => void;
  clearNavigation: (serial: number) => void;
  reset: () => void;
}

export function createReactionNotificationStore() {
  let navSerial = 0;
  return createStore<ReactionNotificationStoreState>((set, get) => ({
    entries: {},
    seenSignatures: {},
    withdrawnAtByKey: {},
    clearedAtByChat: {},
    activeToastChatId: null,
    activeToastMessageId: null,
    pendingNavigation: null,
    setActiveToast: (chatId, messageId) =>
      set({ activeToastChatId: chatId, activeToastMessageId: messageId }),
    upsert: (entry) => {
      const state = get();
      const key = reactionEntryKey(entry.messageId, entry.reactorId);
      const signature = `${entry.emoji}|${entry.createdAt}`;
      const clearedAt = state.clearedAtByChat[entry.chatId];
      const createdMs = Date.parse(entry.createdAt);
      if (clearedAt !== undefined && !Number.isNaN(createdMs) && createdMs <= clearedAt) {
        return {
          status: "stale",
          messageEntries: Object.values(state.entries).filter(
            (e) => e.messageId === entry.messageId,
          ),
        };
      }
      if (state.seenSignatures[key] === signature) {
        return {
          status: "duplicate",
          messageEntries: Object.values(state.entries).filter(
            (e) => e.messageId === entry.messageId,
          ),
        };
      }
      const existing = state.entries[key];
      const nextEntries = { ...state.entries, [key]: entry };
      const nextSigs = { ...state.seenSignatures, [key]: signature };
      const nextWithdrawn = { ...state.withdrawnAtByKey };
      delete nextWithdrawn[key];
      set({ entries: nextEntries, seenSignatures: nextSigs, withdrawnAtByKey: nextWithdrawn });
      return {
        status: existing ? "swapped" : "added",
        messageEntries: Object.values(nextEntries).filter((e) => e.messageId === entry.messageId),
      };
    },
    withdraw: (messageId, reactorId, atMs = Date.now()) => {
      const state = get();
      const key = reactionEntryKey(messageId, reactorId);
      const existing = state.entries[key];
      const existingMs = existing ? Date.parse(existing.createdAt) : 0;
      const effectiveAt = Math.max(atMs, Number.isNaN(existingMs) ? 0 : existingMs);
      const nextEntries = { ...state.entries };
      delete nextEntries[key];
      const nextSigs = { ...state.seenSignatures };
      delete nextSigs[key];
      const nextWithdrawn = { ...state.withdrawnAtByKey, [key]: effectiveAt };
      const wasActiveToast =
        state.activeToastMessageId === messageId ||
        (!!existing && state.activeToastChatId === existing.chatId);
      const remainingForMessage = Object.values(nextEntries).filter(
        (e) => e.messageId === messageId,
      );
      const remainingForChat = existing
        ? Object.values(nextEntries).filter((e) => e.chatId === existing.chatId)
        : [];
      set({
        entries: nextEntries,
        seenSignatures: nextSigs,
        withdrawnAtByKey: nextWithdrawn,
        ...(wasActiveToast && !remainingForMessage.length
          ? { activeToastChatId: null, activeToastMessageId: null }
          : {}),
      });
      return {
        removed: !!existing,
        wasActiveToast,
        remainingForMessage,
        remainingForChat,
      };
    },
    clearChat: (chatId, upToMs = Date.now()) => {
      const state = get();
      const prevCleared = state.clearedAtByChat[chatId] ?? 0;
      let maxEntryMs = 0;
      const nextEntries: Record<string, ReactionNotificationEntry> = {};
      for (const [k, v] of Object.entries(state.entries)) {
        if (v.chatId === chatId) {
          const ms = Date.parse(v.createdAt);
          if (!Number.isNaN(ms) && ms > maxEntryMs) maxEntryMs = ms;
        } else {
          nextEntries[k] = v;
        }
      }
      const nextCleared = Math.max(prevCleared, upToMs, maxEntryMs);
      const wasActiveToast = state.activeToastChatId === chatId;
      set({
        entries: nextEntries,
        clearedAtByChat: { ...state.clearedAtByChat, [chatId]: nextCleared },
        ...(wasActiveToast ? { activeToastChatId: null, activeToastMessageId: null } : {}),
      });
      return wasActiveToast;
    },
    hydrateFromDb: (dbEntries) => {
      if (!dbEntries.length) return;
      const state = get();
      let changed = false;
      const nextEntries = { ...state.entries };
      const nextSigs = { ...state.seenSignatures };
      for (const entry of dbEntries) {
        const key = reactionEntryKey(entry.messageId, entry.reactorId);
        const createdMs = Date.parse(entry.createdAt);
        const clearedAt = state.clearedAtByChat[entry.chatId];
        if (clearedAt !== undefined && !Number.isNaN(createdMs) && createdMs <= clearedAt) continue;
        const withdrawnAt = state.withdrawnAtByKey[key];
        if (withdrawnAt !== undefined && !Number.isNaN(createdMs) && createdMs <= withdrawnAt)
          continue;
        const existing = nextEntries[key];
        if (!existing || Date.parse(entry.createdAt) > Date.parse(existing.createdAt)) {
          nextEntries[key] = entry;
          nextSigs[key] = `${entry.emoji}|${entry.createdAt}`;
          changed = true;
        }
      }
      if (changed) set({ entries: nextEntries, seenSignatures: nextSigs });
    },
    getChatEntries: (chatId) =>
      Object.values(get().entries).filter((entry) => entry.chatId === chatId),
    requestNavigation: (chatId, messageId) =>
      set({ pendingNavigation: { chatId, messageId, serial: ++navSerial } }),
    clearNavigation: (serial) =>
      set((state) =>
        state.pendingNavigation?.serial === serial ? { pendingNavigation: null } : state,
      ),
    reset: () =>
      set({
        entries: {},
        seenSignatures: {},
        withdrawnAtByKey: {},
        clearedAtByChat: {},
        activeToastChatId: null,
        activeToastMessageId: null,
        pendingNavigation: null,
      }),
  }));
}

export const reactionNotificationStore = createReactionNotificationStore();
