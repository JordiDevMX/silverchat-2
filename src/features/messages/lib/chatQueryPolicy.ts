import type { ChatDetails } from "../types.ts";

// Active chats stay live through useRealtimeMessages and explicit mutations, so
// polling every 30s or refetching on window focus only amplifies backend load.
export const CHAT_QUERY_OPTIONS = {
  staleTime: 60_000,
  refetchOnWindowFocus: false,
} as const;

// Presence is only rendered for direct chats (online threshold is 120s, heartbeat is 90s).
export const PRESENCE_QUERY_OPTIONS = {
  staleTime: 30_000,
  refetchInterval: 60_000,
  refetchOnWindowFocus: false,
} as const;

export function getPresenceTargetIds(
  chat: Pick<ChatDetails, "type"> & { other?: { id?: string | null } },
): string[] {
  if (chat.type !== "direct") return [];
  return chat.other?.id ? [chat.other.id] : [];
}

// Initial mount already triggers TanStack Query fetches; only invalidate on reconnect.
export function createReconnectRefresh(refresh: () => void): (status: string) => void {
  let subscribedOnce = false;
  return (status: string) => {
    if (status === "SUBSCRIBED") {
      if (subscribedOnce) refresh();
      subscribedOnce = true;
    }
  };
}
