import { useParams, useSearch } from "@tanstack/react-router";
import { SharedMediaView } from "@/features/chat-settings/components/SharedMediaView";
export function SharedMediaPage() {
  const { chatId, communityId } = useParams({ strict: false });
  const { tab } = useSearch({ strict: false });
  if (!chatId) return null;
  return (
    <SharedMediaView
      key={chatId}
      chatId={chatId}
      communityId={communityId}
      tab={tab === "files" ? "files" : "media"}
    />
  );
}
