import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppSkeleton } from "@/features/auth/components";
import { nextDestination, safeRedirect, searchParams } from "@/features/auth/navigation";
import { useAuth } from "@/lib/auth-provider";
export function PostLoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const redirect = safeRedirect(searchParams().get("redirect"));
  useEffect(() => {
    if (auth.isLoading) return;
    const destination = !auth.user
      ? "/auth/error?code=invalid_token"
      : auth.mfaRequired
        ? `/auth/2fa-verify?${new URLSearchParams({ redirect })}`
        : nextDestination(auth.profile?.username, redirect);
    void router.navigate({ href: destination, replace: true });
  }, [auth.isLoading, auth.user, auth.mfaRequired, auth.profile?.username, router, redirect]);
  return <AppSkeleton text="Signing you in…" />;
}
