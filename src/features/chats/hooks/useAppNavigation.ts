import { useEffect } from "react";
import { cleanupDrafts } from "../drafts";
import { isMuted } from "../utils/computeChatDisplay";
import { useChats, useChatsRealtime } from "./useChats";

/** One subscription owner for both responsive navigation presentations. */
export function useAppNavigation() {
  const { data = [] } = useChats();
  useChatsRealtime();
  useEffect(() => {
    try {
      cleanupDrafts(localStorage);
    } catch {
      /* Optional storage. */
    }
  }, []);
  // Muted/archived chats don't produce tab notifications; manual dots aren't messages.
  const unread = data.reduce(
    (sum, c) => sum + (!c.archivedAt && !isMuted(c) ? c.unreadCount : 0),
    0,
  );
  return { unread };
}
