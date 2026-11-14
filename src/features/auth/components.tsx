import { useRouter } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export { AppSkeleton } from "@/components/ui/app-skeleton";
export { CodeInput } from "@/components/ui/code-input";
export { InlineError } from "@/components/ui/inline-error";
export { Modal } from "@/components/ui/modal";

import { AuthSurface, PublicBrand } from "@/components/ui/auth-surfaces";
import { useAuth } from "@/lib/auth-provider";
import { useAuthText } from "./i18n";

export { PublicBrand as Brand };

/** Public form frame: translates the shared chrome and the copy it receives. */
export function AuthFrame({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  const t = useAuthText();
  return (
    <AuthSurface
      title={t(title)}
      subtitle={subtitle ? t(subtitle) : undefined}
      copy={{
        brandLabel: t("SilverChat home"),
        asideTitle: [t("A little more space"), t("for your people.")],
        asideBody: [
          t("Conversations that belong to you."),
          t("Start with your email. Stay for the connection."),
        ],
        asideTagline: t("Privacy-first messaging"),
        footer: t("Your conversations. Your space."),
      }}
    >
      {children}
    </AuthSurface>
  );
}

export function SessionExpiredModal() {
  const auth = useAuth();
  const router = useRouter();
  const t = useAuthText();
  if (!auth.sessionExpired) return null;
  return (
    <Modal title={t("Your session has expired")} className="session-expired-dialog">
      <p>{t("Please log in again to continue.")}</p>
      <Button
        className="w-full"
        type="button"
        onClick={() => {
          window.location.assign(
            `/auth/login?${new URLSearchParams({ redirect: router.state.location.href })}`,
          );
        }}
      >
        {t("Log in")}
      </Button>
    </Modal>
  );
}
