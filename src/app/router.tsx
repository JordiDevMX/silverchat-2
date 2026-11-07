import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
  stripSearchParams,
} from "@tanstack/react-router";
import { InfrastructureNotice } from "@/components/ui/auth-surfaces";
import { Button } from "@/components/ui/button";
import { RouteErrorState } from "@/components/ui/route-error-state";
import { ChatSettingsNotice } from "@/features/chat-settings/components/ChatSettingsNotice";
import "@/styles/chat-settings.css";
import { AuthFrame, InlineError, SessionExpiredModal } from "@/features/auth/components";
import { useDestinationActions } from "@/features/auth/hooks/useDestinationActions";
import type { AuthState } from "@/features/auth/types";
import { validateChatSearch } from "@/features/chats/utils/chatSearch";
import { AuthenticatedLayout, requireAuthentication } from "@/routes/_authenticated";

const MfaVerifyPage = lazyRouteComponent(() => import("@/routes/auth.2fa-verify"), "MfaVerifyPage");
const CheckEmailPage = lazyRouteComponent(
  () => import("@/routes/auth.check-email"),
  "CheckEmailPage",
);
const AuthErrorPage = lazyRouteComponent(() => import("@/routes/auth.error"), "AuthErrorPage");
const LoginPage = lazyRouteComponent(() => import("@/routes/auth.login"), "LoginPage");
const PostLoginPage = lazyRouteComponent(() => import("@/routes/auth.post-login"), "PostLoginPage");
const SignupPage = lazyRouteComponent(() => import("@/routes/auth.signup"), "SignupPage");
const LandingPage = lazyRouteComponent(() => import("@/routes/index"), "LandingPage");
const PickUsernamePage = lazyRouteComponent(
  () => import("@/routes/onboarding.pick-username"),
  "PickUsernamePage",
);
const WelcomePage = lazyRouteComponent(() => import("@/routes/onboarding.welcome"), "WelcomePage");
const SecurityPage = lazyRouteComponent(() => import("@/routes/settings.security"), "SecurityPage");
function Root() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Outlet />
      <SessionExpiredModal />
      <ChatSettingsNotice />
    </>
  );
}
// Auth landing destination only; messaging and the devices UI belong to later prompts.
function AuthenticatedDestination() {
  const { auth, busy, error, signOut } = useDestinationActions();
  return (
    <AuthFrame
      title={`You’re signed in, ${auth.profile?.display_name ?? "friend"}.`}
      subtitle="Your SilverChat account is ready."
    >
      {auth.user?.user_metadata.requires_reenrollment &&
        !auth.user.factors?.some((factor) => factor.status === "verified") && (
          <InfrastructureNotice>
            Backup code used. Please re-enable 2FA in settings.
          </InfrastructureNotice>
        )}
      <Button asChild>
        <a href="/settings">Settings</a>
      </Button>
      <Button variant="outline" type="button" disabled={busy} onClick={signOut}>
        {busy ? "Signing out…" : "Sign out"}
      </Button>
      <InlineError>{error}</InlineError>
    </AuthFrame>
  );
}
const root = createRootRouteWithContext<{ auth: AuthState }>()({
  component: Root,
  beforeLoad: ({ context, location }) => {
    if (
      /^\/(chats|channels|novedades|communities|calls|settings|profile|onboarding)(\/|$)/.test(
        location.pathname,
      )
    ) {
      requireAuthentication(context.auth, location.href, location.pathname);
    }
  },
  notFoundComponent: () => (
    <AuthFrame title="Page not found">
      <InfrastructureNotice>This page could not be found.</InfrastructureNotice>
      <Button asChild>
        <a href="/">Return home</a>
      </Button>
    </AuthFrame>
  ),
});
const publicRoutes = [
  createRoute({ getParentRoute: () => root, path: "/", component: LandingPage }),
  createRoute({ getParentRoute: () => root, path: "/auth/login", component: LoginPage }),
  createRoute({ getParentRoute: () => root, path: "/auth/signup", component: SignupPage }),
  createRoute({ getParentRoute: () => root, path: "/auth/check-email", component: CheckEmailPage }),
  createRoute({ getParentRoute: () => root, path: "/auth/post-login", component: PostLoginPage }),
  createRoute({ getParentRoute: () => root, path: "/auth/error", component: AuthErrorPage }),
  createRoute({ getParentRoute: () => root, path: "/auth/2fa-verify", component: MfaVerifyPage }),
];
const authenticated = createRoute({
  getParentRoute: () => root,
  id: "_authenticated",
  component: AuthenticatedLayout,
  beforeLoad: ({ context, location }) =>
    requireAuthentication(context.auth, location.href, location.pathname),
});
const settings = createRoute({
  getParentRoute: () => authenticated,
  path: "/settings",
  component: lazyRouteComponent(() => import("@/routes/settings"), "SettingsLayout"),
});
const settingsChildren = [
  createRoute({
    getParentRoute: () => settings,
    path: "/",
    component: lazyRouteComponent(() => import("@/routes/settings.index"), "SettingsIndexPage"),
  }),
  createRoute({
    getParentRoute: () => settings,
    path: "profile",
    component: lazyRouteComponent(() => import("@/routes/settings.profile"), "EditProfilePage"),
  }),
  createRoute({
    getParentRoute: () => settings,
    path: "profile/social",
    component: lazyRouteComponent(
      () => import("@/routes/settings.profile.social"),
      "SocialLinksPage",
    ),
  }),
  createRoute({
    getParentRoute: () => settings,
    path: "account",
    component: lazyRouteComponent(() => import("@/routes/settings.account"), "AccountPage"),
  }),
  createRoute({
    getParentRoute: () => settings,
    path: "devices",
    component: lazyRouteComponent(() => import("@/routes/settings.devices"), "DevicesPage"),
  }),
  createRoute({
    getParentRoute: () => settings,
    path: "storage",
    component: lazyRouteComponent(() => import("@/routes/settings.storage"), "StoragePage"),
  }),
  createRoute({
    getParentRoute: () => settings,
    path: "privacy",
    component: lazyRouteComponent(() => import("@/routes/settings.privacy"), "PrivacyPage"),
  }),
  createRoute({
    getParentRoute: () => settings,
    path: "privacy/blocked",
    component: lazyRouteComponent(
      () => import("@/routes/settings.privacy.blocked"),
      "BlockedContactsPage",
    ),
  }),
  createRoute({
    getParentRoute: () => settings,
    path: "privacy/visibility",
    component: lazyRouteComponent(
      () => import("@/routes/settings.privacy.visibility"),
      "VisibilityPage",
    ),
  }),
  createRoute({
    getParentRoute: () => settings,
    path: "appearance",
    component: lazyRouteComponent(() => import("@/routes/settings.appearance"), "AppearancePage"),
  }),
  createRoute({
    getParentRoute: () => settings,
    path: "notifications",
    component: lazyRouteComponent(
      () => import("@/routes/settings.notifications"),
      "NotificationsPage",
    ),
  }),
  createRoute({
    getParentRoute: () => settings,
    path: "about",
    component: lazyRouteComponent(() => import("@/routes/settings.about"), "AboutPage"),
  }),
  createRoute({ getParentRoute: () => settings, path: "security", component: SecurityPage }),
];
const communityLayout = createRoute({
  getParentRoute: () => authenticated,
  path: "/communities/$communityId",
  component: lazyRouteComponent(
    () => import("@/routes/_authenticated.communities.$communityId"),
    "CommunityLayout",
  ),
});
const communityChildren = [
  createRoute({
    getParentRoute: () => communityLayout,
    path: "/",
    component: lazyRouteComponent(
      () => import("@/routes/_authenticated.communities.$communityId.index"),
      "CommunityIndexPage",
    ),
  }),
  createRoute({
    getParentRoute: () => communityLayout,
    path: "chats/$chatId",
    validateSearch: (search: Record<string, unknown>): { scrollTo?: string } => ({
      scrollTo:
        typeof search.scrollTo === "string" && /^[0-9a-f-]{36}$/i.test(search.scrollTo)
          ? search.scrollTo
          : undefined,
    }),
    component: lazyRouteComponent(
      () => import("@/routes/_authenticated.communities.$communityId.chats.$chatId"),
      "CommunityChatPage",
    ),
  }),
  createRoute({
    getParentRoute: () => communityLayout,
    path: "info",
    component: lazyRouteComponent(
      () => import("@/routes/_authenticated.communities.$communityId.info"),
      "CommunityInfoPage",
    ),
  }),
];
const protectedRoutes = [
  createRoute({
    getParentRoute: () => authenticated,
    path: "/communities",
    component: lazyRouteComponent(
      () => import("@/routes/_authenticated.communities"),
      "CommunitiesPage",
    ),
  }),
  communityLayout.addChildren(communityChildren),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/onboarding/pick-username",
    component: PickUsernamePage,
  }),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/onboarding/welcome",
    component: WelcomePage,
  }),
  settings.addChildren(settingsChildren),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/profile/$username",
    component: lazyRouteComponent(() => import("@/routes/profile.$username"), "PublicProfilePage"),
  }),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/chats/new",
    component: lazyRouteComponent(() => import("@/routes/_authenticated.chats.new"), "NewChatPage"),
  }),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/chats/new-group",
    component: lazyRouteComponent(
      () => import("@/routes/_authenticated.chats.new-group"),
      "NewGroupPage",
    ),
  }),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/chats/$chatId",
    validateSearch: (search: Record<string, unknown>): { scrollTo?: string } => ({
      scrollTo:
        typeof search.scrollTo === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search.scrollTo)
          ? search.scrollTo
          : undefined,
    }),
    component: lazyRouteComponent(
      () => import("@/routes/_authenticated.chats.$chatId"),
      "ChatPage",
    ),
  }),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/chats",
    validateSearch: validateChatSearch,
    search: { middlewares: [stripSearchParams({ filter: "all", q: "", selectedIds: "" })] },
    component: lazyRouteComponent(() => import("@/routes/_authenticated.chats"), "ChatsPage"),
  }),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/chats/$chatId/info",
    component: lazyRouteComponent(
      () => import("@/routes/_authenticated.chats.$chatId.info"),
      "GroupInfoPage",
    ),
  }),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/chats/$chatId/members",
    component: lazyRouteComponent(
      () => import("@/routes/_authenticated.chats.$chatId.members"),
      "GroupMembersPage",
    ),
  }),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/chats/$chatId/media",
    component: lazyRouteComponent(
      () => import("@/routes/_authenticated.chats.$chatId.media"),
      "SharedMediaPage",
    ),
    validateSearch: (search: Record<string, unknown>): { tab: "media" | "files" } => ({
      tab: search.tab === "files" ? "files" : "media",
    }),
  }),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/novedades",
    validateSearch: (s: Record<string, unknown>): { create?: boolean } => ({
      create: s.create === true || s.create === "true" ? true : undefined,
    }),
    component: lazyRouteComponent(
      () => import("@/routes/_authenticated.novedades"),
      "NovedadesPage",
    ),
  }),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/novedades/explore",
    component: lazyRouteComponent(
      () => import("@/routes/_authenticated.novedades"),
      "ExploreChannelsPage",
    ),
  }),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/channels/$channelId",
    component: lazyRouteComponent(
      () => import("@/routes/_authenticated.channels.$channelId"),
      "ChannelPage",
    ),
  }),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/channels/$channelId/info",
    component: lazyRouteComponent(
      () => import("@/routes/_authenticated.channels.$channelId.info"),
      "ChannelPage",
    ),
  }),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/channels/new",
    beforeLoad: () => {
      throw redirect({ to: "/novedades", search: { create: true } });
    },
  }),
  createRoute({
    getParentRoute: () => authenticated,
    path: "/channels",
    beforeLoad: () => {
      throw redirect({ to: "/novedades", search: { create: undefined } });
    },
  }),
  ...["calls", "profile"].map((path) =>
    createRoute({
      getParentRoute: () => authenticated,
      path: `/${path}`,
      component: AuthenticatedDestination,
    }),
  ),
];
export const router = createRouter({
  routeTree: root.addChildren([...publicRoutes, authenticated.addChildren(protectedRoutes)]),
  context: { auth: undefined as unknown as AuthState },
  defaultPreload: false,
  defaultErrorComponent: RouteErrorState,
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
