import type { Draft } from "./types.ts";

const prefix = "silverchat_draft_";
export const draftEvent = "silverchat:drafts";
export function readDrafts(storage: Storage, ownerId?: string, now = Date.now()) {
  const drafts = new Map<string, Draft>();
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(prefix)) continue;
      try {
        const value: unknown = JSON.parse(storage.getItem(key) ?? "null");
        if (!value || typeof value !== "object") continue;
        const d = value as Draft;
        if (
          typeof d.text !== "string" ||
          !Array.isArray(d.mediaUrls) ||
          !d.mediaUrls.every((x) => typeof x === "string") ||
          (d.replyToId !== null && typeof d.replyToId !== "string") ||
          !Number.isFinite(Date.parse(d.updatedAt)) ||
          now - Date.parse(d.updatedAt) > 30 * 86400000 ||
          (d.ownerId && d.ownerId !== ownerId)
        )
          continue;
        drafts.set(key.slice(prefix.length), d);
      } catch {
        /* One corrupt draft must not hide other drafts. */
      }
    }
  } catch {
    /* Storage may be unavailable in private mode. */
  }
  return drafts;
}
export function cleanupDrafts(storage: Storage, now = Date.now()) {
  try {
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
    for (const key of keys) {
      if (!key?.startsWith(prefix)) continue;
      try {
        const d = JSON.parse(storage.getItem(key) ?? "null");
        if (
          !d ||
          !Number.isFinite(Date.parse(d.updatedAt)) ||
          now - Date.parse(d.updatedAt) > 30 * 86400000
        )
          storage.removeItem(key);
      } catch {
        storage.removeItem(key);
      }
    }
  } catch {
    /* Storage is optional. */
  }
}
export function writeDraft(chatId: string, draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(prefix + chatId, JSON.stringify(draft));
    else localStorage.removeItem(prefix + chatId);
    window.dispatchEvent(new Event(draftEvent));
    return true;
  } catch {
    return false;
  }
}
// Prompt 08 can hold one writer per composer and call flush() before navigation.
export function createDraftWriter(chatId: string, ownerId: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Draft | null | undefined;
  const flush = () => {
    clearTimeout(timer);
    if (pending === undefined) return true;
    const success = writeDraft(chatId, pending);
    if (success) pending = undefined;
    return success;
  };
  return {
    write(draft: Omit<Draft, "ownerId"> | null) {
      pending = draft ? { ...draft, ownerId } : null;
      clearTimeout(timer);
      timer = setTimeout(flush, 500);
    },
    flush,
    cancel() {
      clearTimeout(timer);
      pending = undefined;
    },
  };
}
