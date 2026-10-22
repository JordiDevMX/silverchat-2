import { Outlet, redirect } from "@tanstack/react-router";
import { AppSkeleton } from "@/features/auth/components";
import { nextDestination, safeRedirect } from "@/features/auth/navigation";
import type { AuthState } from "@/features/auth/types";
import { PendingDeletionBanner } from "@/features/settings/components/PendingDeletionBanner";
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
  return !auth.user || auth.mfaRequired ? (
    <AppSkeleton />
  ) : (
    <>
      <PendingDeletionBanner />
      <Outlet />
    </>
  );
}
