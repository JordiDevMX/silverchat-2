import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { AuthFrame, InlineError, SessionExpiredModal } from "@/features/auth/components";
import type { AuthState } from "@/features/auth/types";
import { useAuth } from "@/lib/auth-provider";
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
    </>
  );
}
// Auth landing destination only; messaging and the devices UI belong to later prompts.
function AuthenticatedDestination() {
  const auth = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <AuthFrame
      title={`You’re signed in, ${auth.profile?.display_name ?? "friend"}.`}
      subtitle="Your SilverChat account is ready."
    >
      {auth.user?.user_metadata.requires_reenrollment &&
        !auth.user.factors?.some((factor) => factor.status === "verified") && (
          <p role="status">Backup code used. Please re-enable 2FA in settings.</p>
        )}
      <a className="button primary" href="/settings/security">
        Security settings
      </a>
      <button
        className="button secondary"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await auth.signOut();
            await router.navigate({ to: "/", replace: true });
          } catch {
            setError(
              "Signed out here, but server revocation could not be confirmed. Try signing in and out again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      <InlineError>{error}</InlineError>
    </AuthFrame>
  );
}
const root = createRootRouteWithContext<{ auth: AuthState }>()({
  component: Root,
  beforeLoad: ({ context, location }) => {
    if (
      /^\/(chats|channels|communities|calls|settings|profile|onboarding)(\/|$)/.test(
        location.pathname,
      )
    ) {
      requireAuthentication(context.auth, location.href, location.pathname);
    }
  },
  notFoundComponent: () => (
    <AuthFrame title="Page not found">
      <a href="/">Return home</a>
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
const protectedRoutes = [
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
  createRoute({
    getParentRoute: () => authenticated,
    path: "/settings/security",
    component: SecurityPage,
  }),
  ...["chats", "channels", "communities", "calls", "settings", "profile"].map((path) =>
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
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
