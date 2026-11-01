import { useParams } from "@tanstack/react-router";
import { CommunityChatSidebar } from "@/features/communities/components/CommunityChatSidebar";
import { useCommunity } from "@/features/communities/hooks/useCommunity";
import { useMessageText } from "@/features/messages/i18n";
export function CommunityIndexPage() {
  const { communityId } = useParams({ from: "/_authenticated/communities/$communityId/" });
  const query = useCommunity(communityId);
  const { say } = useMessageText();
  return (
    <main id="main" className="h-full">
      <div className="h-full lg:hidden">
        {query.data && <CommunityChatSidebar community={query.data} />}
      </div>
      <div className="hidden h-full items-center justify-center text-muted-foreground lg:flex">
        {say("Select a chat", "Selecciona un chat")}
      </div>
    </main>
  );
}
