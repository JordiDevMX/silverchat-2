import { useEffect } from "react";
import { cleanupDrafts } from "../drafts";
import { navigationUnread } from "../utils/computeChatDisplay";
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
  // Community chats notify the Communities tab, every other chat the Chats tab.
  const { chatUnread, communityUnread } = navigationUnread(data);
  return { unread: chatUnread, communityUnread };
}
