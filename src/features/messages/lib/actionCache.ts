import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { type Cursor, type Message, messageKey } from "../types";
export type MessagePages = InfiniteData<{ rows: Message[]; cursor?: NonNullable<Cursor> }, Cursor>;
export function patchMessage(
  cache: QueryClient,
  userId: string,
  chatId: string,
  id: string,
  patch: (m: Message) => Message | null,
) {
  cache.setQueryData<MessagePages>(messageKey(userId, chatId), (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            rows: page.rows.flatMap((m) => {
              if (m.id === id) {
                const result = patch(m);
                return result ? [result] : [];
              }
              return [m];
            }),
          })),
        }
      : old,
  );
  cache.setQueryData<Message[]>(["pinned", userId, chatId], (old) =>
    old?.flatMap((m) => {
      const result = m.id === id ? patch(m) : m;
      return result?.is_pinned_in_chat && !result.deleted_for_everyone ? [result] : [];
    }),
  );
}
export async function invalidateActions(cache: QueryClient, userId: string, chatId: string) {
  await Promise.all(
    [
      messageKey(userId, chatId),
      ["pinned", userId, chatId],
      ["reply-draft", userId, chatId],
      ["chats", userId],
      ["first-unread", userId, chatId],
    ].map((queryKey) => cache.invalidateQueries({ queryKey })),
  );
}
