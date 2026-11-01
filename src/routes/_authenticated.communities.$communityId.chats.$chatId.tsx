import { useParams, useSearch } from "@tanstack/react-router";
import { CommunityChatView } from "@/features/communities/components/CommunityChatView";
export function CommunityChatPage() {
  const { communityId, chatId } = useParams({
    from: "/_authenticated/communities/$communityId/chats/$chatId",
  });
  const { scrollTo } = useSearch({
    from: "/_authenticated/communities/$communityId/chats/$chatId",
  });
  return (
    <CommunityChatView key={chatId} communityId={communityId} chatId={chatId} scrollTo={scrollTo} />
  );
}
