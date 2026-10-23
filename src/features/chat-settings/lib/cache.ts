import type { QueryClient } from "@tanstack/react-query";
export async function refreshChatSettings(cache: QueryClient, userId: string, chatId: string) {
  await Promise.all(
    [
      ["chat-detail", userId, chatId],
      ["messages", userId, chatId],
      ["shared-media", userId, chatId],
      ["pinned", userId, chatId],
      ["reply-draft", userId, chatId],
      ["first-unread", userId, chatId],
      ["chats", userId],
      ["contacts", userId],
      ["contact-profile", userId],
    ].map((queryKey) => cache.invalidateQueries({ queryKey })),
  );
}
