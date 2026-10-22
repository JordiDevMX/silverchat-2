import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthFrame, InlineError } from "@/features/auth/components";
import { safeRedirect, searchParams } from "@/features/auth/navigation";
import { useAuth } from "@/lib/auth-provider";
export function CheckEmailPage() {
  const auth = useAuth();
  const params = searchParams();
  const email = params.get("email") ?? "";
  const [remaining, setRemaining] = useState(60);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const interval = setInterval(() => setRemaining((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(interval);
  }, []);
  const resend = async () => {
    setBusy(true);
    setError("");
    try {
      await auth.signIn(email, "resend", safeRedirect(params.get("redirect")));
      setRemaining(60);
      setMessage("Email sent again. Check your inbox.");
    } catch {
      setError("We couldn’t send a link. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthFrame title="Check your email">
      <Mail className="feature-icon" size={40} strokeWidth={1.75} aria-hidden="true" />
      <p>
        We sent a magic link to <strong>{email || "your email"}</strong>. Click it to continue. The
        link expires in 10 minutes.
      </p>
      <p className="quiet-note">Open the link in this browser to finish signing in.</p>
      <button
        className="button primary"
        type="button"
        disabled={remaining > 0 || busy || !email}
        onClick={resend}
      >
        {busy ? "Sending…" : remaining > 0 ? `Resend in ${remaining}s` : "Resend email"}
      </button>
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
