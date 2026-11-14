import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { LandingSurface } from "@/components/ui/auth-surfaces";
import { useAuthText } from "@/features/auth/i18n";
import { nextDestination } from "@/features/auth/navigation";
import { useAuth } from "@/lib/auth-provider";
export function LandingPage() {
  const auth = useAuth();
  const router = useRouter();
  const t = useAuthText();
  useEffect(() => {
    if (auth.user)
      void router.navigate({
        href: auth.mfaRequired
          ? "/auth/2fa-verify"
          : nextDestination(auth.profile?.username, "/chats"),
        replace: true,
      });
  }, [auth.user, auth.mfaRequired, auth.profile?.username, router]);
  return (
    <LandingSurface
      copy={{
        brandLabel: t("SilverChat home"),
        logIn: t("Log in"),
        heading: [t("Good conversations"), t("need their own space.")],
        body: [
          t("SilverChat — Privacy-first messaging."),
          t("A place to catch up, share a moment, and feel closer to your people."),
        ],
        getStarted: t("Get started"),
        startNote: t("Your email is all you need to begin."),
        artLabel: t("An illustration of a private conversation"),
        bubbles: [t("Got a minute?"), t("For you? Always."), t("Let’s catch up.")],
        artCaption: t("A little closer, wherever you are."),
        footer: t("Made for the conversations that matter."),
      }}
    />
  );
}
