import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthFrame, InlineError } from "@/features/auth/components";
import { useCheckEmail } from "@/features/auth/hooks/useCheckEmail";
import { safeRedirect } from "@/features/auth/navigation";
export function CheckEmailPage() {
  const { params, email, remaining, busy, message, error, resend } = useCheckEmail();
  return (
    <AuthFrame title="Check your email">
      <Mail className="feature-icon" size={40} strokeWidth={1.75} aria-hidden="true" />
      <p>
        We sent a magic link to <strong>{email || "your email"}</strong>. Click it to continue. The
        link expires in 10 minutes.
      </p>
      <p className="quiet-note">Open the link in this browser to finish signing in.</p>
      <Button type="button" disabled={remaining > 0 || busy || !email} onClick={resend}>
        {busy ? "Sending…" : remaining > 0 ? `Resend in ${remaining}s` : "Resend email"}
      </Button>
      <p role="status">{message}</p>
      <InlineError>{error}</InlineError>
      <a
        href={`/auth/${params.get("mode") === "signup" ? "signup" : "login"}?${new URLSearchParams({ redirect: safeRedirect(params.get("redirect")) })}`}
      >
        Change email
      </a>
      <p className="quiet-note">Didn’t receive it? Check your spam folder.</p>
    </AuthFrame>
  );
}
