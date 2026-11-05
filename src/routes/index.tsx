import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { LandingSurface } from "@/components/ui/auth-surfaces";
import { nextDestination } from "@/features/auth/navigation";
import { useAuth } from "@/lib/auth-provider";
export function LandingPage() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.user)
      void router.navigate({
        href: auth.mfaRequired
          ? "/auth/2fa-verify"
          : nextDestination(auth.profile?.username, "/chats"),
        replace: true,
      });
  }, [auth.user, auth.mfaRequired, auth.profile?.username, router]);
  return <LandingSurface />;
}
