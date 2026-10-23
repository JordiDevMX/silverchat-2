import type { QueryClient } from "@tanstack/react-query";
export async function refreshNovedades(cache: QueryClient, userId: string) {
  await Promise.all(
    ["stories", "my-stories", "story-viewers", "channels", "discover-channels", "channel-info"].map(
      (key) => cache.invalidateQueries({ queryKey: [key, userId] }),
    ),
  );
}
