import { Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { CommunityChatSidebar } from "@/features/communities/components/CommunityChatSidebar";
import { useCommunity } from "@/features/communities/hooks/useCommunity";
import { QueryState } from "@/features/settings/components/shared";
import "@/styles/communities.css";
export function CommunityLayout() {
  const { communityId } = useParams({ from: "/_authenticated/communities/$communityId" });
  const query = useCommunity(communityId);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeChatId = pathname.match(/\/chats\/([^/]+)/)?.[1];
  if (!query.data)
    return (
      <main id="main" className="p-6">
        <QueryState
          loading={query.isPending}
          error={query.error}
          retry={() => void query.refetch()}
        />
      </main>
    );
  return (
    <div className="community-layout flex min-w-0 overflow-hidden">
      <div className="hidden h-full shrink-0 lg:block">
        <CommunityChatSidebar community={query.data} activeChatId={activeChatId} />
      </div>
      <div className="h-full min-h-0 min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
