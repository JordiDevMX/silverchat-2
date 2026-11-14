import { Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { AppSkeleton } from "@/features/auth/components";
import { nextDestination, safeRedirect } from "@/features/auth/navigation";
import type { AuthState } from "@/features/auth/types";
import { ChatDetailsPanel } from "@/features/chats/components/ChatDetailsPanel";
import { ChatLayout } from "@/features/chats/components/ChatLayout";
import { ChatList } from "@/features/chats/components/ChatList";
import { CommunityChatSidebar } from "@/features/communities/components/CommunityChatSidebar";
import { useCommunity } from "@/features/communities/hooks/useCommunity";
import { PendingDeletionBanner } from "@/features/settings/components/PendingDeletionBanner";
import { QueryState } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
export function requireAuthentication(auth: AuthState, href: string, pathname: string) {
  if (auth.sessionExpired) return;
  if (!auth.user)
    throw redirect({
      href: `/auth/login?${new URLSearchParams({ redirect: safeRedirect(href) })}`,
    });
  if (auth.mfaRequired)
    throw redirect({
      href: `/auth/2fa-verify?${new URLSearchParams({ redirect: safeRedirect(href) })}`,
    });
  if (
    /^user_[a-f0-9]{8}$/.test(auth.profile?.username ?? "") &&
    pathname !== "/onboarding/pick-username"
  )
    throw redirect({ href: nextDestination(auth.profile?.username, href) });
}
export function AuthenticatedLayout() {
  const auth = useAuth();
  const onboarding = useRouterState({
    select: (state) => state.location.pathname.startsWith("/onboarding"),
  });
  if (!auth.user || auth.mfaRequired) return <AppSkeleton />;
  if (onboarding)
    return (
      <>
        <PendingDeletionBanner />
        <Outlet />
      </>
    );
  return <SectionLayout />;
}

function SectionLayout() {
  const params = useRouterState({ select: (state) => state.matches.at(-1)?.params });
  const communityId = params && "communityId" in params ? params.communityId : undefined;
  const chatId = params && "chatId" in params ? params.chatId : undefined;
  const path = useRouterState({ select: (state) => state.location.pathname.replace(/\/$/, "") });
  const community = useCommunity(communityId ?? "");
  if (communityId && !community.data)
    return (
      <ChatLayout>
        <main id="main" className="p-6">
          <QueryState
            loading={community.isPending}
            error={community.error}
            retry={() => void community.refetch()}
          />
        </main>
      </ChatLayout>
    );
  if (!communityId && path !== "/chats" && !chatId)
    return (
      <ChatLayout>
        <Outlet />
      </ChatLayout>
    );
  const listOnly = path === "/chats" || path === `/communities/${communityId}`;
  return (
    <ChatLayout
      listOnly={listOnly}
      list={
        community.data && communityId ? (
          <CommunityChatSidebar
            key={communityId}
            community={community.data}
            activeChatId={chatId}
          />
        ) : (
          <ChatList activeChatId={chatId} />
        )
      }
      details={chatId && <ChatDetailsPanel chatId={chatId} communityId={communityId} />}
    >
      <Outlet />
    </ChatLayout>
  );
}
