import { useParams } from "@tanstack/react-router";
import { SharedMediaView } from "@/features/chat-settings/components/SharedMediaView";
export function SharedMediaPage() {
  const { chatId } = useParams({ from: "/_authenticated/chats/$chatId/media" });
  return <SharedMediaView key={chatId} chatId={chatId} />;
}
