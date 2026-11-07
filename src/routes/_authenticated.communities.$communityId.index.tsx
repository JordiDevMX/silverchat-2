import { useParams } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
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
      <div className="community-empty-pane hidden lg:flex">
        <span className="community-empty-icon">
          <MessageCircle size={32} aria-hidden="true" />
        </span>
        <p>{say("Select a chat", "Selecciona un chat")}</p>
      </div>
    </main>
  );
}
