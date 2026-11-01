import type { QueryClient } from "@tanstack/react-query";
export async function refreshCommunities(cache: QueryClient, userId: string) {
  await Promise.all(
    [
      "communities",
      "community",
      "community-chats",
      "community-members",
      "chats",
      "chat-detail",
    ].map((key) => cache.invalidateQueries({ queryKey: [key, userId] })),
  );
}
