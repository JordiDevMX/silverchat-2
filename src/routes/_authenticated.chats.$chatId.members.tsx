import { useParams } from "@tanstack/react-router";
import { GroupMembersList } from "@/features/chat-settings/components/GroupMembersList";
export function GroupMembersPage() {
  const { chatId } = useParams({ from: "/_authenticated/chats/$chatId/members" });
  return <GroupMembersList key={chatId} chatId={chatId} />;
}
