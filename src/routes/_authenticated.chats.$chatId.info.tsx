import { useParams } from "@tanstack/react-router";
import { GroupSettingsScreen } from "@/features/chat-settings/components/GroupSettingsScreen";
export function GroupInfoPage() {
  const { chatId } = useParams({ from: "/_authenticated/chats/$chatId/info" });
  return <GroupSettingsScreen key={chatId} chatId={chatId} />;
}
