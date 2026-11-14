import type { ErrorComponentProps } from "@tanstack/react-router";
import { InfrastructureNotice } from "@/components/ui/auth-surfaces";
import { Button } from "@/components/ui/button";
import { AuthFrame } from "@/features/auth/components";
import { useAuthText } from "@/features/auth/i18n";

/** Replaces the router's diagnostic presentation without exposing internal error details. */
export function RouteErrorState({ reset }: ErrorComponentProps) {
  const t = useAuthText();
  return (
    <AuthFrame title={t("Something went wrong")}>
      <InfrastructureNotice role="alert">
        {t("This page couldn’t be opened. Please try again.")}
      </InfrastructureNotice>
      <Button onClick={reset}>{t("Try again")}</Button>
      <Button asChild variant="outline">
        <a href="/">{t("Return home")}</a>
      </Button>
    </AuthFrame>
  );
}
