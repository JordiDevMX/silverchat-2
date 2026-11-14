import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthFrame, InlineError } from "@/features/auth/components";
import { useCheckEmail } from "@/features/auth/hooks/useCheckEmail";
import { useAuthText } from "@/features/auth/i18n";
import { safeRedirect } from "@/features/auth/navigation";
export function CheckEmailPage() {
  const { params, email, remaining, busy, message, error, resend } = useCheckEmail();
  const t = useAuthText();
  return (
    <AuthFrame title={t("Check your email")}>
      <Mail className="feature-icon" size={40} strokeWidth={1.75} aria-hidden="true" />
      <p>
        {t("We sent a magic link to")} <strong>{email || t("your email")}</strong>.{" "}
        {t("Click it to continue. The link expires in 10 minutes.")}
      </p>
      <p className="quiet-note">{t("Open the link in this browser to finish signing in.")}</p>
      <Button type="button" disabled={remaining > 0 || busy || !email} onClick={resend}>
        {busy
          ? t("Sending…")
          : remaining > 0
            ? t(`Resend in ${remaining}s`, `Reenviar en ${remaining}s`)
            : t("Resend email")}
      </Button>
      <p role="status">{t(message)}</p>
      <InlineError>{t(error)}</InlineError>
      <a
        href={`/auth/${params.get("mode") === "signup" ? "signup" : "login"}?${new URLSearchParams({ redirect: safeRedirect(params.get("redirect")) })}`}
      >
        {t("Change email")}
      </a>
      <p className="quiet-note">{t("Didn’t receive it? Check your spam folder.")}</p>
    </AuthFrame>
  );
}
