import type { Chat } from "../../chats/types.ts";

/** Filters candidate forward destinations to active, unblocked, writable chats matching the search text. */
export function filterForwardTargets(chats: Chat[], search: string): Chat[] {
  const query = search.toLocaleLowerCase();
  return chats.filter(
    (chat) =>
      !chat.archivedAt &&
      !chat.isBlocked &&
      chat.canSend !== false &&
      chat.displayName.toLocaleLowerCase().includes(query),
  );
}
